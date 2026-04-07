"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Info, Upload, FileText } from "lucide-react";
import type { ExamSetup, EvaluationStrictness } from "./types";
import { STRICTNESS_OPTIONS } from "./constants";

export function createInitialSetup(): ExamSetup {
  return {
    name: "",
    subject: "",
    date: new Date().toISOString().slice(0, 10),
    totalMarks: 0,
    questions: [],
    strictness: "conceptual",
  };
}

export function StageSetup({
  value,
  onChange,
  answerKeyFile,
  answerKeyUrl,
  onAnswerKeyFile,
  onNext,
}: {
  value: ExamSetup;
  onChange: (next: ExamSetup) => void;
  answerKeyFile: File | null;
  answerKeyUrl: string | null;
  onAnswerKeyFile: (f: File | null, url: string | null) => void;
  onNext: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function setStrictness(s: EvaluationStrictness) {
    onChange({ ...value, strictness: s });
  }

  function ingestPdf(f: File) {
    if (f.type !== "application/pdf") return;
    if (answerKeyUrl) URL.revokeObjectURL(answerKeyUrl);
    onAnswerKeyFile(f, URL.createObjectURL(f));
  }

  const canNext = value.name.trim() && value.subject.trim() && Boolean(answerKeyFile);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-[#01696f]/25 bg-[#01696f]/[0.06] px-4 py-3 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#01696f]" aria-hidden />
        <p className="text-foreground/90">
          <span className="font-semibold text-[#01696f]">Step 1:</span> Enter exam
          details and upload your <strong>answer key + marking scheme</strong> as a
          single PDF. The AI reads this document to learn the correct answers and
          marks per question. If no marking scheme is found, a default of 10 marks
          per question is used.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exam details &amp; answer key</CardTitle>
          <CardDescription>
            Fill in the exam info, choose evaluation strictness, and upload the
            professor&apos;s answer key with marking scheme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* --- Exam info --- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ae-exam-name">Exam name</Label>
              <Input
                id="ae-exam-name"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                placeholder="e.g. Mid-term — Data Structures"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ae-subject">Subject</Label>
              <Input
                id="ae-subject"
                value={value.subject}
                onChange={(e) => onChange({ ...value, subject: e.target.value })}
                placeholder="e.g. CS201"
              />
            </div>
            <div className="space-y-2">
              <Label>Exam date</Label>
              <DatePicker
                value={value.date}
                onChange={(d) => onChange({ ...value, date: d })}
                placeholder="Pick date"
              />
            </div>
          </div>

          {/* --- Strictness --- */}
          <div className="space-y-2">
            <Label>Evaluation strictness</Label>
            <div className="flex flex-wrap gap-2">
              {STRICTNESS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStrictness(opt.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors",
                    value.strictness === opt.id
                      ? "border-[#01696f] bg-[#01696f] text-white shadow-sm"
                      : "border-border bg-background hover:bg-muted/60"
                  )}
                >
                  <span className="block">{opt.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs font-normal",
                      value.strictness === opt.id ? "text-white/85" : "text-muted-foreground"
                    )}
                  >
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* --- Answer key PDF upload --- */}
          <div className="space-y-3">
            <Label>Answer key &amp; marking scheme (single PDF)</Label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              id="ae-answer-key-pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) ingestPdf(f);
              }}
            />
            <label
              htmlFor="ae-answer-key-pdf"
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
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
                dragOver
                  ? "border-[#01696f] bg-[#01696f]/[0.08]"
                  : "border-muted-foreground/25 bg-muted/20 hover:border-[#01696f]/40 hover:bg-[#01696f]/[0.04]"
              )}
            >
              <Upload className="mb-2 h-10 w-10 text-[#01696f]/70" />
              <p className="text-sm font-medium">Answer key + marking scheme (single PDF)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drag and drop or click to browse · .pdf only
              </p>
              {answerKeyFile && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#01696f]">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{answerKeyFile.name}</span>
                </p>
              )}
            </label>

            {/* PDF preview */}
            <div className="flex min-h-[300px] flex-col rounded-xl border bg-muted/20">
              <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                Preview
              </p>
              {answerKeyUrl ? (
                <iframe
                  title="Answer key PDF"
                  src={answerKeyUrl}
                  className="min-h-[300px] w-full flex-1 rounded-b-xl"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Upload a PDF to preview here.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              className="bg-[#01696f] text-white hover:bg-[#015a5f]"
              disabled={!canNext}
              onClick={onNext}
            >
              Continue to student scripts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
