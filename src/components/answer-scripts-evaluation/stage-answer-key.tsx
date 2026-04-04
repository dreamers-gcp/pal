"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExamQuestion, ExamSetup, ExamStep } from "./types";

function cloneQuestions(qs: ExamQuestion[]): ExamQuestion[] {
  return qs.map((q) => ({
    ...q,
    steps: q.steps.map((s) => ({ ...s })),
  }));
}

export function StageAnswerKey({
  setup,
  file,
  objectUrl,
  onFile,
  parsedQuestions,
  onParsedChange,
  onBack,
  onNext,
}: {
  setup: ExamSetup;
  file: File | null;
  objectUrl: string | null;
  onFile: (f: File | null, url: string | null) => void;
  parsedQuestions: ExamQuestion[];
  onParsedChange: (q: ExamQuestion[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  /** When true, rubric tree is locked and professor can proceed. */
  const [structureLocked, setStructureLocked] = useState(false);

  const stats = useMemo(() => {
    const qn = parsedQuestions.length;
    const parts = parsedQuestions.reduce((a, q) => a + q.steps.length, 0);
    const marks = parsedQuestions.reduce(
      (a, q) => a + q.steps.reduce((s, st) => s + (Number(st.marks) || 0), 0),
      0
    );
    return { qn, parts, marks };
  }, [parsedQuestions]);

  function ingestPdf(f: File) {
    if (f.type !== "application/pdf") return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    onFile(f, url);
  }

  function updateStepMarks(qid: string, sid: string, marks: number) {
    onParsedChange(
      parsedQuestions.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              steps: q.steps.map((s) => (s.id === sid ? { ...s, marks } : s)),
            }
      )
    );
  }

  function updateStepLabel(qid: string, sid: string, subPartLabel: string) {
    onParsedChange(
      parsedQuestions.map((q) =>
        q.id !== qid
          ? q
          : {
              ...q,
              steps: q.steps.map((s) => (s.id === sid ? { ...s, subPartLabel } : s)),
            }
      )
    );
  }

  const canNext = Boolean(file) && structureLocked;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Answer key (PDF)</CardTitle>
          <CardDescription>
            Step 2 — upload the official key. AI parse preview is simulated from your setup structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            id="ae-key-pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingestPdf(f);
            }}
          />
          <label
            htmlFor="ae-key-pdf"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) ingestPdf(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
              dragOver
                ? "border-[#01696f] bg-[#01696f]/[0.08]"
                : "border-muted-foreground/25 bg-muted/20 hover:border-[#01696f]/40 hover:bg-[#01696f]/[0.04]"
            )}
          >
            <Upload className="mb-2 h-10 w-10 text-[#01696f]/70" />
            <p className="text-sm font-medium">Drag and drop answer key PDF</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse · .pdf only</p>
            {file && (
              <p className="mt-3 flex items-center gap-2 text-sm text-[#01696f]">
                <FileText className="h-4 w-4" />
                {file.name}
              </p>
            )}
          </label>

          {file && (
            <div className="space-y-4 rounded-xl border border-dashed border-[#01696f]/35 bg-[#01696f]/[0.05] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#01696f]">Rubric structure (from setup)</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.qn} questions, {stats.parts} sub-parts, {stats.marks} total marks · The answer
                    key PDF is sent to the grader with each student script.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={structureLocked ? "outline" : "default"}
                    className={
                      structureLocked ? "" : "bg-[#01696f] text-white hover:bg-[#015a5f]"
                    }
                    onClick={() => setStructureLocked((l) => !l)}
                  >
                    {structureLocked ? "Unlock to edit" : "Confirm structure"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Adjust marks or labels if needed, then press <strong>Confirm structure</strong> to lock
                and continue.
              </p>
            </div>
          )}

          <div className="grid min-h-[420px] gap-4 lg:grid-cols-2">
            <div className="flex min-h-[320px] flex-col rounded-xl border bg-muted/20">
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                PDF preview
              </p>
              {objectUrl ? (
                <iframe title="Answer key PDF" src={objectUrl} className="min-h-[360px] flex-1 w-full rounded-b-xl" />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Upload a PDF to preview here.
                </div>
              )}
            </div>
            <div className="flex min-h-[320px] flex-col rounded-xl border">
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                Parsed structure — marks editable
              </p>
              <div className="max-h-[420px] flex-1 space-y-3 overflow-y-auto p-3">
                {parsedQuestions.map((q) => (
                  <div key={q.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                    <p className="mb-2 font-semibold">
                      Question {q.questionNo}
                    </p>
                    <ul className="space-y-2">
                      {q.steps.map((st: ExamStep) => (
                        <li
                          key={st.id}
                          className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0"
                        >
                          <Input
                            className="h-8 w-16 font-mono text-xs"
                            value={st.subPartLabel}
                            disabled={structureLocked}
                            onChange={(e) => updateStepLabel(q.id, st.id, e.target.value)}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {st.description || "—"}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            <Label className="sr-only">Full marks</Label>
                            <Input
                              type="number"
                              className="h-8 w-14"
                              min={0}
                              step="any"
                              value={st.marks}
                              disabled={structureLocked}
                              onChange={(e) =>
                                updateStepMarks(q.id, st.id, parseFloat(e.target.value) || 0)
                              }
                              title="Full marks"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-[#01696f] text-white hover:bg-[#015a5f]"
              disabled={!canNext}
              onClick={onNext}
            >
              Continue to scripts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { cloneQuestions };
