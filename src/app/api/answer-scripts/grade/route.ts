import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { AiQuestionGrade, AiStepGrade, ExamQuestion, StepConfidence } from "@/components/answer-scripts-evaluation/types";
import { formatExamStepRubricForPrompt } from "@/components/answer-scripts-evaluation/rubric-prompt";
import { STRICTNESS_OPTIONS } from "@/components/answer-scripts-evaluation/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.OPENAI_EVAL_MODEL?.trim() || "gpt-4o";

type RawStep = {
  stepId: string;
  awarded?: number;
  justification?: string;
  confidence?: string;
  ok?: boolean;
};

type RawQuestion = {
  questionId: string;
  steps?: RawStep[];
};

type RawPayload = {
  questions?: RawQuestion[];
};

function isConfidence(c: string | undefined): c is StepConfidence {
  return c === "high" || c === "medium" || c === "low";
}

function strictnessInstructions(mode: string): string {
  switch (mode) {
    case "exact":
      return `Evaluation strictness: EXACT (match answer key closely). Align marks tightly with the expected solution and key terms. Be conservative with partial credit: award only when the work clearly satisfies the criterion; small errors or missing steps should reduce the score noticeably. You may use fractional marks (e.g. halves or tenths) within 0 and the step maximum.`;
    case "partial":
      return `Evaluation strictness: GENEROUS PARTIAL CREDIT. When in doubt, prefer awarding meaningful partial marks for incomplete but relevant work, correct method with arithmetic slips, or partially correct reasoning. The rubric lists maximum marks per sub-part; you decide how much of that maximum the student earned.`;
    case "conceptual":
    default:
      return `Evaluation strictness: CONCEPTUAL. Reward correct ideas and sound reasoning even if phrasing differs from the answer key. Partial credit should reflect how much of the intended concept is demonstrated. Use the full range from 0 to the step maximum where appropriate.`;
  }
}

function buildSystemPrompt(strictness: string): string {
  const s = strictnessInstructions(strictness);
  return `You are an expert exam grader. You receive two PDFs in order: (1) the official answer key, (2) the student's script. You also receive a structured rubric with per-sub-part stepIds, what each part assesses, and maximum sub-marks.

Rules:
- For each sub-part, set "awarded" to a number from 0 up to that sub-part's maximum marks (inclusive). You decide partial credit: there are no fixed score bands — use "${strictness}" mode below.
- ${s}
- "awarded" must be between 0 and the step maximum marks inclusive (fractions allowed if the marking scheme implies them, e.g. 0.5 steps).
- For every sub-part, "justification" must explain the marking decision in plain language: (1) state the awarded mark versus the step maximum (e.g. "2/3"); (2) what the student did that earned those marks, with brief reference to the script; (3) if the mark is below the maximum, explicitly say what was wrong, incomplete, or missing compared to the answer key or rubric, so it is clear why marks were deducted or not given; (4) if full marks, still briefly confirm what was correct so the award is auditable.
- "confidence": high if the PDF clearly supports your mark; medium if somewhat ambiguous; low if handwriting/layout makes marking uncertain.
- "ok" should be true when the mark fairly reflects visible work; false if borderline or the script is too unclear to justify the score confidently.

Respond with valid JSON only, matching the schema in the user message.`;
}

function buildUserRubricText(questions: ExamQuestion[]): string {
  let out = "";
  for (const q of questions) {
    const qMax = q.steps.reduce((s, st) => s + (Number(st.marks) || 0), 0);
    out += `\n## Question ${q.questionNo} (questionId: ${q.id}) — total max for this question: ${qMax} marks\n`;
    for (const st of q.steps) {
      out += `\n### stepId: ${st.id}\n`;
      out += formatExamStepRubricForPrompt(st);
      out += "\n";
    }
  }
  return out;
}

function strictnessUserLine(mode: string): string {
  const opt = STRICTNESS_OPTIONS.find((o) => o.id === mode);
  if (opt) {
    return `Instructor strictness: "${opt.label}" — ${opt.hint}`;
  }
  return `Instructor strictness mode: ${mode}`;
}

function enrichGrades(questions: ExamQuestion[], raw: RawPayload): AiQuestionGrade[] {
  const byQ = new Map(raw.questions?.map((q) => [q.questionId, q]) ?? []);

  return questions.map((q) => {
    const rq = byQ.get(q.id);
    const rSteps = new Map(rq?.steps?.map((s) => [s.stepId, s]) ?? []);

    const steps: AiStepGrade[] = q.steps.map((st) => {
      const rs = rSteps.get(st.id);
      const max = st.marks;
      let awarded = typeof rs?.awarded === "number" && Number.isFinite(rs.awarded) ? rs.awarded : 0;
      awarded = Math.min(max, Math.max(0, awarded));
      const confidence: StepConfidence = isConfidence(rs?.confidence) ? rs.confidence : "medium";
      const ok = typeof rs?.ok === "boolean" ? rs.ok : true;
      const justification =
        typeof rs?.justification === "string" && rs.justification.trim()
          ? rs.justification.trim()
          : "No grading rationale was returned for this sub-part; re-run grading if you need award/deduction reasoning.";
      return {
        stepId: st.id,
        subPartLabel: st.subPartLabel,
        stepMax: max,
        awarded,
        justification,
        confidence,
        ok,
        llmRubricBlock: formatExamStepRubricForPrompt(st),
      };
    });

    const aiAwarded = steps.reduce((s, x) => s + x.awarded, 0);
    const maxMarks = q.steps.reduce((s, st) => s + st.marks, 0);

    return {
      questionId: q.id,
      label: `Q${q.questionNo}`,
      maxMarks,
      aiAwarded,
      steps,
    };
  });
}

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

  const script = form.get("script");
  if (!(script instanceof Blob) || script.size === 0) {
    return NextResponse.json({ error: "Missing or empty student script PDF." }, { status: 400 });
  }

  const answerKey = form.get("answerKey");
  if (!(answerKey instanceof Blob) || answerKey.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty answer key PDF. Upload an answer key in step 2 before grading." },
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
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON." }, { status: 400 });
  }

  const questions = payload.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "No questions in payload." }, { status: 400 });
  }

  const strictness = payload.strictness ?? "conceptual";
  const examName = payload.examName?.trim() || "Exam";

  const scriptBuf = Buffer.from(await script.arrayBuffer());
  const keyBuf = Buffer.from(await answerKey.arrayBuffer());
  const maxBytes = 32 * 1024 * 1024;
  if (scriptBuf.byteLength > maxBytes || keyBuf.byteLength > maxBytes) {
    return NextResponse.json({ error: "Each PDF must be 32MB or smaller." }, { status: 413 });
  }

  const scriptDataUrl = `data:application/pdf;base64,${scriptBuf.toString("base64")}`;
  const answerKeyDataUrl = `data:application/pdf;base64,${keyBuf.toString("base64")}`;

  const rubricText = buildUserRubricText(questions as ExamQuestion[]);
  const strictnessLine = strictnessUserLine(strictness);

  const schemaHint = `Return a single JSON object with this shape:
{
  "questions": [
    {
      "questionId": "<exact id from rubric>",
      "steps": [
        {
          "stepId": "<exact id from rubric>",
          "awarded": <number>,
          "justification": "<required: 2–5 sentences. State awarded vs step max; what earned the marks; if not full marks, clearly explain deductions (what was missing/wrong vs answer key or rubric); if full marks, briefly confirm correctness.>",
          "confidence": "high" | "medium" | "low",
          "ok": <boolean>
        }
      ]
    }
  ]
}
Include every questionId and every stepId from the rubric. Do not omit steps. Every step must have a substantive justification, not a single word.`;

  const userText = `Exam: ${examName}

${strictnessLine}

You are given two PDF attachments in this order:
1) **Official answer key** — use this as the reference solution when judging correctness and partial credit.
2) **Student script** — this is what you grade; award marks only for work visible here.

${schemaHint}

--- RUBRIC (sub-parts, explanations, max sub-marks per stepId) ---
${rubricText}
--- END RUBRIC ---

Grade the student script (2nd PDF) using the answer key (1st PDF) and the rubric above. Respect each step’s maximum marks and the instructor strictness line. For each sub-part, the justification field is mandatory: it must make the award/deduction reasoning transparent to an instructor reviewing your marks.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(strictness) },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "file",
              file: {
                filename: "answer-key.pdf",
                file_data: answerKeyDataUrl,
              },
            },
            {
              type: "file",
              file: {
                filename: "student-script.pdf",
                file_data: scriptDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }

    let parsed: RawPayload;
    try {
      parsed = JSON.parse(text) as RawPayload;
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON." }, { status: 502 });
    }

    const grades = enrichGrades(questions as ExamQuestion[], parsed);
    return NextResponse.json({ grades });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI request failed.";
    console.error("[answer-scripts/grade]", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
