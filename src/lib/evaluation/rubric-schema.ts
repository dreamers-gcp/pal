/** Ported from `Documents/evaluation/src/rubric_schema.py`. */

export type CanonicalRubricQuestion = {
  id: number;
  question_id?: number;
  question_text: string;
  total_marks: number;
  correct_answer: string;
  method_locked: boolean;
  steps: CanonicalRubricStep[];
  partial_credit_notes?: Array<string | PartialCreditNoteObj>;
};

export type PartialCreditNoteObj = {
  step_id: string;
  scenario: string;
  marks?: number;
};

export type CanonicalRubricStep = {
  step_id: string;
  description: string;
  expected: string;
  marks: number;
};

export type CanonicalRubric = {
  exam_title?: string;
  questions: CanonicalRubricQuestion[];
};

function err(errors: string[], msg: string) {
  errors.push(msg);
}

export function validateRubric(rubric: unknown): string[] {
  const errors: string[] = [];
  if (!rubric || typeof rubric !== "object") return ["rubric must be a mapping/object"];
  const r = rubric as { questions?: unknown };
  if (!Array.isArray(r.questions)) return ["rubric.questions must be a list"];
  if (r.questions.length === 0) err(errors, "rubric.questions is empty");

  const seenIds = new Set<number>();
  r.questions.forEach((q, i) => {
    const prefix = `questions[${i}]`;
    if (!q || typeof q !== "object") {
      err(errors, `${prefix}: must be a mapping`);
      return;
    }
    const qq = q as Record<string, unknown>;
    for (const field of [
      "id",
      "question_text",
      "total_marks",
      "correct_answer",
      "method_locked",
      "steps",
    ] as const) {
      if (!(field in qq)) err(errors, `${prefix}: missing field '${field}'`);
    }
    const qid = qq.id;
    if (qid != null) {
      if (typeof qid !== "number" || !Number.isInteger(qid)) {
        err(errors, `${prefix}.id must be integer`);
      } else if (seenIds.has(qid)) {
        err(errors, `${prefix}.id=${qid} is duplicated`);
      } else {
        seenIds.add(qid);
      }
    }
    if ("method_locked" in qq && typeof qq.method_locked !== "boolean") {
      err(errors, `${prefix}.method_locked must be true/false`);
    }
    const steps = qq.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      err(errors, `${prefix}.steps must be a non-empty list`);
      return;
    }
    const seenStepIds = new Set<string>();
    let stepMarksSum = 0;
    steps.forEach((s, j) => {
      const sprefix = `${prefix}.steps[${j}]`;
      if (!s || typeof s !== "object") {
        err(errors, `${sprefix}: must be a mapping`);
        return;
      }
      const st = s as Record<string, unknown>;
      for (const f of ["step_id", "description", "expected", "marks"] as const) {
        if (!(f in st)) err(errors, `${sprefix}: missing field '${f}'`);
      }
      const sid = st.step_id;
      if (sid != null) {
        if (typeof sid !== "string" || !sid.trim()) {
          err(errors, `${sprefix}.step_id must be a non-empty string`);
        } else if (seenStepIds.has(sid)) {
          err(errors, `${sprefix}.step_id='${sid}' is duplicated within question ${String(qid)}`);
        } else {
          seenStepIds.add(sid);
        }
      }
      const marks = st.marks;
      if (marks == null || typeof marks !== "number" || marks < 0 || !Number.isFinite(marks)) {
        err(errors, `${sprefix}.marks must be a non-negative number`);
      } else {
        stepMarksSum += marks;
      }
      const expected = st.expected;
      if (expected != null && (typeof expected !== "string" || !expected.trim())) {
        err(errors, `${sprefix}.expected must be a non-empty string`);
      }
    });
    const total = qq.total_marks;
    if (typeof total === "number" && Number.isFinite(total)) {
      if (Math.abs(stepMarksSum - total) > 0.01) {
        err(
          errors,
          `${prefix}: step marks sum to ${stepMarksSum} but total_marks is ${total}`
        );
      }
    }
    const notes = qq.partial_credit_notes;
    if (notes != null) {
      if (!Array.isArray(notes)) {
        err(errors, `${prefix}.partial_credit_notes must be a list`);
      } else {
        notes.forEach((n, k) => {
          const npref = `${prefix}.partial_credit_notes[${k}]`;
          if (typeof n === "string") return;
          if (!n || typeof n !== "object") {
            err(errors, `${npref}: must be a string or mapping`);
            return;
          }
          const nn = n as PartialCreditNoteObj;
          if (nn.step_id && !seenStepIds.has(nn.step_id)) {
            err(
              errors,
              `${npref}.step_id='${nn.step_id}' does not match any step in question ${String(qid)}`
            );
          }
        });
      }
    }
  });
  return errors;
}

export function normalizeRubric(rubric: CanonicalRubric): CanonicalRubric {
  for (const q of rubric.questions) {
    if (q.question_id === undefined && q.id !== undefined) {
      q.question_id = q.id;
    }
    const canonicalNotes: string[] = [];
    for (const n of q.partial_credit_notes ?? []) {
      if (typeof n === "string") {
        canonicalNotes.push(n);
      } else if (n && typeof n === "object") {
        const stepId = n.step_id ?? "";
        const scenario = n.scenario ?? "";
        const marks = n.marks;
        const tail = marks != null ? ` → ${marks} marks` : "";
        const prefix = stepId ? `Step ${stepId}: ` : "";
        canonicalNotes.push(`${prefix}${scenario}${tail}`.trim());
      }
    }
    q.partial_credit_notes = canonicalNotes;
  }
  return rubric;
}
