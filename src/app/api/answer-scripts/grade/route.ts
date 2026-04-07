import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  AiQuestionGrade,
  AiStepGrade,
  ExamQuestion,
  StepConfidence,
} from "@/components/answer-scripts-evaluation/types";
import { formatExamStepRubricForPrompt } from "@/components/answer-scripts-evaluation/rubric-prompt";
import { STRICTNESS_OPTIONS } from "@/components/answer-scripts-evaluation/constants";
import {
  extractRubricFromKey,
  extractionToQuestions,
  extractionToSummary,
} from "@/lib/answer-scripts-rubric-extraction";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-5-nano";
const DEFAULT_MAX_PER_QUESTION = 10;

/* ================================================================== */
/*  Architecture: TWO separate OpenAI calls per grading request.      */
/*                                                                    */
/*  CALL 1 — "Extract rubric" (answer key PDF only, NO student data)  */
/*    Input:  answer key PDF attachment                                */
/*    Output: JSON with question structure, max marks, and the full    */
/*            text of each correct answer                              */
/*    This call runs ONCE per session (first student). For subsequent  */
/*    students the extracted rubric is reused from the payload.        */
/*                                                                    */
/*  CALL 2 — "Grade student" (student PDF only, NO answer key PDF)    */
/*    Input:  student script PDF attachment + correct answers as TEXT  */
/*    Output: JSON grades per question/step                           */
/*    The answer key is NEVER attached as a PDF here. The model only  */
/*    sees ONE PDF — the student's script — so it physically cannot   */
/*    confuse the two documents.                                      */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type GradingStep = {
  stepId: string;
  awarded?: number;
  justification?: string;
  confidence?: string;
  ok?: boolean;
  subPartLabel?: string;
  description?: string;
  stepMax?: number;
};

type GradingQuestion = {
  questionId: string;
  questionNo?: number;
  label?: string;
  steps?: GradingStep[];
};

type GradingPayload = { questions?: GradingQuestion[] };

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isConfidence(c: string | undefined): c is StepConfidence {
  return c === "high" || c === "medium" || c === "low";
}

function strictnessText(mode: string): string {
  const opt = STRICTNESS_OPTIONS.find((o) => o.id === mode);
  return opt
    ? `Strictness: "${opt.label}" — ${opt.hint}`
    : `Strictness: ${mode}`;
}

/* ------------------------------------------------------------------ */
/*  Grade student script (student PDF only, NO key PDF)               */
/* ------------------------------------------------------------------ */

function buildGradingSystemPrompt(strictness: string): string {
  const strictBlock =
    strictness === "exact"
      ? `EXACT: match the correct answer closely. Conservative partial credit.`
      : strictness === "partial"
        ? `GENEROUS PARTIAL CREDIT: reward incomplete but relevant student work.`
        : `CONCEPTUAL: reward correct reasoning even if the student's wording differs.`;

  return `You are grading ONE student's exam script.

WHAT YOU RECEIVE:
- TEXT in the user message containing the CORRECT ANSWERS (extracted from the professor's answer key). These are labeled "CORRECT ANSWER:" in the text.
- ONE ATTACHED PDF which is the STUDENT'S answer script. This PDF is the ONLY thing you are grading.

YOU MUST NOT CONFUSE THESE TWO SOURCES:
- The TEXT tells you what the CORRECT answers are (for reference).
- The PDF shows you what the STUDENT actually wrote (for grading).

EXAMPLE: If the text says "CORRECT ANSWER: intersection at x=30 and x=40" but the student's PDF shows they wrote "x=25 and x=50", then:
- You report: "The student wrote intersection points x=25 and x=50"
- You compare: "The correct answer is x=30 and x=40, so the student's answer is incorrect"
- You do NOT say: "The student found x=30 and x=40" — that would be reading from the correct answers, not from the student's PDF

RULES:
1. Read the student's PDF carefully. Look at THEIR handwriting, THEIR numbers, THEIR diagrams.
2. For each question, state what the STUDENT wrote, then compare to the correct answer.
3. Award marks based on how well the student's work matches the correct answer.
4. Every justification must start with what the STUDENT wrote in their PDF.
5. NEVER copy values from the "CORRECT ANSWER" text and attribute them to the student.
6. Blank/unattempted questions = 0 marks.
7. Unclear handwriting = lower confidence, conservative marks.

Strictness: ${strictBlock}

Respond with valid JSON only.`;
}

function buildGradingUserText(
  examName: string,
  strictness: string,
  answerKeySummary: string,
  lockedQuestions: ExamQuestion[]
): string {
  let rubricIds = "";
  for (const q of lockedQuestions) {
    const qMax = q.steps.reduce((s, st) => s + (Number(st.marks) || 0), 0);
    rubricIds += `\nQuestion ${q.questionNo} (questionId: ${q.id}) — max ${qMax} marks:\n`;
    for (const st of q.steps) {
      rubricIds += `  stepId: ${st.id} — ${st.subPartLabel} — max ${st.marks} marks\n`;
    }
  }

  return `Exam: ${examName}
${strictnessText(strictness)}

${answerKeySummary}

Use EXACTLY these question and step IDs in your JSON response:
${rubricIds}

Return JSON:
{
  "questions": [
    {
      "questionId": "<exact questionId from above>",
      "steps": [
        {
          "stepId": "<exact stepId from above>",
          "awarded": <marks the STUDENT earned>,
          "justification": "<2-5 sentences: FIRST state what the student wrote in their PDF, THEN compare to the correct answer, THEN explain marks awarded/deducted>",
          "confidence": "high" | "medium" | "low",
          "ok": true | false
        }
      ]
    }
  ]
}

The attached PDF is the STUDENT'S answer script — the ONLY document you are grading. Read it now and grade each question.`;
}

/* ------------------------------------------------------------------ */
/*  Parse grading response                                            */
/* ------------------------------------------------------------------ */

function parseGrades(
  raw: GradingPayload,
  lockedQuestions: ExamQuestion[]
): AiQuestionGrade[] {
  const qs = raw.questions;
  if (!Array.isArray(qs) || qs.length === 0) return [];

  const byQ = new Map(qs.map((q) => [q.questionId, q]));
  return lockedQuestions.map((q) => {
    const rq = byQ.get(q.id);
    const rSteps = new Map(rq?.steps?.map((s) => [s.stepId, s]) ?? []);
    const steps: AiStepGrade[] = q.steps.map((st) => {
      const rs = rSteps.get(st.id);
      const max = st.marks;
      let awarded =
        typeof rs?.awarded === "number" && Number.isFinite(rs.awarded)
          ? rs.awarded
          : 0;
      awarded = Math.min(max, Math.max(0, awarded));
      return {
        stepId: st.id,
        subPartLabel: st.subPartLabel,
        stepMax: max,
        awarded,
        justification:
          typeof rs?.justification === "string" && rs.justification.trim()
            ? rs.justification.trim()
            : "No rationale returned.",
        confidence: isConfidence(rs?.confidence) ? rs.confidence : "medium",
        ok: typeof rs?.ok === "boolean" ? rs.ok : true,
        llmRubricBlock: formatExamStepRubricForPrompt(st),
      };
    });
    return {
      questionId: q.id,
      label: `Q${q.questionNo}`,
      maxMarks: q.steps.reduce((s, st) => s + st.marks, 0),
      aiAwarded: steps.reduce((s, x) => s + x.awarded, 0),
      steps,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                      */
/* ------------------------------------------------------------------ */

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
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON." }, { status: 400 });
  }

  const strictness = payload.strictness ?? "conceptual";
  const examName = payload.examName?.trim() || "Exam";

  const maxBytes = 32 * 1024 * 1024;
  const keyBuf = Buffer.from(await answerKey.arrayBuffer());
  const scriptBuf = Buffer.from(await script.arrayBuffer());
  if (keyBuf.byteLength > maxBytes || scriptBuf.byteLength > maxBytes) {
    return NextResponse.json(
      { error: "Each PDF must be 32 MB or smaller." },
      { status: 413 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    /* -------------------------------------------------------------- */
    /*  Step A: Get the rubric + correct answers as TEXT               */
    /*  Either from a previous call (payload) or by extracting now    */
    /* -------------------------------------------------------------- */

    let lockedQuestions: ExamQuestion[];
    let answerKeySummary: string;
    let derivedQuestions: ExamQuestion[] | undefined;

    const hasExistingRubric =
      typeof payload.answerKeySummary === "string" &&
      payload.answerKeySummary.length > 0 &&
      Array.isArray(payload.questions) &&
      payload.questions.length > 0;

    if (hasExistingRubric) {
      lockedQuestions = payload.questions as ExamQuestion[];
      answerKeySummary = payload.answerKeySummary!;
    } else {
      const keyDataUrl = `data:application/pdf;base64,${keyBuf.toString("base64")}`;
      const extracted = await extractRubricFromKey(openai, MODEL, keyDataUrl, examName);
      lockedQuestions = extractionToQuestions(extracted);
      answerKeySummary = extractionToSummary(extracted);
      derivedQuestions = lockedQuestions;

      if (lockedQuestions.length === 0) {
        return NextResponse.json(
          { error: "Could not extract questions from the answer key PDF. Check the PDF and try again." },
          { status: 502 }
        );
      }
    }

    /* -------------------------------------------------------------- */
    /*  Step B: Grade the student — ONLY student PDF attached          */
    /*  The answer key is included as TEXT, not as a PDF.              */
    /* -------------------------------------------------------------- */

    const scriptDataUrl = `data:application/pdf;base64,${scriptBuf.toString("base64")}`;

    const gradingCompletion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildGradingSystemPrompt(strictness),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildGradingUserText(
                examName,
                strictness,
                answerKeySummary,
                lockedQuestions
              ),
            },
            {
              type: "file",
              file: {
                filename: "student-answer-script.pdf",
                file_data: scriptDataUrl,
              },
            },
          ],
        },
      ],
    });

    const gradingText = gradingCompletion.choices[0]?.message?.content;
    if (!gradingText) {
      return NextResponse.json({ error: "Empty grading response." }, { status: 502 });
    }

    let gradingParsed: GradingPayload;
    try {
      gradingParsed = JSON.parse(gradingText) as GradingPayload;
    } catch {
      return NextResponse.json({ error: "Grading model returned non-JSON." }, { status: 502 });
    }

    const grades = parseGrades(gradingParsed, lockedQuestions);
    if (grades.length === 0) {
      return NextResponse.json(
        { error: "Model returned no grades; check PDFs and try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      grades,
      answerKeySummary,
      ...(derivedQuestions ? { derivedQuestions } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI request failed.";
    console.error("[answer-scripts/grade]", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
