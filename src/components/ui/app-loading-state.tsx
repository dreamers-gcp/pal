"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShellSkeleton } from "@/components/ui/loading-skeletons";

type AppLoadingStateProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

/**
 * Full-page or section loading: skeleton layout instead of a progress bar.
 */
export function AppLoadingState({
  title = "Loading",
  subtitle = "Preparing your workspace...",
  compact = false,
  className,
}: AppLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch justify-center",
        compact ? "py-8" : "min-h-[55vh] py-10",
        className
      )}
    >
      <span className="sr-only">
        {title}
        {subtitle ? `. ${subtitle}` : ""}
      </span>

      {compact ? (
        <div className="mx-auto w-full max-w-xl space-y-4 px-4">
          <Skeleton className="h-5 w-52 rounded-md" />
          <Skeleton className="h-4 w-full max-w-md rounded-md" />
          <Skeleton className="h-40 w-full rounded-xl border border-transparent bg-muted/40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-4 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56 rounded-md" />
            {subtitle ? (
              <Skeleton className="h-4 w-full max-w-lg rounded-md" />
            ) : null}
          </div>
          <DashboardShellSkeleton variant="member" />
        </div>
      )}
    </div>
  );
}
