import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ExamQuestion } from "@/components/answer-scripts-evaluation/types";
import type { CanonicalRubric } from "@/lib/evaluation/rubric-schema";
import { parseAnswerKeyPdfToRubric } from "@/lib/evaluation/parse-answer-key";
import { transcribeStudentPdf } from "@/lib/evaluation/transcribe-script";
import { gradePaperFromTranscription } from "@/lib/evaluation/grade-paper";
import {
  canonicalRubricToAnswerKeySummary,
  canonicalRubricToExamQuestions,
  gradeResultToAiGrades,
} from "@/lib/evaluation/evaluation-map";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Default matches `Documents/evaluation` (vision + structured JSON). Override with `OPENAI_EVAL_MODEL`. */
const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-4o";

/**
 * Handwritten script evaluation (ported from `Documents/evaluation`):
 * 1) Parse answer key PDF → validated canonical rubric (strict JSON schema).
 * 2) Transcribe student PDF twice (vision) and diff for flags.
 * 3) Grade each rubric step in isolation (cached), partial self-consistency, optional alt-path.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const answerKey = form.get("answerKey");
  if (!(answerKey instanceof Blob) || answerKey.size === 0) {
    return NextResponse.json(
      { error: "Missing answer key PDF from step 1." },
      { status: 400 }
    );
  }

  const script = form.get("script");
  if (!(script instanceof Blob) || script.size === 0) {
    return NextResponse.json(
      { error: "Missing student answer PDF." },
      { status: 400 }
    );
  }

  const payloadRaw = form.get("payload");
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "Missing payload JSON." }, { status: 400 });
  }

  let payload: {
    examName?: string;
    strictness?: string;
    questions?: ExamQuestion[];
    answerKeySummary?: string;
    canonicalRubric?: CanonicalRubric;
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON." }, { status: 400 });
  }

  const strictness = payload.strictness ?? "conceptual";

  const maxBytes = 32 * 1024 * 1024;
  const keyBuf = Buffer.from(await answerKey.arrayBuffer());
  const scriptBuf = Buffer.from(await script.arrayBuffer());
  if (keyBuf.byteLength > maxBytes || scriptBuf.byteLength > maxBytes) {
    return NextResponse.json(
      { error: "Each PDF must be 32 MB or smaller." },
      { status: 413 }
    );
  }

  const keyDataUrl = `data:application/pdf;base64,${keyBuf.toString("base64")}`;
  const scriptDataUrl = `data:application/pdf;base64,${scriptBuf.toString("base64")}`;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    let rubric: CanonicalRubric;
    let answerKeySummary: string;

    if (payload.canonicalRubric?.questions?.length) {
      rubric = payload.canonicalRubric;
      answerKeySummary =
        typeof payload.answerKeySummary === "string" && payload.answerKeySummary.length > 0
          ? payload.answerKeySummary
          : canonicalRubricToAnswerKeySummary(rubric);
    } else {
      rubric = await parseAnswerKeyPdfToRubric(openai, MODEL, keyDataUrl);
      answerKeySummary = canonicalRubricToAnswerKeySummary(rubric);
    }

    const scriptPart = form.get("script");
    const scriptName =
      scriptPart instanceof File ? scriptPart.name : "student-answer-script.pdf";

    const transcription = await transcribeStudentPdf(openai, MODEL, scriptDataUrl, scriptName);
    const gradeResult = await gradePaperFromTranscription(
      openai,
      MODEL,
      strictness,
      transcription,
      rubric
    );

    const lockedQuestions = canonicalRubricToExamQuestions(rubric);

    const grades = gradeResultToAiGrades(lockedQuestions, gradeResult);

    if (grades.length === 0) {
      return NextResponse.json(
        { error: "No grades produced; check answer key template and student PDF." },
        { status: 502 }
      );
    }

    const derivedQuestions = canonicalRubricToExamQuestions(rubric);

    return NextResponse.json({
      grades,
      answerKeySummary,
      canonicalRubric: rubric,
      derivedQuestions,
      evaluationFlags: gradeResult.flags,
      evaluationNeedsReview: gradeResult.needs_review,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Evaluation failed.";
    console.error("[answer-scripts/grade]", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
