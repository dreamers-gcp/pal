export type EvaluationStrictness = "exact" | "conceptual" | "partial";

export type EvalPhase =
  | "waiting"
  | "reading"
  | "comparing"
  | "scored"
  | "failed";

export type StepConfidence = "high" | "medium" | "low";

/** One discrete score level for LLM grading (e.g. 2 = Correct). */
export interface ScoringBand {
  id: string;
  score: number;
  criterion: string;
}

export interface ExamStep {
  id: string;
  subPartLabel: string;
  description: string;
  /** Maximum marks for a fully correct response */
  marks: number;
  /**
   * Professor-defined score levels and criteria — formatted into the LLM prompt
   * when evaluating this step.
   */
  scoringBands: ScoringBand[];
}

export interface ExamQuestion {
  id: string;
  questionNo: number;
  steps: ExamStep[];
}

export interface ExamSetup {
  name: string;
  subject: string;
  date: string;
  totalMarks: number;
  questions: ExamQuestion[];
  strictness: EvaluationStrictness;
}

export interface ScriptRow {
  id: string;
  fileName: string;
  studentName: string;
  rollNo: string;
  pages: number;
  status: "ready" | "parsing";
  objectUrl: string | null;
}

export interface EvalStudent {
  id: string;
  scriptId: string;
  name: string;
  rollNo: string;
  progress: number;
  phase: EvalPhase;
  objectUrl: string | null;
}

export interface AiStepGrade {
  stepId: string;
  subPartLabel: string;
  stepMax: number;
  awarded: number;
  justification: string;
  confidence: StepConfidence;
  ok: boolean;
  /** Professor rubric block as sent to the evaluator (LLM) */
  llmRubricBlock?: string;
}

export interface AiQuestionGrade {
  questionId: string;
  label: string;
  maxMarks: number;
  aiAwarded: number;
  steps: AiStepGrade[];
}
