import type { ExamStep } from "./types";

/**
 * Text block for the LLM for each sub-step: label, what it assesses, and max sub-marks.
 */
export function formatExamStepRubricForPrompt(step: ExamStep): string {
  const label = (step.subPartLabel || "(part)").trim();
  const desc = (step.description || "").trim();
  const max = step.marks;
  const lines = [
    `Sub-part label: ${label}`,
    desc ? `What this part assesses: ${desc}` : "What this part assesses: (see master answer key PDF for expected working)",
    `Maximum marks for this sub-part: ${max} (award 0 to ${max} inclusive).`,
    `Award marks only for what the student visibly wrote in their answer script (PDF 2). The master answer key (PDF 1) is reference only.`,
  ];
  return lines.join("\n");
}
