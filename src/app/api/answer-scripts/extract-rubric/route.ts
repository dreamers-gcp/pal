import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { parseAnswerKeyPdfToRubric } from "@/lib/evaluation/parse-answer-key";
import {
  canonicalRubricToAnswerKeySummary,
  canonicalRubricToExamQuestions,
} from "@/lib/evaluation/evaluation-map";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-4o";

/**
 * Pre-extract canonical rubric from the answer key PDF (same parser as grading).
 * Matches `Documents/evaluation` parse_key PDF path + rubric validation.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
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
      { error: "Missing answer key PDF." },
      { status: 400 }
    );
  }

  const keyBuf = Buffer.from(await answerKey.arrayBuffer());
  if (keyBuf.byteLength > 32 * 1024 * 1024) {
    return NextResponse.json(
      { error: "PDF must be 32 MB or smaller." },
      { status: 413 }
    );
  }

  const keyDataUrl = `data:application/pdf;base64,${keyBuf.toString("base64")}`;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const rubric = await parseAnswerKeyPdfToRubric(openai, MODEL, keyDataUrl);
    const derivedQuestions = canonicalRubricToExamQuestions(rubric);
    const answerKeySummary = canonicalRubricToAnswerKeySummary(rubric);

    if (derivedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Could not extract questions from the answer key PDF." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      derivedQuestions,
      answerKeySummary,
      canonicalRubric: rubric,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed.";
    console.error("[answer-scripts/extract-rubric]", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
