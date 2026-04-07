import type { AiQuestionGrade, ExamQuestion, ExamStep } from "@/components/answer-scripts-evaluation/types";

/** Rebuild exam tree from AI grades for review sidebar (after PDF-derived grading). */
export function examQuestionsFromAiGrades(grades: AiQuestionGrade[]): ExamQuestion[] {
  return grades.map((q) => {
    const no = parseInt(q.label.replace(/[^\d]/g, ""), 10);
    return {
      id: q.questionId,
      questionNo: Number.isFinite(no) && no > 0 ? no : 1,
      steps: q.steps.map((st): ExamStep => ({
        id: st.stepId,
        subPartLabel: st.subPartLabel,
        description: st.llmRubricBlock ? extractAssessesLine(st.llmRubricBlock) : "",
        marks: st.stepMax,
      })),
    };
  });
}

function extractAssessesLine(block: string): string {
  const m = block.match(/What this part assesses:\s*([^\n]+)/i);
  return m ? m[1].trim() : "";
}
