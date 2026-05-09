import type OpenAI from "openai";
import { normalizeMathText } from "./normalize-math";
import { chatJsonSchema } from "./openai-json-schema";

export const TRANSCRIPTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers", "legibility"],
  properties: {
    legibility: {
      type: "string",
      enum: ["clear", "mostly_clear", "poor"],
    },
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "lines", "final_answer", "notes"],
        properties: {
          question_id: { type: "integer" },
          lines: {
            type: "array",
            items: { type: "string" },
            description:
              "One entry per line of the student's working, in order. Use plain math notation (x^2, *, /, =).",
          },
          final_answer: {
            type: "string",
            description:
              "The student's stated final answer for this question. Empty string if none.",
          },
          notes: {
            type: "string",
            description:
              "Transcription notes only (e.g. 'illegible token', 'crossed out'). Never grading commentary.",
          },
        },
      },
    },
  },
} as const;

const TRANSCRIBE_PROMPT = `You are transcribing a handwritten student exam paper. TRANSCRIPTION ONLY.

STRICT RULES:
- Transcribe exactly what is written. Do NOT correct mistakes. Do NOT fill in steps the student skipped. Do NOT evaluate.
- Use plain math notation: x^2, *, /, sqrt(), =, etc. Strip currency symbols and units that aren't part of an equation.
- Group lines by question number as written on the page (1, 2, 3, ...).
- If a token is unreadable, write [?] and mention it in \`notes\`.
- \`legibility\` reflects the page overall: clear / mostly_clear / poor.
- \`final_answer\` is the student's last stated value for the question (e.g. "x = 6", "640", "25 m"). Empty if absent.`;

export type TranscriptionCore = {
  answers: Array<{
    question_id: number;
    lines: string[];
    final_answer: string;
    notes: string;
  }>;
  legibility: "clear" | "mostly_clear" | "poor";
};

export type TranscriptionRecord = {
  source_pdf: string;
  legibility: TranscriptionCore["legibility"];
  transcription: TranscriptionCore;
  transcription_alt: TranscriptionCore;
  transcription_disagreements: number[];
};

function diffAnswers(a: TranscriptionCore, b: TranscriptionCore): number[] {
  const byIdA = new Map(a.answers.map((x) => [x.question_id, x]));
  const byIdB = new Map(b.answers.map((x) => [x.question_id, x]));
  const ids = new Set([...byIdA.keys(), ...byIdB.keys()]);
  const disagreements: number[] = [];
  for (const qid of [...ids].sort((x, y) => x - y)) {
    const aa = byIdA.get(qid);
    const bb = byIdB.get(qid);
    if (!aa || !bb) {
      disagreements.push(qid);
      continue;
    }
    const normA = normalizeMathText(aa.lines.join(" "));
    const normB = normalizeMathText(bb.lines.join(" "));
    const normFa = normalizeMathText(aa.final_answer);
    const normFb = normalizeMathText(bb.final_answer);
    if (normA !== normB || normFa !== normFb) disagreements.push(qid);
  }
  return disagreements;
}

async function transcribeOnce(
  openai: OpenAI,
  model: string,
  scriptDataUrl: string
): Promise<TranscriptionCore> {
  const { parsed } = await chatJsonSchema<TranscriptionCore>(
    openai,
    model,
    [
      { role: "system", content: TRANSCRIBE_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this student paper." },
          {
            type: "file",
            file: { filename: "student-answer-script.pdf", file_data: scriptDataUrl },
          },
        ],
      },
    ],
    "transcription",
    TRANSCRIPTION_JSON_SCHEMA as unknown as Record<string, unknown>
  );
  return parsed;
}

export async function transcribeStudentPdf(
  openai: OpenAI,
  model: string,
  scriptDataUrl: string,
  sourceName: string
): Promise<TranscriptionRecord> {
  const pass1 = await transcribeOnce(openai, model, scriptDataUrl);
  const pass2 = await transcribeOnce(openai, model, scriptDataUrl);
  const transcription_disagreements = diffAnswers(pass1, pass2);
  return {
    source_pdf: sourceName,
    legibility: pass1.legibility,
    transcription: pass1,
    transcription_alt: pass2,
    transcription_disagreements,
  };
}
