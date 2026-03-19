"use client";

import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, User, Users } from "lucide-react";
import type { CalendarRequest, RequestStatus } from "@/lib/types";
import { toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  RequestStatus,
  { label: string; className: string; accent: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/12 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20",
    accent: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20",
    accent: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/12 text-red-700 dark:text-red-400 dark:bg-red-500/20",
    accent: "bg-red-500",
  },
  clarification_needed: {
    label: "Clarification",
    className: "bg-sky-500/12 text-sky-700 dark:text-sky-400 dark:bg-sky-500/20",
    accent: "bg-sky-500",
  },
};

export interface RequestCardProps {
  request: CalendarRequest;
  onClick?: () => void;
  /** Show professor name (e.g. admin view). Default true. */
  showProfessor?: boolean;
  /** Show admin note block when present (e.g. professor view). Default false. */
  showAdminNote?: boolean;
}

export function RequestCard({
  request,
  onClick,
  showProfessor = false,
  showAdminNote = false,
}: RequestCardProps) {
  const config = statusConfig[request.status];
  const groupNames =
    request.student_groups && request.student_groups.length > 0
      ? request.student_groups.map((g) => g.name).join(", ")
      : request.student_group?.name ?? "—";

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200",
        onClick &&
          "cursor-pointer hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      onClick={onClick}
    >
      {/* Status accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 shrink-0", config.accent)} />

      <CardHeader className="pb-2 pl-5 pr-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-base font-semibold leading-tight">
            {request.title}
          </CardTitle>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
              config.className
            )}
          >
            {config.label}
          </span>
        </div>
        {request.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {request.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pl-5 pr-4 pb-4">
        <div className="grid gap-2 text-sm">
          {showProfessor && (
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <User className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              <span className="truncate">
                {toTitleCase(
                  request.professor?.full_name ?? request.professor_email ?? "—"
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>{format(new Date(request.event_date), "EEE, MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              {request.start_time.slice(0, 5)} – {request.end_time.slice(0, 5)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{toTitleCase(groupNames)}</span>
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="truncate">
              {toTitleCase(request.classroom?.name ?? "—")}
            </span>
          </div>
        </div>

        {showAdminNote && request.admin_note && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground/90">Admin note</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {request.admin_note}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
