import type { AiQuestionGrade } from "./types";

export function downloadEvaluationCsv(
  rows: { rollNo: string; name: string; scores: Record<string, number>; total: number }[],
  questionLabels: string[]
) {
  const headers = ["roll_no", "name", ...questionLabels.map((_, i) => `q${i + 1}`), "total"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const cells = [
        escapeCsv(r.rollNo),
        escapeCsv(r.name),
        ...questionLabels.map((_, i) => String(r.scores[`q${i + 1}`] ?? "")),
        String(r.total),
      ];
      return cells.join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `answer-script-scores-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeCsv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsvRowsFromGrades(
  students: { id: string; rollNo: string; name: string }[],
  gradeMap: Map<string, { questions: AiQuestionGrade[]; overrides: Record<string, number> }>
): { rollNo: string; name: string; scores: Record<string, number>; total: number }[] {
  return students.map((s) => {
    const g = gradeMap.get(s.id);
    const scores: Record<string, number> = {};
    let total = 0;
    g?.questions.forEach((q, qi) => {
      let qSum = 0;
      for (const st of q.steps) {
        const key = st.stepId;
        const v = g.overrides[key] ?? st.awarded;
        qSum += v;
      }
      const k = `q${qi + 1}`;
      scores[k] = Math.round(qSum * 10) / 10;
      total += scores[k];
    });
    return { rollNo: s.rollNo, name: s.name, scores, total: Math.round(total * 10) / 10 };
  });
}
