import type {
  AiQuestionGrade,
  AiStepGrade,
  ExamQuestion,
  StepConfidence,
} from "@/components/answer-scripts-evaluation/types";
import { formatExamStepRubricForPrompt } from "@/components/answer-scripts-evaluation/rubric-prompt";
import type { CanonicalRubric } from "./rubric-schema";
import type { GradePaperResult } from "./grade-paper";

function verdictToConfidence(s: "full" | "partial" | "missing"): StepConfidence {
  if (s === "full") return "high";
  if (s === "partial") return "medium";
  return "low";
}

export function canonicalRubricToExamQuestions(rubric: CanonicalRubric): ExamQuestion[] {
  return rubric.questions.map((q) => ({
    id: `q${q.question_id ?? q.id}`,
    questionNo: q.question_id ?? q.id,
    steps: q.steps.map((st) => ({
      id: st.step_id,
      subPartLabel: st.step_id,
      description: st.description.trim() || "(rubric step)",
      marks: st.marks,
    })),
  }));
}

export function canonicalRubricToAnswerKeySummary(rubric: CanonicalRubric): string {
  let text =
    "=== CORRECT ANSWERS (canonical rubric from answer key — NOT the student's work) ===\n";
  for (const q of rubric.questions) {
    const qid = q.question_id ?? q.id;
    text += `\nQuestion ${qid} (questionId: q${qid}):\n`;
    text += `Question text: ${q.question_text}\n`;
    text += `Correct answer (whole question): ${q.correct_answer}\n`;
    text += `Method locked: ${String(q.method_locked)}\n`;
    for (const st of q.steps) {
      text += `  stepId: ${st.step_id} — max ${st.marks} marks\n`;
      text += `    Description: ${st.description}\n`;
      text += `    Expected: ${st.expected}\n`;
    }
    const notes = (q.partial_credit_notes ?? []).filter((n): n is string => typeof n === "string");
    if (notes.length) text += `  Partial credit notes:\n${notes.map((n) => `    - ${n}`).join("\n")}\n`;
  }
  return `${text}\n=== END CORRECT ANSWERS ===`;
}

export function gradeResultToAiGrades(
  lockedQuestions: ExamQuestion[],
  gradeResult: GradePaperResult
): AiQuestionGrade[] {
  const byQid = new Map(gradeResult.questions.map((qr) => [qr.question_id, qr]));
  return lockedQuestions.map((q) => {
    const m = /^q(\d+)$/i.exec(q.id);
    const qidNum = m ? Number(m[1]) : NaN;
    const qr = Number.isFinite(qidNum) ? byQid.get(qidNum) : undefined;

    const steps: AiStepGrade[] = q.steps.map((st) => {
      const sr = qr?.steps.find((x) => x.step.step_id === st.id);
      const awarded = sr
        ? Math.min(st.marks, Math.max(0, Number(sr.verdict.marks_awarded) || 0))
        : 0;
      const justification = sr
        ? `[${sr.verdict.satisfied}] ${sr.verdict.rationale} Evidence: ${(sr.verdict.evidence || "(none)").trim()}`
        : "Missing grading row for this step.";
      return {
        stepId: st.id,
        subPartLabel: st.subPartLabel,
        stepMax: st.marks,
        awarded,
        justification,
        confidence: sr ? verdictToConfidence(sr.verdict.satisfied) : "low",
        ok: sr ? sr.verdict.satisfied !== "missing" : false,
        llmRubricBlock: `${formatExamStepRubricForPrompt(st)}\nExpected (from key): ${sr?.step.expected ?? ""}`,
      };
    });

    return {
      questionId: q.id,
      label: `Q${q.questionNo}`,
      maxMarks: q.steps.reduce((s, x) => s + x.marks, 0),
      aiAwarded: steps.reduce((s, x) => s + x.awarded, 0),
      steps,
    };
  });
}
