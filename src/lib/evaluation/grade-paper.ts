import type OpenAI from "openai";
import type { CanonicalRubric, CanonicalRubricQuestion, CanonicalRubricStep } from "./rubric-schema";
import { normalizeMathText } from "./normalize-math";
import { stableHash } from "./stable-hash";
import { chatJsonSchema } from "./openai-json-schema";
import type { TranscriptionCore, TranscriptionRecord } from "./transcribe-script";

/** Ported from `Documents/evaluation/src/grade.py`. */
export const STEP_VERDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["satisfied", "marks_awarded", "evidence", "rationale"],
  properties: {
    satisfied: { type: "string", enum: ["full", "partial", "missing"] },
    marks_awarded: { type: "number" },
    evidence: {
      type: "string",
      description:
        "Quote (or empty string) from the student's transcription that supports the verdict.",
    },
    rationale: { type: "string" },
  },
} as const;

export const ALT_PATH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["valid_alternative", "rationale"],
  properties: {
    valid_alternative: { type: "boolean" },
    rationale: { type: "string" },
  },
} as const;

const GRADE_STEP_PROMPT_BASE = `You are grading ONE rubric step in isolation. Be strict and literal.

You will receive:
- The question.
- One rubric step with: description, expected content, max marks.
- The student's full transcribed work for this question.
- Partial-credit notes (if any) from the answer key.

Output:
- satisfied = "full" if the student clearly produced the expected content.
- satisfied = "partial" if the student showed some but not all of the expected content (use partial-credit notes to guide).
- satisfied = "missing" if the student did not produce this step's content at all.
- marks_awarded must be in [0, max_marks]. For "full" award max_marks. For "missing" award 0. For "partial" choose a value consistent with the partial-credit notes.
- evidence: quote the exact lines from the transcription that justify the verdict. Empty string if missing.
- rationale: ONE concise sentence.`;

const ALT_PATH_PROMPT = `The rubric expects a specific method, but the student used a different approach. Decide whether the student's approach is mathematically valid AND reaches the correct final answer.

Output:
- valid_alternative = true ONLY if BOTH (a) the method is mathematically sound for the question and (b) the student's final answer matches the rubric's correct answer.
- rationale: one short sentence.`;

export type StepVerdict = {
  satisfied: "full" | "partial" | "missing";
  marks_awarded: number;
  evidence: string;
  rationale: string;
  self_consistency?: { samples: Record<string, number>; n: number };
  alternative_path?: boolean;
};

export type GradedStepRow = { step: CanonicalRubricStep; verdict: StepVerdict };

export type GradedQuestionResult = {
  question_id: number;
  question_text: string;
  total_marks: number;
  marks_awarded: number;
  correct_answer: string;
  student_final_answer: string;
  alt_path_used: boolean;
  steps: GradedStepRow[];
};

export type GradePaperResult = {
  source_pdf: string | undefined;
  total_awarded: number;
  total_possible: number;
  needs_review: boolean;
  flags: string[];
  questions: GradedQuestionResult[];
};

function strictnessBlock(strictness: string): string {
  if (strictness === "exact")
    return `GRADING MODE: EXACT — match the expected content closely; conservative partial credit.`;
  if (strictness === "partial")
    return `GRADING MODE: GENEROUS PARTIAL — reward incomplete but relevant work when aligned with partial-credit notes.`;
  return `GRADING MODE: CONCEPTUAL — reward correct reasoning even if wording differs, as long as expected content is satisfied.`;
}

function getGradeCache(): Map<string, unknown> {
  const g = globalThis as unknown as { __nucleusEvalGradeCache?: Map<string, unknown> };
  if (!g.__nucleusEvalGradeCache) g.__nucleusEvalGradeCache = new Map();
  return g.__nucleusEvalGradeCache;
}

async function cachedCallAsync<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cache = getGradeCache();
  if (cache.has(key)) return cache.get(key) as T;
  const v = await fn();
  cache.set(key, v as unknown);
  return v;
}

function buildGradeStepPrompt(strictness: string): string {
  return `${GRADE_STEP_PROMPT_BASE}\n\n${strictnessBlock(strictness)}`;
}

async function gradeStepCall(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  question: CanonicalRubricQuestion,
  step: CanonicalRubricStep,
  studentLines: string[],
  partialNotes: string[]
): Promise<StepVerdict> {
  const userText =
    `QUESTION: ${question.question_text}\n\n` +
    `RUBRIC STEP: ${step.description}\n` +
    `EXPECTED: ${step.expected}\n` +
    `MAX MARKS: ${step.marks}\n\n` +
    `PARTIAL CREDIT NOTES:\n` +
    (partialNotes.length ? partialNotes.map((n) => `- ${n}`).join("\n") : "(none)") +
    "\n\nSTUDENT'S TRANSCRIBED WORK:\n" +
    (studentLines.length ? studentLines.join("\n") : "(no work shown)");

  const { parsed } = await chatJsonSchema<StepVerdict>(
    openai,
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ],
    "step_verdict",
    STEP_VERDICT_JSON_SCHEMA as unknown as Record<string, unknown>
  );
  return parsed;
}

async function gradeStep(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  question: CanonicalRubricQuestion,
  step: CanonicalRubricStep,
  studentLines: string[],
  partialNotes: string[]
): Promise<StepVerdict> {
  const normLines = studentLines.map((l) => normalizeMathText(l));
  const cacheKey = stableHash({
    step,
    lines: normLines,
    partial_notes: partialNotes,
    question_text: question.question_text,
    strictnessTag: systemPrompt.slice(-40),
  });

  const verdict = await cachedCallAsync(cacheKey, () =>
    gradeStepCall(openai, model, systemPrompt, question, step, studentLines, partialNotes)
  );

  let v = { ...verdict };
  if (v.satisfied === "partial") {
    const scKey = `${cacheKey}_sc`;
    v = await cachedCallAsync(scKey, async () => {
      const s1 = await gradeStepCall(
        openai,
        model,
        systemPrompt,
        question,
        step,
        studentLines,
        partialNotes
      );
      const s2 = await gradeStepCall(
        openai,
        model,
        systemPrompt,
        question,
        step,
        studentLines,
        partialNotes
      );
      const samples: StepVerdict[] = [v, { ...s1 }, { ...s2 }];

      const tally: Record<string, number> = {};
      for (const s of samples) {
        tally[s.satisfied] = (tally[s.satisfied] ?? 0) + 1;
      }
      const winningLabel = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]![0] as StepVerdict["satisfied"];
      const winners = samples.filter((s) => s.satisfied === winningLabel);
      const avgMarks =
        Math.round((winners.reduce((sum, s) => sum + s.marks_awarded, 0) / winners.length) * 100) / 100;
      const chosen = { ...winners[0]! };
      chosen.marks_awarded = avgMarks;
      chosen.self_consistency = { samples: tally, n: samples.length };
      return chosen;
    });
  }

  v.marks_awarded = Math.max(0, Math.min(step.marks, Number(v.marks_awarded) || 0));
  return v;
}

async function altPathCheck(
  openai: OpenAI,
  model: string,
  question: CanonicalRubricQuestion,
  studentLines: string[],
  studentFinal: string
): Promise<{ valid_alternative: boolean; rationale: string }> {
  const cacheKey = stableHash({
    alt_path: true,
    question_id: question.question_id ?? question.id,
    lines: studentLines.map((l) => normalizeMathText(l)),
    final: normalizeMathText(studentFinal),
    correct: normalizeMathText(question.correct_answer),
  });

  return cachedCallAsync(cacheKey, async () => {
    const userText =
      `QUESTION: ${question.question_text}\n` +
      `RUBRIC'S CORRECT ANSWER: ${question.correct_answer}\n\n` +
      `STUDENT'S WORK:\n${studentLines.join("\n")}\n\n` +
      `STUDENT'S FINAL ANSWER: ${studentFinal}`;

    const { parsed } = await chatJsonSchema<{ valid_alternative: boolean; rationale: string }>(
      openai,
      model,
      [
        { role: "system", content: ALT_PATH_PROMPT },
        { role: "user", content: userText },
      ],
      "alt_path",
      ALT_PATH_JSON_SCHEMA as unknown as Record<string, unknown>
    );
    return parsed;
  });
}

export async function gradePaperFromTranscription(
  openai: OpenAI,
  model: string,
  strictness: string,
  transcription: TranscriptionRecord,
  rubric: CanonicalRubric
): Promise<GradePaperResult> {
  const core: TranscriptionCore = transcription.transcription;
  const answersById = new Map(core.answers.map((a) => [a.question_id, a]));
  const disagreements = new Set(transcription.transcription_disagreements ?? []);
  const legibility = transcription.legibility;

  const flags: string[] = [];
  if (legibility === "poor") flags.push("legibility_poor");

  const systemPrompt = buildGradeStepPrompt(strictness);
  const questionResults: GradedQuestionResult[] = [];

  for (const q of rubric.questions) {
    const qid = q.question_id ?? q.id;
    const student = answersById.get(qid);
    const studentLines = student?.lines ?? [];
    const studentFinal = student?.final_answer ?? "";

    const stepResults: GradedStepRow[] = [];
    let anyPartial = false;
    let anyMissing = false;

    const partialNotes = (q.partial_credit_notes ?? []).filter(
      (n): n is string => typeof n === "string"
    );

    for (const step of q.steps) {
      const verdict = await gradeStep(
        openai,
        model,
        systemPrompt,
        q,
        step,
        studentLines,
        partialNotes
      );
      stepResults.push({ step, verdict });
      if (verdict.satisfied === "partial") anyPartial = true;
      if (verdict.satisfied === "missing") anyMissing = true;
    }

    let altPathUsed = false;
    if (
      !q.method_locked &&
      anyMissing &&
      studentFinal &&
      normalizeMathText(studentFinal) === normalizeMathText(q.correct_answer)
    ) {
      const alt = await altPathCheck(openai, model, q, studentLines, studentFinal);
      if (alt.valid_alternative) {
        altPathUsed = true;
        flags.push(`q${qid}_alternative_path`);
        for (const sr of stepResults) {
          if (sr.verdict.satisfied === "missing") {
            sr.verdict.marks_awarded = sr.step.marks;
            sr.verdict.satisfied = "full";
            sr.verdict.rationale = `Awarded via alternative-path check: ${alt.rationale}`;
            sr.verdict.alternative_path = true;
          }
        }
      }
    }

    if (anyPartial) flags.push(`q${qid}_has_partial_step`);
    if (disagreements.has(qid)) flags.push(`q${qid}_transcription_disagreement`);
    if (!student) flags.push(`q${qid}_no_answer_found`);

    const awarded =
      Math.round(stepResults.reduce((s, sr) => s + sr.verdict.marks_awarded, 0) * 100) / 100;
    questionResults.push({
      question_id: qid,
      question_text: q.question_text,
      total_marks: q.total_marks,
      marks_awarded: awarded,
      correct_answer: q.correct_answer,
      student_final_answer: studentFinal,
      alt_path_used: altPathUsed,
      steps: stepResults,
    });
  }

  const totalAwarded =
    Math.round(questionResults.reduce((s, qr) => s + qr.marks_awarded, 0) * 100) / 100;
  const totalPossible = rubric.questions.reduce((s, q) => s + q.total_marks, 0);

  return {
    source_pdf: transcription.source_pdf,
    total_awarded: totalAwarded,
    total_possible: totalPossible,
    needs_review: flags.length > 0,
    flags,
    questions: questionResults,
  };
}
