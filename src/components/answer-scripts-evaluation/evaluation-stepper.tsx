"use client";

import { cn } from "@/lib/utils";
import { AE_TEAL } from "./constants";
import { Check } from "lucide-react";

export function EvaluationStepper({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Setup" },
    { n: 2, label: "Answer Key" },
    { n: 3, label: "Scripts" },
    { n: 4, label: "Evaluation" },
    { n: 5, label: "Review" },
  ];

  return (
    <nav
      className="rounded-xl border border-[#01696f]/20 bg-[#01696f]/[0.04] px-3 py-3 sm:px-4"
      aria-label="Evaluation progress"
    >
      <ol className="flex flex-wrap items-center justify-between gap-2 sm:gap-1">
        {steps.map((s, i) => {
          const done = s.n < current;
          const active = current === s.n;
          return (
            <li key={s.n} className="flex min-w-0 flex-1 items-center sm:flex-initial sm:basis-0">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:flex-row sm:gap-2">
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
                    "max-w-[5.5rem] truncate text-center text-[11px] font-medium sm:max-w-none sm:text-left sm:text-xs",
                    active && "text-[#01696f]",
                    !active && !done && "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 hidden h-px min-w-[12px] flex-1 sm:mx-2 sm:block",
                    current > s.n ? "bg-[#01696f]/40" : "bg-border"
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
