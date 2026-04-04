"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvaluationStepper } from "./evaluation-stepper";
import { StageSetup, createInitialSetup } from "./stage-setup";
import { StageAnswerKey, cloneQuestions } from "./stage-answer-key";
import { StageScripts } from "./stage-scripts";
import { StageQueue } from "./stage-queue";
import { StageReview } from "./stage-review";
import { downloadEvaluationCsv } from "./csv-export";
import type {
  AiQuestionGrade,
  EvalPhase,
  EvalStudent,
  ExamQuestion,
  ExamSetup,
  ScriptRow,
} from "./types";
import { Button } from "@/components/ui/button";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";

const EXPECTED_SCRIPT_TOTAL = 45;

function scriptsToEvalStudents(scripts: ScriptRow[]): EvalStudent[] {
  return scripts
    .filter((s) => s.status === "ready")
    .map((s) => ({
      id: s.id,
      scriptId: s.id,
      name: s.studentName,
      rollNo: s.rollNo,
      progress: 0,
      phase: "waiting" as const,
      objectUrl: s.objectUrl,
    }));
}

export function AnswerScriptsEvaluation() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [step, setStep] = useState(1);

  const [examSetup, setExamSetup] = useState<ExamSetup>(() => createInitialSetup());
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [answerKeyUrl, setAnswerKeyUrl] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ExamQuestion[]>([]);

  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [evalStudents, setEvalStudents] = useState<EvalStudent[]>([]);
  const [paused, setPaused] = useState(false);
  const [aiGrades, setAiGrades] = useState<Record<string, AiQuestionGrade[]>>({});

  const [reviewStudentId, setReviewStudentId] = useState<string | null>(null);
  const [overridesByStudent, setOverridesByStudent] = useState<
    Record<string, Record<string, number>>
  >({});
  const [reasonsByStudent, setReasonsByStudent] = useState<
    Record<string, Record<string, string>>
  >({});
  const [revertedByStudent, setRevertedByStudent] = useState<Record<string, string[]>>({});

  const handleAnswerKeyFile = useCallback((f: File | null, url: string | null) => {
    if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    setAnswerKeyFile(f);
    setAnswerKeyUrl(url);
  }, [answerKeyUrl]);

  useEffect(() => {
    return () => {
      if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    };
  }, [answerKeyUrl]);

  /** Prevents duplicate OpenAI calls for the same student while `comparing`. */
  const gradingInFlight = useRef(new Set<string>());

  const comparingId = useMemo(
    () => evalStudents.find((s) => s.phase === "comparing")?.id ?? null,
    [evalStudents]
  );

  const evalStudentsRef = useRef(evalStudents);
  evalStudentsRef.current = evalStudents;
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts;
  const gradePayloadRef = useRef({ examSetup, parsedQuestions });
  gradePayloadRef.current = { examSetup, parsedQuestions };

  /** Advance queue: waiting → reading → comparing (scored is set by the grading API). */
  useEffect(() => {
    if (step !== 4 || paused || evalStudents.length === 0) return;
    const t = window.setInterval(() => {
      setEvalStudents((prev) => {
        const idx = prev.findIndex((s) => s.phase !== "scored" && s.phase !== "failed");
        if (idx < 0) return prev;
        const cur = prev[idx];
        if (cur.phase === "comparing") return prev;

        let nextPhase: EvalPhase = cur.phase;
        let progress = cur.progress;

        if (cur.phase === "waiting") {
          nextPhase = "reading";
          progress = 18;
        } else if (cur.phase === "reading") {
          nextPhase = "comparing";
          progress = 58;
        } else {
          return prev;
        }

        const copy = [...prev];
        copy[idx] = { ...cur, phase: nextPhase, progress };
        return copy;
      });
    }, 900);
    return () => window.clearInterval(t);
  }, [step, paused, evalStudents.length]);

  /** Call OpenAI when a script reaches the comparing phase (deps: comparingId only + refs for payload). */
  useEffect(() => {
    if (step !== 4 || paused || !comparingId) return;
    if (gradingInFlight.current.has(comparingId)) return;
    const pending = evalStudentsRef.current.find((s) => s.id === comparingId);
    if (!pending?.objectUrl) return;

    gradingInFlight.current.add(comparingId);
    const ac = new AbortController();

    (async () => {
      try {
        const blob = await fetch(pending.objectUrl!).then((r) => r.blob());
        const fd = new FormData();
        const row = scriptsRef.current.find((r) => r.id === pending.scriptId);
        const { examSetup: es, parsedQuestions: pq } = gradePayloadRef.current;
        fd.append("script", blob, row?.fileName ?? `script-${pending.id}.pdf`);
        fd.append(
          "payload",
          JSON.stringify({
            examName: es.name,
            strictness: es.strictness,
            questions: pq,
          })
        );
        const res = await fetch("/api/answer-scripts/grade", {
          method: "POST",
          body: fd,
          signal: ac.signal,
        });
        const data = (await res.json()) as { grades?: AiQuestionGrade[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        if (!data.grades?.length) throw new Error("No grades returned.");

        setAiGrades((g) => ({ ...g, [pending.id]: data.grades! }));
        setEvalStudents((prev) =>
          prev.map((s) =>
            s.id === pending.id ? { ...s, phase: "scored" as const, progress: 100 } : s
          )
        );
        toast.success(`Graded ${pending.name}`);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Grading failed";
        toast.error(msg);
        setEvalStudents((prev) =>
          prev.map((s) =>
            s.id === pending.id ? { ...s, phase: "failed" as const, progress: 0 } : s
          )
        );
      } finally {
        gradingInFlight.current.delete(comparingId);
      }
    })();

    return () => ac.abort();
  }, [step, paused, comparingId]);

  const goStep = (s: number) => setStep(s);

  const startNewSession = () => {
    if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    scripts.forEach((x) => x.objectUrl && URL.revokeObjectURL(x.objectUrl));
    setSessionStarted(true);
    setStep(1);
    setExamSetup(createInitialSetup());
    setAnswerKeyFile(null);
    setAnswerKeyUrl(null);
    setParsedQuestions([]);
    setScripts([]);
    setEvalStudents([]);
    setPaused(false);
    setAiGrades({});
    setReviewStudentId(null);
    setOverridesByStudent({});
    setReasonsByStudent({});
    setRevertedByStudent({});
  };

  const scoredList = useMemo(
    () => evalStudents.filter((s) => s.phase === "scored"),
    [evalStudents]
  );

  const exportCsv = useCallback(() => {
    const rows = scoredList.map((s) => {
      const qs = aiGrades[s.id];
      const ov = overridesByStudent[s.id] ?? {};
      const scores: Record<string, number> = {};
      let total = 0;
      qs?.forEach((q, qi) => {
        let qSum = 0;
        for (const st of q.steps) {
          const rev = revertedByStudent[s.id]?.includes(st.stepId);
          const v = rev ? st.awarded : ov[st.stepId] ?? st.awarded;
          qSum += v;
        }
        const k = `q${qi + 1}`;
        scores[k] = Math.round(qSum * 10) / 10;
        total += scores[k];
      });
      return {
        rollNo: s.rollNo,
        name: s.name,
        scores,
        total: Math.round(total * 10) / 10,
      };
    });
    const qLabels = aiGrades[scoredList[0]?.id ?? ""]?.map((_, i) => `q${i + 1}`) ?? [];
    if (rows.length === 0) {
      toast.error("No scored scripts to export yet.");
      return;
    }
    downloadEvaluationCsv(rows, qLabels);
    toast.success("CSV downloaded.");
  }, [scoredList, aiGrades, overridesByStudent, revertedByStudent]);

  const openReview = (studentId: string) => {
    setReviewStudentId(studentId);
    goStep(5);
  };

  const reviewStudent = evalStudents.find((s) => s.id === reviewStudentId);
  const reviewQuestions = reviewStudentId ? aiGrades[reviewStudentId] : undefined;

  const reviewIndex = scoredList.findIndex((s) => s.id === reviewStudentId);
  const nextReviewId =
    reviewIndex >= 0 ? scoredList[reviewIndex + 1]?.id ?? null : null;

  const handleApproveNext = () => {
    if (!reviewStudentId) return;
    toast.success("Marks saved for this script.");
    if (nextReviewId) {
      setReviewStudentId(nextReviewId);
    } else {
      setReviewStudentId(null);
      goStep(4);
      toast.message("All reviewed students processed. Back to queue.");
    }
  };

  const revertedSet = useMemo(
    () => new Set(revertedByStudent[reviewStudentId ?? ""] ?? []),
    [revertedByStudent, reviewStudentId]
  );

  if (!sessionStarted) {
    return (
      <div className="rounded-xl border border-dashed border-[#01696f]/30 bg-[#01696f]/[0.04] p-10 text-center">
        <FileCheck2 className="mx-auto mb-4 h-12 w-12 text-[#01696f]" />
        <h2 className="font-display text-xl font-medium text-foreground">
          Answer scripts evaluation
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          LLM-assisted grading: upload an answer key and scanned scripts, run automated evaluation
          (OpenAI), then review and approve marks per student.
        </p>
        <Button
          type="button"
          className="mt-6 bg-[#01696f] text-white hover:bg-[#015a5f]"
          onClick={startNewSession}
        >
          Start new evaluation
        </Button>
      </div>
    );
  }

  return (
    <div className="answer-scripts-evaluation flex min-h-0 min-w-0 max-w-full flex-col space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Session: <span className="font-medium text-foreground">{examSetup.name || "Untitled"}</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setSessionStarted(false)}>
          Exit to overview
        </Button>
      </div>

      <EvaluationStepper current={step} />

      {step === 1 && (
        <StageSetup
          value={examSetup}
          onChange={setExamSetup}
          onNext={() => {
            setParsedQuestions(cloneQuestions(examSetup.questions));
            goStep(2);
          }}
        />
      )}

      {step === 2 && (
        <StageAnswerKey
          setup={examSetup}
          file={answerKeyFile}
          objectUrl={answerKeyUrl}
          onFile={handleAnswerKeyFile}
          parsedQuestions={parsedQuestions}
          onParsedChange={setParsedQuestions}
          onBack={() => goStep(1)}
          onNext={() => goStep(3)}
        />
      )}

      {step === 3 && (
        <StageScripts
          scripts={scripts}
          setScripts={setScripts}
          totalExpected={EXPECTED_SCRIPT_TOTAL}
          onBack={() => goStep(2)}
          onStartEvaluation={() => {
            setEvalStudents(scriptsToEvalStudents(scripts));
            goStep(4);
          }}
        />
      )}

      {step === 4 && (
        <StageQueue
          students={evalStudents}
          paused={paused}
          setPaused={setPaused}
          canOpenReview={(id) => Boolean(aiGrades[id])}
          onBack={() => goStep(3)}
          onOpenReview={openReview}
          onExportCsv={exportCsv}
        />
      )}

      {step === 5 && reviewStudent && reviewQuestions && (
        <StageReview
          studentId={reviewStudent.id}
          studentName={reviewStudent.name}
          rollNo={reviewStudent.rollNo}
          scriptUrl={reviewStudent.objectUrl}
          questions={reviewQuestions}
          answerKeyTree={parsedQuestions}
          overrides={overridesByStudent[reviewStudent.id] ?? {}}
          overrideReasons={reasonsByStudent[reviewStudent.id] ?? {}}
          revertedSteps={revertedSet}
          onOverrideChange={(stepId, value) => {
            const sid = reviewStudent.id;
            setRevertedByStudent((prev) => ({
              ...prev,
              [sid]: (prev[sid] ?? []).filter((x) => x !== stepId),
            }));
            setOverridesByStudent((prev) => ({
              ...prev,
              [sid]: { ...(prev[sid] ?? {}), [stepId]: value },
            }));
          }}
          onReasonChange={(stepId, reason) => {
            const sid = reviewStudent.id;
            setReasonsByStudent((prev) => ({
              ...prev,
              [sid]: { ...(prev[sid] ?? {}), [stepId]: reason },
            }));
          }}
          onRevertStep={(stepId) => {
            const sid = reviewStudent.id;
            setOverridesByStudent((prev) => {
              const o = { ...(prev[sid] ?? {}) };
              delete o[stepId];
              return { ...prev, [sid]: o };
            });
            setRevertedByStudent((prev) => ({
              ...prev,
              [sid]: [...new Set([...(prev[sid] ?? []), stepId])],
            }));
          }}
          onApproveNext={handleApproveNext}
          onFlag={() => toast.message("Flagged for peer review (demo).")}
          onBackToQueue={() => goStep(4)}
          hasNext={Boolean(nextReviewId)}
        />
      )}

      {step === 5 && (!reviewStudent || !reviewQuestions) && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No student selected.{" "}
          <Button type="button" variant="link" className="text-[#01696f]" onClick={() => goStep(4)}>
            Return to queue
          </Button>
        </div>
      )}
    </div>
  );
}
