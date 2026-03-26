"use client";

import { cn } from "@/lib/utils";

type AppLoadingStateProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

export function AppLoadingState({
  title = "Loading",
  subtitle = "Preparing your workspace...",
  compact = false,
  className,
}: AppLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        compact ? "py-8" : "min-h-[60vh]",
        className
      )}
    >
      <div className="w-full max-w-sm rounded-xl border bg-background/95 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.24s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary/80 [animation-delay:-0.12s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary/60" />
          <p className="ml-1 text-sm font-medium">{title}</p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/70" />
        </div>

        {!compact && <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
