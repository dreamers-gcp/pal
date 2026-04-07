"use client";

import { cn } from "@/lib/utils";
import { AE_TEAL } from "./constants";
import { Check } from "lucide-react";

export function EvaluationStepper({ current }: { current: number }) {
  const steps: { n: number; label: string; title?: string }[] = [
    {
      n: 1,
      label: "Answer Key",
      title: "Exam details + upload answer key & marking scheme PDF",
    },
    {
      n: 2,
      label: "Student Scripts",
      title: "Upload student answer scripts",
    },
    {
      n: 3,
      label: "Evaluate",
      title: "AI grades each script, then review marks",
    },
  ];

  return (
    <nav
      className="w-full min-w-0 overflow-x-auto rounded-xl border border-[#01696f]/20 bg-[#01696f]/[0.04] px-2 py-3 sm:px-4"
      aria-label="Evaluation progress"
    >
      <ol className="grid w-full min-w-0 grid-cols-3 gap-x-1 gap-y-2 sm:gap-x-2">
        {steps.map((s) => {
          const done = s.n < current;
          const active = current === s.n;
          return (
            <li key={s.n} className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-[#01696f] text-white",
                  active && !done && "bg-[#01696f]/15 text-[#01696f] ring-2 ring-[#01696f]/40",
                  !active && !done && "bg-muted text-muted-foreground"
                )}
                style={done ? { backgroundColor: AE_TEAL } : undefined}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.n}
              </span>
              <span
                className={cn(
                  "w-full min-w-0 truncate px-0.5 text-center text-[11px] font-medium sm:text-xs",
                  active && "text-[#01696f]",
                  !active && !done && "text-muted-foreground"
                )}
                title={s.title}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
