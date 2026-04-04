"use client";

import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, Send, User, Users } from "lucide-react";
import type { CalendarRequest, RequestStatus } from "@/lib/types";
import { formatSubmittedAt, toTitleCase } from "@/lib/utils";
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
    className: "bg-accent/15 text-accent-foreground dark:bg-accent/25",
    accent: "bg-accent",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    accent: "bg-destructive",
  },
  clarification_needed: {
    label: "Clarification",
    className: "bg-primary/10 text-primary dark:bg-primary/20",
    accent: "bg-primary",
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
            <span className="inline-flex flex-wrap items-center gap-2">
              {request.title}
              {request.request_kind === "exam" && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Exam
                </span>
              )}
            </span>
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
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Send className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="text-xs">
              Submitted at {formatSubmittedAt(request.created_at)}
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
