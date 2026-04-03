"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Full dashboard chrome: title area, tab strip, content cards (professor/student-style). */
export function DashboardShellSkeleton({
  variant = "member",
  className,
}: {
  variant?: "member" | "admin";
  className?: string;
}) {
  const tabCount = variant === "admin" ? 7 : 6;
  const cardCount = variant === "admin" ? 6 : 6;
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-[85vw] rounded-lg" />
        {variant === "admin" && (
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: tabCount }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[7.5rem] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-4 space-y-3 shadow-sm"
          >
            <Skeleton className="h-5 w-[55%] rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sports / guest-house style request card grid. */
export function BookingCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Admin roster / similar table loading. */
export function RosterTableSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden", className)}>
      <div className="grid grid-cols-[1fr_1.2fr_1.5fr_100px] gap-4 px-4 py-3 border-b bg-muted/50">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1.2fr_1.5fr_100px] gap-4 items-center px-4 py-3 border-b last:border-b-0"
        >
          <Skeleton className="h-4 w-full max-w-[140px] rounded-md" />
          <Skeleton className="h-4 w-full max-w-[200px] rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
          <Skeleton className="h-6 w-16 justify-self-center rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Professor assignments CSV preview (wide table). */
export function ProfessorAssignmentTableSkeleton({
  className,
}: {
  className?: string;
}) {
  const cols = 10;
  const rows = 8;
  return (
    <div className={cn("rounded-lg border overflow-hidden overflow-x-auto", className)}>
      <div className="flex gap-2 px-2 py-2 border-b bg-muted/50 min-w-max">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-[4.5rem] shrink-0 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2 px-2 py-2 border-b last:border-b-0 min-w-max">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-[4.5rem] shrink-0 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Enrollment / professor CSV table area. */
export function EnrollmentTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b bg-muted/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16 rounded-md" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-5 gap-2 px-3 py-2 border-b last:border-b-0"
        >
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Big calendar / timetable week area. */
export function CalendarPanelSkeleton({
  className,
  minHeight = "min-h-[400px]",
}: {
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background overflow-hidden flex flex-col",
        minHeight,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex-1 p-2 grid grid-cols-[56px_1fr] gap-1">
        <div className="space-y-2 border-r pr-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-sm" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-full min-h-[200px] rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** react-big-calendar-sized placeholder (month/week toolbars + body). */
export function BigCalendarSkeleton({
  className,
  heightClass = "h-[720px]",
}: {
  className?: string;
  heightClass?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden p-2", className)}>
      <div className={cn("flex flex-col gap-2", heightClass)}>
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Skeleton className="h-9 w-40 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="flex-1 w-full rounded-md min-h-0" />
      </div>
    </div>
  );
}

/** Attendance tab: filters + stacked rows. */
export function AttendanceViewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full max-w-lg rounded-md" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Task tracker kanban columns. */
export function TaskBoardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="rounded-xl border bg-muted/20 p-3 space-y-3 min-h-[280px]">
          <Skeleton className="h-6 w-24 rounded-md" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-3 w-2/3 rounded-md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Timetable generator initial load. */
export function TimetableGeneratorSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </CardContent>
      </Card>
      <CalendarPanelSkeleton minHeight="min-h-[320px]" />
    </div>
  );
}

/** Compact weekly grid placeholder (expanded timetable row / dialog). */
export function WeeklySlotGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md border overflow-hidden", className)}>
      <div className="grid grid-cols-8 gap-px bg-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-none bg-muted" />
        ))}
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-none bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

/** Face registration / small card forms. */
export function FaceRegistrationSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

/** Attendance marker “today’s classes” list. */
export function AttendanceMarkerListSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-5 w-[55%] rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Campus admin tab sections (stacked cards). */
export function CampusRequestsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
