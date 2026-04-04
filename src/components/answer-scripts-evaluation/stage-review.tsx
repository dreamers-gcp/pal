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
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  Flag,
  RotateCcw,
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
  studentId,
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
  onFlag,
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
  onFlag: () => void;
  onBackToQueue: () => void;
  hasNext: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const [keyOpen, setKeyOpen] = useState(true);
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
    <div className="flex w-full min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-x-hidden pb-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBackToQueue}>
          ← Queue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <kbd className="rounded border bg-muted px-1 text-xs">→</kbd> Next ·{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">A</kbd> Approve ·{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">O</kbd> Override note
        </p>
      </div>

      <div className="grid w-full min-h-0 min-w-0 max-w-full flex-1 gap-4 lg:grid-cols-[minmax(0,35fr)_minmax(0,40fr)_minmax(0,25fr)] lg:items-stretch lg:max-h-[min(calc(100dvh-14rem),760px)] lg:overflow-hidden">
        {/* LEFT — script PDF */}
        <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden lg:min-h-[240px] lg:max-h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
          <CardContent className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden p-2 pt-0">
            <div
              className="h-full min-h-[200px] min-w-0 max-w-full overflow-auto rounded-lg border bg-muted/20"
              style={{ zoom: `${zoom}%` } as React.CSSProperties}
            >
              {scriptUrl ? (
                <iframe
                  title="Student script"
                  src={scriptUrl}
                  className="h-full min-h-[200px] w-full max-w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                  No PDF preview (object URL missing).
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CENTER — AI breakdown */}
        <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col space-y-3 overflow-y-auto overflow-x-hidden lg:max-h-full">
          {questions.map((q) => (
            <Card
              key={q.questionId}
              className="min-w-0 max-w-full border-dashed border-[#01696f]/35 bg-[#01696f]/[0.04]"
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
                      className="rounded-lg border border-dashed border-[#01696f]/30 bg-background/80 p-3"
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
                              onOverrideChange(
                                st.stepId,
                                Math.max(0, eff - 0.5)
                              )
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
                          <pre className="mt-1 max-h-36 overflow-y-auto rounded-md border border-[#01696f]/20 bg-muted/40 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                            {st.llmRubricBlock}
                          </pre>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">{st.justification}</p>
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
        </div>

        {/* RIGHT — answer key */}
        <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden lg:max-h-full">
          <button
            type="button"
            onClick={() => setKeyOpen((o) => !o)}
            className="flex items-center justify-between border-b px-4 py-3 text-left font-medium"
          >
            Answer key reference
            {keyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {keyOpen && (
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
              {answerKeyTree.map((q) => (
                <div key={q.id} className="mb-3 rounded-md border p-2">
                  <p className="font-semibold">Q{q.questionNo}</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {q.steps.map((s) => {
                      const bands = [...(s.scoringBands ?? [])].sort((a, b) => b.score - a.score);
                      return (
                        <li key={s.id} className="space-y-1">
                          <div>
                            <span className="font-mono text-foreground">{s.subPartLabel}</span> ·{" "}
                            {s.marks} marks — {s.description || "—"}
                          </div>
                          {bands.length > 0 && (
                            <ul className="ml-2 list-none space-y-0.5 border-l-2 border-[#01696f]/25 pl-2 text-[10px] text-muted-foreground">
                              {bands.map((b) => (
                                <li key={b.id}>
                                  <span className="tabular-nums font-mono text-foreground">
                                    {b.score}
                                  </span>{" "}
                                  = {b.criterion || "—"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Sticky action bar (within dashboard scroll area) */}
      <div className="sticky bottom-0 z-20 mt-4 w-full min-w-0 max-w-full rounded-xl border border-[#01696f]/20 bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{studentName}</p>
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
            <Button type="button" variant="outline" onClick={onFlag}>
              <Flag className="mr-1 h-4 w-4" />
              Flag for peer review
            </Button>
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
