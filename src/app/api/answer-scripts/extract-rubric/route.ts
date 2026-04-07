import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  extractRubricFromKey,
  extractionToQuestions,
  extractionToSummary,
} from "@/lib/answer-scripts-rubric-extraction";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-5-nano";

/**
 * Pre-extracts the rubric + correct answers from the answer key PDF.
 * Called when the professor finishes Step 1 so the rubric is ready
 * before grading starts — eliminates one API call from the grading path.
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

  const examName = (form.get("examName") as string | null)?.trim() || "Exam";

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
    const extracted = await extractRubricFromKey(openai, MODEL, keyDataUrl, examName);
    const derivedQuestions = extractionToQuestions(extracted);
    const answerKeySummary = extractionToSummary(extracted);

    if (derivedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Could not extract questions from the answer key PDF." },
        { status: 502 }
      );
    }

    return NextResponse.json({ derivedQuestions, answerKeySummary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed.";
    console.error("[answer-scripts/extract-rubric]", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
