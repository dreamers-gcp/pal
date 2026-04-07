import OpenAI from "openai";
import type { ExamQuestion, ExamStep } from "@/components/answer-scripts-evaluation/types";

const DEFAULT_MAX_PER_QUESTION = 10;

type ExtractedStep = {
  stepId: string;
  subPartLabel?: string;
  description?: string;
  stepMax?: number;
  correctAnswer?: string;
};

type ExtractedQuestion = {
  questionId: string;
  questionNo?: number;
  label?: string;
  steps?: ExtractedStep[];
};

export type ExtractionPayload = { questions?: ExtractedQuestion[] };

export async function extractRubricFromKey(
  openai: OpenAI,
  model: string,
  keyDataUrl: string,
  examName: string
): Promise<ExtractionPayload> {
  const systemPrompt = `You are reading a professor's answer key PDF. It may also contain a marking scheme (marks per question/sub-part), or it may contain ONLY the correct answers without any marks.

Your job is to extract every question and sub-part with:
- The question structure and identifiers
- Maximum marks per sub-part. IMPORTANT: if the PDF explicitly states marks for a question/sub-part, use those exact values. If the PDF does NOT contain any marking scheme or mark allocation at all, set stepMax to ${DEFAULT_MAX_PER_QUESTION} for each question (default).
- The COMPLETE correct answer for each sub-part — include all specific numerical values, formulas, steps, diagrams, conclusions

Output structured JSON only. Be thorough: every number, every formula, every conclusion matters.`;

  const userText = `Read the attached answer key PDF for exam "${examName}".

The PDF may or may not include a marking scheme:
- If marks per question/sub-part ARE specified → use them as stepMax
- If NO marking scheme is present (only answers) → use ${DEFAULT_MAX_PER_QUESTION} as stepMax for each question

Return JSON:
{
  "questions": [
    {
      "questionId": "q1",
      "questionNo": 1,
      "label": "Q1",
      "steps": [
        {
          "stepId": "q1_a",
          "subPartLabel": "(a)",
          "description": "<what this sub-part tests>",
          "stepMax": <marks from marking scheme if present, otherwise ${DEFAULT_MAX_PER_QUESTION}>,
          "correctAnswer": "<the FULL correct answer — include every specific value, formula, intermediate step, and final result>"
        }
      ]
    }
  ]
}

Include every question and sub-part from the PDF. Do not omit any.`;

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "file",
            file: { filename: "answer-key.pdf", file_data: keyDataUrl },
          },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from rubric extraction.");
  return JSON.parse(text) as ExtractionPayload;
}

export function extractionToQuestions(extracted: ExtractionPayload): ExamQuestion[] {
  return (extracted.questions ?? []).map((q, idx) => ({
    id: q.questionId,
    questionNo:
      typeof q.questionNo === "number" && q.questionNo > 0 ? q.questionNo : idx + 1,
    steps: (q.steps ?? []).map(
      (st): ExamStep => ({
        id: st.stepId,
        subPartLabel: (st.subPartLabel ?? "(part)").trim(),
        description: (st.description ?? "").trim(),
        marks:
          typeof st.stepMax === "number" && st.stepMax > 0
            ? st.stepMax
            : DEFAULT_MAX_PER_QUESTION,
      })
    ),
  }));
}

export function extractionToSummary(extracted: ExtractionPayload): string {
  let text =
    "=== CORRECT ANSWERS (extracted from professor's answer key — this is NOT the student's work) ===\n";
  for (const q of extracted.questions ?? []) {
    const qNo = q.questionNo ?? 0;
    text += `\nQuestion ${qNo} (questionId: ${q.questionId}):\n`;
    for (const st of q.steps ?? []) {
      const max =
        typeof st.stepMax === "number" ? st.stepMax : DEFAULT_MAX_PER_QUESTION;
      text += `  ${st.subPartLabel ?? "(part)"} [stepId: ${st.stepId}, max ${max} marks]:\n`;
      if (st.description) text += `    Tests: ${st.description}\n`;
      text += `    CORRECT ANSWER: ${st.correctAnswer ?? "(not specified)"}\n`;
    }
  }
  text += "\n=== END CORRECT ANSWERS ===";
  return text;
}
