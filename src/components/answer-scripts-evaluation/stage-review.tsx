"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ZoomIn,
  ZoomOut,
  Check,
  AlertTriangle,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  AiQuestionGrade,
  AiStepGrade,
  ExamQuestion,
  StepConfidence,
} from "./types";

function confidenceBadge(c: StepConfidence) {
  if (c === "high")
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">High</Badge>;
  if (c === "medium")
    return <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Medium</Badge>;
  return <Badge variant="destructive">Low</Badge>;
}

function stepIcon(st: AiStepGrade) {
  return st.ok ? (
    <Check className="h-4 w-4 text-emerald-600" aria-label="OK" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Warning" />
  );
}

export function StageReview({
  studentId: _studentId,
  studentName,
  rollNo,
  scriptUrl,
  questions,
  answerKeyTree,
  overrides,
  overrideReasons,
  revertedSteps,
  onOverrideChange,
  onReasonChange,
  onRevertStep,
  onApproveNext,
  onBackToQueue,
  hasNext,
}: {
  studentId: string;
  studentName: string;
  rollNo: string;
  scriptUrl: string | null;
  questions: AiQuestionGrade[];
  answerKeyTree: ExamQuestion[];
  overrides: Record<string, number>;
  overrideReasons: Record<string, string>;
  revertedSteps: Set<string>;
  onOverrideChange: (stepId: string, value: number) => void;
  onReasonChange: (stepId: string, reason: string) => void;
  onRevertStep: (stepId: string) => void;
  onApproveNext: () => void;
  onBackToQueue: () => void;
  hasNext: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const firstLowReasonRef = useRef<HTMLTextAreaElement | null>(null);

  const firstLowStepId = useMemo(() => {
    for (const q of questions) {
      const low = q.steps.find((s) => s.confidence === "low");
      if (low) return low.stepId;
    }
    return null;
  }, [questions]);

  const effective = useCallback(
    (stepId: string, ai: number) => {
      if (revertedSteps.has(stepId)) return ai;
      const o = overrides[stepId];
      return o !== undefined ? o : ai;
    },
    [overrides, revertedSteps]
  );

  const aiTotal = useMemo(
    () => questions.reduce((a, q) => a + q.steps.reduce((s, st) => s + st.awarded, 0), 0),
    [questions]
  );

  const yourTotal = useMemo(
    () =>
      questions.reduce(
        (a, q) => a + q.steps.reduce((s, st) => s + effective(st.stepId, st.awarded), 0),
        0
      ),
    [questions, effective]
  );

  const maxTotal = useMemo(
    () => questions.reduce((a, q) => a + q.maxMarks, 0),
    [questions]
  );

  const tryApprove = useCallback(() => {
    for (const q of questions) {
      for (const st of q.steps) {
        if (st.confidence !== "low") continue;
        const cur = effective(st.stepId, st.awarded);
        if (cur !== st.awarded && !(overrideReasons[st.stepId]?.trim())) {
          toast.error("Add a reason for override on low-confidence steps.");
          return;
        }
      }
    }
    onApproveNext();
  }, [questions, effective, overrideReasons, onApproveNext]);

  const tryApproveRef = useRef(tryApprove);
  tryApproveRef.current = tryApprove;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        tryApproveRef.current();
      }
      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        tryApproveRef.current();
      }
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        firstLowReasonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden pb-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBackToQueue}>
          ← Queue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <kbd className="rounded border bg-muted px-1 text-xs">→</kbd> Next ·{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">A</kbd> Approve ·{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">O</kbd> Override note
        </p>
      </div>

      {/* Two panes only: PDF (scroll 1) | marks + answer key in one column (scroll 2). */}
      <div
        className={cn(
          "grid min-h-0 w-full min-w-0 max-w-full flex-1 gap-4",
          "lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]",
          "lg:grid-rows-[minmax(0,1fr)] lg:min-h-0 lg:overflow-hidden"
        )}
      >
        {/* LEFT — script PDF (single inner scroll) */}
        <Card className="flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden lg:h-full">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Student script</CardTitle>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.max(75, z - 25))}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.min(175, z + 25))}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-2 pt-0">
            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border bg-muted/20"
              style={{ zoom: `${zoom}%` } as React.CSSProperties}
            >
              {scriptUrl ? (
                <iframe
                  title="Student script"
                  src={scriptUrl}
                  className="min-h-[min(100%,480px)] w-full max-w-full border-0 lg:min-h-full lg:h-full"
                />
              ) : (
                <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
                  No PDF preview (object URL missing).
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — one scroll: AI breakdown, then answer key (no nested column scrolls). */}
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#01696f]/20 bg-[#01696f]/[0.03] lg:h-full"
          data-review-panel="marks"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 sm:px-4">
            <div className="sticky top-0 z-10 -mx-3 mb-2 border-b border-[#01696f]/15 bg-[#01696f]/[0.06] px-3 py-2 backdrop-blur-sm sm:-mx-4 sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#01696f]">
                Marks &amp; review
              </p>
              <p className="text-[11px] text-muted-foreground">
                Scroll this panel for AI breakdown and answer key — script scrolls separately on the
                left.
              </p>
            </div>

            {questions.map((q) => (
              <Card
                key={q.questionId}
                className="min-w-0 max-w-full border-dashed border-[#01696f]/35 bg-background/90 shadow-sm"
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {q.label}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {q.maxMarks} marks
                      </span>
                    </CardTitle>
                    <div className="text-sm">
                      <span className="text-muted-foreground">AI total </span>
                      <span className="font-semibold tabular-nums text-[#01696f]">
                        {q.aiAwarded.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {q.steps.map((st) => {
                    const eff = effective(st.stepId, st.awarded);
                    const overridden = eff !== st.awarded && !revertedSteps.has(st.stepId);
                    return (
                      <div
                        key={st.stepId}
                        className="rounded-lg border border-dashed border-[#01696f]/30 bg-muted/20 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {stepIcon(st)}
                            <span className="font-medium">Part {st.subPartLabel}</span>
                            {confidenceBadge(st.confidence)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() =>
                                onOverrideChange(st.stepId, Math.max(0, eff - 0.5))
                              }
                            >
                              −
                            </Button>
                            <Input
                              className="h-8 w-16 text-center tabular-nums"
                              type="number"
                              step="any"
                              min={0}
                              max={st.stepMax}
                              value={eff}
                              onChange={(e) =>
                                onOverrideChange(
                                  st.stepId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() =>
                                onOverrideChange(
                                  st.stepId,
                                  Math.min(st.stepMax, eff + 0.5)
                                )
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Max marks for this part: {st.stepMax}
                        </p>
                        {st.llmRubricBlock && (
                          <div className="mt-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              LLM evaluator rubric
                            </p>
                            <pre className="mt-1 rounded-md border border-[#01696f]/20 bg-muted/40 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {st.llmRubricBlock}
                            </pre>
                          </div>
                        )}
                        <div className="mt-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Grading rationale
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{st.justification}</p>
                        </div>
                        {overridden && (
                          <p className="mt-2 text-xs font-medium text-[#01696f]">
                            AI gave {st.awarded} → You set {eff}
                          </p>
                        )}
                        {st.confidence === "low" && (
                          <div className="mt-2 space-y-1">
                            <LabelMini>Reason for override (required if you change marks)</LabelMini>
                            <Textarea
                              ref={
                                st.stepId === firstLowStepId ? firstLowReasonRef : undefined
                              }
                              rows={2}
                              className="text-sm"
                              placeholder="Explain adjustment for low-confidence item…"
                              value={overrideReasons[st.stepId] ?? ""}
                              onChange={(e) => onReasonChange(st.stepId, e.target.value)}
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 text-xs"
                          onClick={() => onRevertStep(st.stepId)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Revert to AI score
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            <section
              id="answer-key-reference"
              className="scroll-mt-4 rounded-xl border border-dashed border-[#01696f]/35 bg-background/95 p-4"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="h-4 w-4 shrink-0 text-[#01696f]" aria-hidden />
                Answer key reference
              </div>
              <ul className="space-y-3 text-sm">
                {answerKeyTree.map((q) => (
                  <li key={q.id} className="rounded-md border bg-muted/30 p-3">
                    <p className="font-semibold">Q{q.questionNo}</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                      {q.steps.map((s) => (
                        <li key={s.id}>
                          <span className="font-mono text-foreground">{s.subPartLabel}</span> ·{" "}
                          {s.marks} marks max — {s.description || "—"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-auto w-full shrink-0 min-w-0 max-w-full rounded-xl border border-[#01696f]/20 bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{studentName}</p>
            <p className="text-xs text-muted-foreground">Roll {rollNo}</p>
            <p className="text-sm text-muted-foreground">
              AI score:{" "}
              <span className="tabular-nums font-semibold text-[#01696f]">
                {aiTotal.toFixed(1)}
              </span>
              /{maxTotal} · Your score:{" "}
              <span className="tabular-nums font-semibold">{yourTotal.toFixed(1)}</span>/
              {maxTotal}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-[#01696f] text-white hover:bg-[#015a5f]"
              onClick={tryApprove}
            >
              Approve {hasNext ? "& Next →" : "& finish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelMini({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}
