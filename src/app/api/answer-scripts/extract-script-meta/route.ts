import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractNameRollFromExamScriptText } from "@/lib/extract-exam-script-meta";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 32 * 1024 * 1024;
const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-5-nano";

/**
 * Quick LLM call to read student name and roll number from the PDF.
 * Used when pdf-parse text extraction fails (scanned/image PDFs).
 */
async function extractMetaViaLlm(
  pdfDataUrl: string
): Promise<{ name: string; roll: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { name: "", roll: "" };

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract the student's name and roll number from the attached exam answer script PDF. Return JSON only: { \"name\": \"...\", \"rollNo\": \"...\" }. If you cannot find one, return an empty string for that field.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Read the first page of this student answer script and extract the student's full name and roll number (or registration number / enrollment number).",
            },
            {
              type: "file",
              file: {
                filename: "student-script.pdf",
                file_data: pdfDataUrl,
              },
            },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return { name: "", roll: "" };

    const parsed = JSON.parse(text) as { name?: string; rollNo?: string };
    return {
      name: (parsed.name ?? "").trim(),
      roll: (parsed.rollNo ?? "").trim(),
    };
  } catch (e) {
    console.error("[extract-script-meta] LLM fallback failed:", e);
    return { name: "", roll: "" };
  }
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing or empty PDF." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "PDF must be 32MB or smaller." }, { status: 413 });
  }

  let numPages = 1;
  let textName = "";
  let textRoll = "";
  let hasText = false;

  /* --- Step 1: Try pdf-parse text extraction + regex --- */
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const info = await parser.getInfo();
    numPages = Math.max(1, info.total || 1);
    const textResult = await parser.getText({ first: Math.min(3, numPages) });
    const rawText = textResult.text || "";
    await parser.destroy();
    hasText = rawText.trim().length > 0;

    if (hasText) {
      const extracted = extractNameRollFromExamScriptText(rawText);
      textName = extracted.name;
      textRoll = extracted.roll;
    }
  } catch (e) {
    console.error("[extract-script-meta] pdf-parse failed:", e);
  }

  /* --- Step 2: If name or roll still missing, use LLM to read from the PDF --- */
  const needsLlm = !textName || !textRoll;

  if (needsLlm) {
    const pdfDataUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
    const llmResult = await extractMetaViaLlm(pdfDataUrl);

    if (!textName && llmResult.name) textName = llmResult.name;
    if (!textRoll && llmResult.roll) textRoll = llmResult.roll;
  }

  return NextResponse.json({
    name: textName,
    rollNo: textRoll,
    pages: numPages,
    textExtracted: hasText,
  });
}
