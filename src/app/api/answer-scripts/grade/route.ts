import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { AiQuestionGrade, AiStepGrade, ExamQuestion, StepConfidence } from "@/components/answer-scripts-evaluation/types";
import { formatExamStepRubricForPrompt } from "@/components/answer-scripts-evaluation/rubric-prompt";

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

function buildSystemPrompt(strictness: string): string {
  return `You are an expert exam grader. You will see a student's exam script as a PDF and a structured rubric.

Rules:
- Award marks only according to the professor's rubric for each sub-part (scoring bands and max marks).
- If the rubric lists discrete scores (e.g. 2 = Correct, 1 = Minor mistake), you must choose one of those scores for "awarded" unless the rubric allows a continuous range (no bands).
- "awarded" must be between 0 and the step maximum marks inclusive.
- "confidence": high if the PDF clearly supports your mark; medium if somewhat ambiguous; low if handwriting/layout makes marking uncertain.
- "ok" should be true when the work clearly meets the band you chose; false if borderline or concerning.
- Evaluation strictness mode: "${strictness}" — exact: follow literal rubric; conceptual: reward correct reasoning; partial: generous partial credit within bands.

Respond with valid JSON only, matching the schema in the user message.`;
}

function buildUserRubricText(questions: ExamQuestion[]): string {
  let out = "";
  for (const q of questions) {
    out += `\n## Question ${q.questionNo} (questionId: ${q.id})\n`;
    for (const st of q.steps) {
      out += `\n### Sub-part ${st.subPartLabel} (stepId: ${st.id})\n`;
      out += formatExamStepRubricForPrompt(st);
      out += "\n";
    }
  }
  return out;
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
          : "No justification returned; defaulting from model output.";
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
    return NextResponse.json({ error: "Missing or empty script PDF." }, { status: 400 });
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

  const buf = Buffer.from(await script.arrayBuffer());
  if (buf.byteLength > 32 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF exceeds 32MB limit." }, { status: 413 });
  }

  const base64 = buf.toString("base64");
  /** OpenAI requires a data URL with MIME type, not raw base64. */
  const pdfDataUrl = `data:application/pdf;base64,${base64}`;

  const rubricText = buildUserRubricText(questions as ExamQuestion[]);
  const schemaHint = `Return a single JSON object with this shape:
{
  "questions": [
    {
      "questionId": "<exact id from rubric>",
      "steps": [
        {
          "stepId": "<exact id from rubric>",
          "awarded": <number>,
          "justification": "<short reason referencing what you saw in the script>",
          "confidence": "high" | "medium" | "low",
          "ok": <boolean>
        }
      ]
    }
  ]
}
Include every questionId and every stepId from the rubric. Do not omit steps.`;

  const userText = `Exam: ${examName}

${schemaHint}

--- RUBRIC ---
${rubricText}
--- END RUBRIC ---

Grade the attached student script PDF against this rubric.`;

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
                filename: "student-script.pdf",
                file_data: pdfDataUrl,
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
