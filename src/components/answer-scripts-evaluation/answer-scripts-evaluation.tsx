"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvaluationStepper } from "./evaluation-stepper";
import { StageSetup, createInitialSetup } from "./stage-setup";
import { StageScripts } from "./stage-scripts";
import { StageQueue } from "./stage-queue";
import { StageReview } from "./stage-review";
import { computeStudentTotals, downloadEvaluationCsv } from "./csv-export";
import type {
  AiQuestionGrade,
  EvalPhase,
  EvalStudent,
  ExamQuestion,
  ExamSetup,
  ScriptRow,
} from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { examQuestionsFromAiGrades } from "@/lib/answer-scripts-grade-helpers";

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
  /* 3 steps: 1 = setup + answer key, 2 = scripts, 3 = evaluate queue, 4 = review (internal) */
  const [step, setStep] = useState(1);

  const [examSetup, setExamSetup] = useState<ExamSetup>(() => createInitialSetup());
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [answerKeyUrl, setAnswerKeyUrl] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ExamQuestion[]>([]);
  /** Cached text summary of correct answers from the answer key (extracted once, reused for all students). */
  const [answerKeySummary, setAnswerKeySummary] = useState<string | null>(null);
  /** Track whether pre-extraction is running so we don't fire it twice. */
  const rubricExtractionRef = useRef<AbortController | null>(null);

  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [evalStudents, setEvalStudents] = useState<EvalStudent[]>([]);
  const [aiGrades, setAiGrades] = useState<Record<string, AiQuestionGrade[]>>({});

  const [reviewStudentId, setReviewStudentId] = useState<string | null>(null);
  const [overridesByStudent, setOverridesByStudent] = useState<
    Record<string, Record<string, number>>
  >({});
  const [reasonsByStudent, setReasonsByStudent] = useState<
    Record<string, Record<string, string>>
  >({});
  const [revertedByStudent, setRevertedByStudent] = useState<Record<string, string[]>>({});

  const handleAnswerKeyFile = useCallback(
    (f: File | null, url: string | null) => {
      if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
      setAnswerKeyFile(f);
      setAnswerKeyUrl(url);
    },
    [answerKeyUrl]
  );

  useEffect(() => {
    return () => {
      if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    };
  }, [answerKeyUrl]);

  const gradingInFlight = useRef(new Set<string>());

  const comparingId = useMemo(
    () => evalStudents.find((s) => s.phase === "comparing")?.id ?? null,
    [evalStudents]
  );

  const evalStudentsRef = useRef(evalStudents);
  evalStudentsRef.current = evalStudents;
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts;
  const gradePayloadRef = useRef({
    examSetup,
    parsedQuestions,
    answerKeyUrl: null as string | null,
    answerKeyFileName: null as string | null,
    answerKeySummary: null as string | null,
  });
  gradePayloadRef.current = {
    examSetup,
    parsedQuestions,
    answerKeyUrl,
    answerKeyFileName: answerKeyFile?.name ?? null,
    answerKeySummary,
  };

  /* Advance queue: waiting → comparing (fast — no artificial "reading" delay) */
  useEffect(() => {
    if (step !== 3 || evalStudents.length === 0) return;
    const t = window.setInterval(() => {
      setEvalStudents((prev) => {
        const idx = prev.findIndex((s) => s.phase !== "scored" && s.phase !== "failed");
        if (idx < 0) return prev;
        const cur = prev[idx];
        if (cur.phase === "comparing") return prev;
        if (cur.phase !== "waiting") return prev;

        const copy = [...prev];
        copy[idx] = { ...cur, phase: "comparing" as EvalPhase, progress: 40 };
        return copy;
      });
    }, 200);
    return () => window.clearInterval(t);
  }, [step, evalStudents.length]);

  /* Call OpenAI when a script reaches comparing phase */
  useEffect(() => {
    if (step !== 3 || !comparingId) return;
    if (gradingInFlight.current.has(comparingId)) return;
    const pending = evalStudentsRef.current.find((s) => s.id === comparingId);
    if (!pending?.objectUrl) return;

    gradingInFlight.current.add(comparingId);
    const ac = new AbortController();

    (async () => {
      try {
        const {
          examSetup: es,
          parsedQuestions: pq,
          answerKeyUrl: akUrl,
          answerKeyFileName,
          answerKeySummary: cachedSummary,
        } = gradePayloadRef.current;
        if (!akUrl) {
          toast.error("Upload the answer key PDF in step 1 before grading.");
          setEvalStudents((prev) =>
            prev.map((s) =>
              s.id === pending.id ? { ...s, phase: "failed" as const, progress: 0 } : s
            )
          );
          return;
        }

        const studentBlob = await fetch(pending.objectUrl!).then((r) => r.blob());
        const answerKeyBlob = await fetch(akUrl).then((r) => r.blob());
        if (answerKeyBlob.size === 0) {
          toast.error("Answer key PDF is empty.");
          setEvalStudents((prev) =>
            prev.map((s) =>
              s.id === pending.id ? { ...s, phase: "failed" as const, progress: 0 } : s
            )
          );
          return;
        }

        const fd = new FormData();
        const row = scriptsRef.current.find((r) => r.id === pending.scriptId);
        fd.append("answerKey", answerKeyBlob, answerKeyFileName || "master-answer-key.pdf");
        fd.append("script", studentBlob, row?.fileName ?? `script-${pending.id}.pdf`);
        fd.append(
          "payload",
          JSON.stringify({
            examName: es.name,
            strictness: es.strictness,
            questions: pq,
            ...(cachedSummary ? { answerKeySummary: cachedSummary } : {}),
          })
        );
        const res = await fetch("/api/answer-scripts/grade", {
          method: "POST",
          body: fd,
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          grades?: AiQuestionGrade[];
          answerKeySummary?: string;
          derivedQuestions?: ExamQuestion[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        if (!data.grades?.length) throw new Error("No grades returned.");

        if (data.answerKeySummary) {
          setAnswerKeySummary((prev) => prev ?? data.answerKeySummary!);
        }
        if (data.derivedQuestions?.length) {
          setParsedQuestions((prev) =>
            prev.length > 0 ? prev : data.derivedQuestions!
          );
        } else {
          setParsedQuestions((prev) =>
            prev.length > 0 ? prev : examQuestionsFromAiGrades(data.grades!)
          );
        }
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
  }, [step, comparingId]);

  const goStep = (s: number) => setStep(s);

  /* Stepper shows 3 steps; internal step 4 (review) maps to step 3 */
  const stepperStep = step >= 4 ? 3 : step;

  /** Fire rubric pre-extraction in the background (called when leaving Step 1). */
  const preExtractRubric = useCallback(() => {
    if (answerKeySummary) return;
    if (!answerKeyUrl || !answerKeyFile) return;
    rubricExtractionRef.current?.abort();
    const ac = new AbortController();
    rubricExtractionRef.current = ac;

    void (async () => {
      try {
        const blob = await fetch(answerKeyUrl).then((r) => r.blob());
        if (blob.size === 0) return;
        const fd = new FormData();
        fd.append("answerKey", blob, answerKeyFile.name || "answer-key.pdf");
        fd.append("examName", examSetup.name || "Exam");
        const res = await fetch("/api/answer-scripts/extract-rubric", {
          method: "POST",
          body: fd,
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          derivedQuestions?: ExamQuestion[];
          answerKeySummary?: string;
          error?: string;
        };
        if (!res.ok || !data.answerKeySummary) return;
        setAnswerKeySummary((prev) => prev ?? data.answerKeySummary!);
        if (data.derivedQuestions?.length) {
          setParsedQuestions((prev) =>
            prev.length > 0 ? prev : data.derivedQuestions!
          );
        }
      } catch {
        /* pre-extraction is best-effort; grading route has its own fallback */
      }
    })();
  }, [answerKeySummary, answerKeyUrl, answerKeyFile, examSetup.name]);

  const startNewSession = () => {
    rubricExtractionRef.current?.abort();
    if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    scripts.forEach((x) => x.objectUrl && URL.revokeObjectURL(x.objectUrl));
    setSessionStarted(true);
    setStep(1);
    setExamSetup(createInitialSetup());
    setAnswerKeyFile(null);
    setAnswerKeyUrl(null);
    setParsedQuestions([]);
    setAnswerKeySummary(null);
    setScripts([]);
    setEvalStudents([]);
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
      const reverted = revertedByStudent[s.id];
      const { perQuestion: scores, total } = computeStudentTotals(qs, ov, reverted);
      return {
        rollNo: s.rollNo,
        name: s.name,
        scores,
        total,
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
    goStep(4);
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
      goStep(3);
      setSessionStarted(false);
      toast.success("Review complete. Session overview is below — export CSV or continue later.");
    }
  };

  const revertedSet = useMemo(
    () => new Set(revertedByStudent[reviewStudentId ?? ""] ?? []),
    [revertedByStudent, reviewStudentId]
  );

  const hasSessionSnapshot = useMemo(
    () =>
      Boolean(
        examSetup.name.trim() ||
          parsedQuestions.length > 0 ||
          scripts.length > 0 ||
          evalStudents.length > 0 ||
          Object.keys(aiGrades).length > 0 ||
          answerKeyFile ||
          answerKeyUrl
      ),
    [
      examSetup.name,
      parsedQuestions.length,
      scripts.length,
      evalStudents.length,
      aiGrades,
      answerKeyFile,
      answerKeyUrl,
    ]
  );

  const examMaxMarks = useMemo(() => {
    const firstScored = scoredList[0];
    const fromGrades = firstScored ? aiGrades[firstScored.id] : undefined;
    if (fromGrades?.length) {
      return fromGrades.reduce((a, q) => a + q.maxMarks, 0);
    }
    const fromParsed = parsedQuestions.reduce(
      (a, q) => a + q.steps.reduce((s, st) => s + (Number(st.marks) || 0), 0),
      0
    );
    if (fromParsed > 0) return fromParsed;
    return examSetup.totalMarks || 0;
  }, [scoredList, aiGrades, parsedQuestions, examSetup.totalMarks]);

  /* --- Landing / saved session view --- */
  if (!sessionStarted) {
    if (hasSessionSnapshot) {
      return (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#01696f]/25 bg-[#01696f]/[0.06] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <FileCheck2 className="h-10 w-10 shrink-0 text-[#01696f]" aria-hidden />
                <div>
                  <h2 className="font-display text-xl font-medium text-foreground">
                    {examSetup.name.trim() || "Saved session"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {examSetup.subject && <span>{examSetup.subject}</span>}
                    {examSetup.subject && examSetup.date && " · "}
                    {examSetup.date && <span>{examSetup.date}</span>}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {evalStudents.length > 0
                      ? `${evalStudents.filter((s) => s.phase === "scored").length} of ${evalStudents.length} scripts scored · Max ${examMaxMarks || "—"} marks`
                      : "Session saved — continue to upload scripts and run grading."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-[#01696f] text-white hover:bg-[#015a5f]"
                  onClick={() => setSessionStarted(true)}
                >
                  Continue session
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportCsv}
                  disabled={scoredList.length === 0}
                >
                  Export CSV
                </Button>
                <Button type="button" variant="secondary" onClick={startNewSession}>
                  Start new evaluation
                </Button>
              </div>
            </div>
          </div>

          {evalStudents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Students &amp; marks</CardTitle>
                <CardDescription>
                  Totals use your overrides where set; &quot;Revert to AI&quot; uses the model score.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Roll</th>
                      <th className="py-2 pr-3 font-medium">Name</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 text-right font-medium tabular-nums">
                        Total {examMaxMarks ? ` / ${examMaxMarks}` : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalStudents.map((s) => {
                      const qs = aiGrades[s.id];
                      const { total } = computeStudentTotals(
                        qs,
                        overridesByStudent[s.id],
                        revertedByStudent[s.id]
                      );
                      const hasGrades = Boolean(qs?.length);
                      const status =
                        s.phase === "scored"
                          ? "Scored"
                          : s.phase === "failed"
                            ? "Failed"
                            : s.phase === "comparing"
                              ? "Grading"
                              : s.phase === "reading"
                                ? "Reading"
                                : "Waiting";
                      return (
                        <tr key={s.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-3 font-mono text-xs">{s.rollNo}</td>
                          <td className="py-2.5 pr-3">{s.name}</td>
                          <td className="py-2.5 pr-3">
                            <Badge
                              variant="secondary"
                              className={
                                s.phase === "scored"
                                  ? "bg-emerald-600/15 text-emerald-900"
                                  : s.phase === "failed"
                                    ? "bg-destructive/10 text-destructive"
                                    : ""
                              }
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-medium text-[#01696f]">
                            {hasGrades ? total.toFixed(1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {evalStudents.length === 0 && answerKeyUrl && (
            <p className="text-center text-sm text-muted-foreground">
              Answer key PDF is uploaded. Continue session to add scripts and start grading.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-[#01696f]/30 bg-[#01696f]/[0.04] p-10 text-center">
        <FileCheck2 className="mx-auto mb-4 h-12 w-12 text-[#01696f]" />
        <h2 className="font-display text-xl font-medium text-foreground">
          Answer scripts evaluation
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          LLM-assisted grading: upload the answer key &amp; marking scheme, then add
          student scripts, and review marks per student.
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

  /* --- Active session --- */
  return (
    <div className="answer-scripts-evaluation flex min-h-0 min-w-0 max-w-full flex-col space-y-6 overflow-x-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Session: <span className="font-medium text-foreground">{examSetup.name || "Untitled"}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (step === 4) goStep(3);
            setSessionStarted(false);
          }}
        >
          Exit to overview
        </Button>
      </div>

      <div className="shrink-0">
        <EvaluationStepper current={stepperStep} />
      </div>

      {/* Step 1: Exam details + answer key upload */}
      {step === 1 && (
        <StageSetup
          value={examSetup}
          onChange={setExamSetup}
          answerKeyFile={answerKeyFile}
          answerKeyUrl={answerKeyUrl}
          onAnswerKeyFile={handleAnswerKeyFile}
          onNext={() => {
            setParsedQuestions([]);
            preExtractRubric();
            goStep(2);
          }}
        />
      )}

      {/* Step 2: Student scripts */}
      {step === 2 && (
        <StageScripts
          scripts={scripts}
          setScripts={setScripts}
          totalExpected={EXPECTED_SCRIPT_TOTAL}
          onBack={() => goStep(1)}
          onStartEvaluation={() => {
            setEvalStudents(scriptsToEvalStudents(scripts));
            goStep(3);
          }}
        />
      )}

      {/* Step 3: Evaluation queue */}
      {step === 3 && (
        <StageQueue
          students={evalStudents}
          canOpenReview={(id) => Boolean(aiGrades[id])}
          onBack={() => goStep(2)}
          onOpenReview={openReview}
          onExportCsv={exportCsv}
        />
      )}

      {/* Step 4 (internal): Per-student review */}
      {step === 4 && reviewStudent && reviewQuestions && (
        <div className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden max-lg:h-auto max-lg:max-h-none lg:h-[min(760px,calc(100dvh-13rem))] lg:max-h-[min(760px,calc(100dvh-13rem))]">
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
            onBackToQueue={() => goStep(3)}
            hasNext={Boolean(nextReviewId)}
          />
        </div>
      )}

      {step === 4 && (!reviewStudent || !reviewQuestions) && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No student selected.{" "}
          <Button type="button" variant="link" className="text-[#01696f]" onClick={() => goStep(3)}>
            Return to queue
          </Button>
        </div>
      )}
    </div>
  );
}
