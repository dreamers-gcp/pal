import type { ExamStep, ScoringBand } from "./types";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default bands for a new step: integer marks → descending scores with simple labels. */
export function defaultScoringBands(marks: number): ScoringBand[] {
  if (marks <= 0) return [];
  const m = Math.floor(marks);
  if (Math.abs(marks - m) > 1e-9) {
    return [{ id: newId("band"), score: marks, criterion: "Full credit" }];
  }
  const rows: ScoringBand[] = [];
  for (let s = m; s >= 0; s--) {
    let criterion = "";
    if (s === m) criterion = "Correct";
    else if (s === 0) criterion = "Wrong";
    else if (m === 2 && s === 1) criterion = "Minor mistake";
    else criterion = "Partial credit";
    rows.push({ id: newId("band"), score: s, criterion });
  }
  return rows;
}

/**
 * Text block to inject into an LLM system/user prompt for this sub-step.
 * Example:
 *   Objective function (2 marks)
 *   2 = Correct
 *   1 = Minor mistake
 *   0 = Wrong
 */
export function formatExamStepRubricForPrompt(step: ExamStep): string {
  const title = (step.description || `Part ${step.subPartLabel}`).trim();
  const lines: string[] = [`${title} (${step.marks} marks)`];
  const bands = step.scoringBands ?? [];
  if (bands.length === 0) {
    lines.push(
      `Award any score from 0 to ${step.marks} consistent with the expected solution and these marking conventions.`
    );
    return lines.join("\n");
  }
  const sorted = [...bands].sort((a, b) => b.score - a.score);
  for (const b of sorted) {
    const crit = (b.criterion || "—").trim();
    lines.push(`${b.score} = ${crit}`);
  }
  return lines.join("\n");
}
