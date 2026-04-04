import type { ExamStep } from "./types";

/**
 * Text block for the LLM for each sub-step: label, what it assesses, and max sub-marks.
 * Partial credit follows the professor’s strictness (system prompt + user message).
 */
export function formatExamStepRubricForPrompt(step: ExamStep): string {
  const label = (step.subPartLabel || "(part)").trim();
  const desc = (step.description || "").trim();
  const max = step.marks;
  const lines = [
    `Sub-part label: ${label}`,
    desc ? `What this part assesses: ${desc}` : "What this part assesses: (see answer key PDF for expected working)",
    `Maximum marks allocatable for this sub-part only: ${max} (award a number from 0 to ${max} inclusive).`,
    `Compare the student’s script against both the official answer key PDF and this description when deciding marks.`,
  ];
  return lines.join("\n");
}
