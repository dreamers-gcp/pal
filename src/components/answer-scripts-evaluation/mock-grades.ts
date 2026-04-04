import type { AiQuestionGrade, ExamQuestion, StepConfidence } from "./types";
import { formatExamStepRubricForPrompt } from "./rubric-prompt";

export function buildMockAiGrades(questions: ExamQuestion[], seed: string): AiQuestionGrade[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h & 0xffff) / 65536;
  };
  const confs: StepConfidence[] = ["high", "medium", "low"];

  return questions.map((q) => {
    const steps = q.steps.map((st) => {
      const max = st.marks;
      const raw = (0.45 + rand() * 0.5) * max;
      const awarded = Math.min(max, Math.round(raw * 2) / 2);
      const confidence = confs[Math.floor(rand() * 3)];
      const ok = confidence === "high" || (confidence === "medium" && rand() > 0.2);
      const llmRubricBlock = formatExamStepRubricForPrompt(st);
      const okJust = `Working aligns with rubric for ${st.subPartLabel}${st.description ? `: ${st.description.slice(0, 72)}` : ""}.`;
      const badJust = `Incomplete derivation; expected clearer justification for ${st.subPartLabel}.`;
      return {
        stepId: st.id,
        subPartLabel: st.subPartLabel,
        stepMax: max,
        awarded,
        llmRubricBlock,
        justification: ok ? okJust : badJust,
        confidence,
        ok,
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
