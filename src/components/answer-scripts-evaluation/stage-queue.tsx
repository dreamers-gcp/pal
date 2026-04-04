"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvalPhase, EvalStudent } from "./types";

function phaseBadge(phase: EvalPhase) {
  switch (phase) {
    case "waiting":
      return <Badge className="bg-slate-200 text-slate-800">Waiting</Badge>;
    case "reading":
      return <Badge className="bg-blue-600 text-white">Reading</Badge>;
    case "comparing":
      return <Badge className="bg-amber-500 text-amber-950">Comparing</Badge>;
    case "scored":
      return <Badge className="bg-emerald-600 text-white">Scored</Badge>;
    case "failed":
      return <Badge variant="destructive">Needs review</Badge>;
    default:
      return null;
  }
}

function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        className="text-muted/30"
        strokeWidth={stroke}
        stroke="currentColor"
        fill="none"
        r={r}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="text-[#01696f] transition-[stroke-dashoffset] duration-300"
        strokeWidth={stroke}
        stroke="currentColor"
        fill="none"
        r={r}
        cx={size / 2}
        cy={size / 2}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StageQueue({
  students,
  paused,
  setPaused,
  canOpenReview,
  onBack,
  onOpenReview,
  onExportCsv,
}: {
  students: EvalStudent[];
  paused: boolean;
  setPaused: (v: boolean) => void;
  canOpenReview: (studentId: string) => boolean;
  onBack: () => void;
  onOpenReview: (studentId: string) => void;
  onExportCsv: () => void;
}) {
  const evaluated = students.filter((s) => s.phase === "scored").length;
  const total = students.length;
  const remaining = Math.max(0, total - evaluated);
  const estMin = Math.ceil((remaining * 0.35) / 1);

  const headerLine = useMemo(
    () => `${evaluated} / ${total} evaluated · Estimated ${estMin} min remaining`,
    [evaluated, total, estMin]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">AI evaluation queue</CardTitle>
            <CardDescription>Step 4 — simulated pipeline. Click a scored card to review.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-[#01696f]/20 bg-[#01696f]/[0.06] px-4 py-3 text-sm font-medium text-[#01696f]">
            {headerLine}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((s) => {
              const canReview = s.phase === "scored" && canOpenReview(s.id);
              return (
              <button
                key={s.id}
                type="button"
                onClick={() => canReview && onOpenReview(s.id)}
                disabled={!canReview}
                className={cn(
                  "flex gap-3 rounded-xl border bg-card p-3 text-left transition-shadow",
                  canReview && "cursor-pointer hover:border-[#01696f]/50 hover:shadow-md",
                  s.phase === "scored" && !canOpenReview(s.id) && "opacity-80",
                  s.phase !== "scored" && "opacity-95"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <ProgressRing value={s.progress} />
                  <span className="absolute text-[10px] font-semibold tabular-nums text-[#01696f]">
                    {s.progress}%
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium leading-tight">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Roll {s.rollNo}</p>
                  {phaseBadge(s.phase)}
                  {s.phase === "scored" && !canOpenReview(s.id) && (
                    <p className="text-[10px] text-[#01696f]">Preparing breakdown…</p>
                  )}
                </div>
              </button>
            );
            })}
          </div>

          <div className="flex justify-start border-t pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
