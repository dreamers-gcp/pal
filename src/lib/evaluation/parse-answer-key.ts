import type OpenAI from "openai";
import type { CanonicalRubric } from "./rubric-schema";
import { normalizeRubric, validateRubric } from "./rubric-schema";
import { chatJsonSchema } from "./openai-json-schema";

/** Same schema as `Documents/evaluation/src/parse_key.py` `RUBRIC_SCHEMA`. */
export const RUBRIC_PARSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["exam_title", "questions"],
  properties: {
    exam_title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "question_text",
          "total_marks",
          "correct_answer",
          "method_locked",
          "steps",
          "partial_credit_notes",
        ],
        properties: {
          id: { type: "integer" },
          question_text: { type: "string" },
          total_marks: { type: "number" },
          correct_answer: { type: "string" },
          method_locked: { type: "boolean" },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["step_id", "description", "expected", "marks"],
              properties: {
                step_id: { type: "string" },
                description: { type: "string" },
                expected: { type: "string" },
                marks: { type: "number" },
              },
            },
          },
          partial_credit_notes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["step_id", "scenario", "marks"],
              properties: {
                step_id: { type: "string" },
                scenario: { type: "string" },
                marks: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
} as const;

const PARSE_PROMPT = `You are extracting an answer-key document into a strict canonical rubric JSON.

The document follows a fixed template with bold field labels:
  - "Question:" / "Question Text:"
  - "Total Marks:"
  - "Correct Answer:"
  - "Method Locked:" (Yes / No)
  - A "Steps" table with columns: Step ID | Description | Expected | Marks
  - "Partial Credit Notes:" — bullets in the form "Step <id> — <scenario> → <marks> marks"

Rules:
- Extract every question. \`id\` is an integer (1..N) from the question heading.
- For each step, copy \`step_id\`, \`description\`, \`expected\`, \`marks\` exactly. Do not paraphrase \`expected\`.
- \`method_locked\` = true if the document says Yes (or the question text explicitly mandates a method); false otherwise.
- For each partial-credit bullet, parse it into \`{step_id, scenario, marks}\`. If a bullet doesn't reference a step, use the closest step's id.
- Sum of step marks for each question MUST equal \`total_marks\`. Do not silently fix mismatches — extract what is written.`;

export async function parseAnswerKeyPdfToRubric(
  openai: OpenAI,
  model: string,
  keyDataUrl: string
): Promise<CanonicalRubric> {
  const { parsed } = await chatJsonSchema<CanonicalRubric>(
    openai,
    model,
    [
      { role: "system", content: PARSE_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the answer key into the canonical rubric JSON." },
          { type: "file", file: { filename: "answer-key.pdf", file_data: keyDataUrl } },
        ],
      },
    ],
    "rubric",
    RUBRIC_PARSE_JSON_SCHEMA as unknown as Record<string, unknown>
  );

  const rubric = normalizeRubric(parsed);
  const errors = validateRubric(rubric);
  if (errors.length) {
    throw new Error(`Rubric validation failed:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
  }
  return rubric;
}
