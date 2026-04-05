"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CalendarRequest, Classroom, FacilityBooking, StudentTask } from "@/lib/types";
import type { RequestStatus } from "@/lib/types";
import { Calendar as BigCalendar, dateFnsLocalizer, type View, type Event as RBCEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./student-calendar.css";
import { toTitleCase } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  Clock,
  ListTodo,
  MapPin,
  User,
  Users,
  FileText,
  X,
} from "lucide-react";
import {
  combineDateAndTimeLocal,
  FACILITY_TYPE_LABELS,
  facilityVenueLabel,
} from "@/lib/campus-use-cases";
import { Button } from "@/components/ui/button";
import { BigCalendarSkeleton } from "@/components/ui/loading-skeletons";

const statusColors: Record<RequestStatus, string> = {
  pending: "#eab308",
  approved: "#22c55e",
  rejected: "#ef4444",
  clarification_needed: "#3b82f6",
};

const classroomPalette = ["#2563eb", "#7c3aed", "#0f766e", "#ea580c", "#db2777"];

/** Approved campus facility bookings on the professor/student calendar (distinct from classroom blocks). */
const FACILITY_OVERLAY_COLOR = "#0d9488";

/** RBC passes this shape to onSelectSlot */
export type CalendarSlotInfo = {
  start: Date;
  end: Date;
  resourceId?: string | number;
  action?: "select" | "click" | "doubleClick";
};

export interface RequestCalendarProps {
  bookings: CalendarRequest[];
  /** Personal tasks (e.g. from Task Tracker) shown on the same calendar. */
  studentTasks?: StudentTask[];
  classrooms?: Classroom[];
  loading?: boolean;
  /** "classroom" = color by room (default); "status" = color by request status (e.g. admin) */
  colorBy?: "classroom" | "status";
  /** Custom handler when an event is clicked; receives the calendar event and the source request */
  onSelectEvent?: (event: RBCEvent, request: CalendarRequest) => void;
  /**
   * When set with `bookingClassroomId`, users can click/drag empty slots in **week** or **day** view
   * to start a booking for that room.
   */
  onSelectSlot?: (slot: CalendarSlotInfo) => void;
  /**
   * Required for slot selection: which classroom the booking is for.
   * Omit or empty when showing "all rooms" — slot selection is disabled until a room is chosen.
   */
  bookingClassroomId?: string | null;
  /** Optional empty message when there are no bookings and slot selection is disabled */
  emptyMessage?: string;
  /** When true, always show the calendar grid even with no bookings (show emptyMessage as a hint) */
  alwaysShowCalendar?: boolean;
  /** When false, hide the professor-submitted request description in the sidebar */
  showDescription?: boolean;
  /** When false, hide the approval status line in the sidebar */
  showStatus?: boolean;
  /** Optional actions to show in the event detail sidebar (e.g. "Review request" for admin) */
  eventDetailActions?: (request: CalendarRequest, closeSidebar: () => void) => React.ReactNode;
  /**
   * Approved campus facility bookings (auditorium, halls, board rooms, etc.) shown read-only on the same grid.
   */
  facilityBookings?: FacilityBooking[];
  /** Footer text when a facility overlay is selected (e.g. professors use Create new request). */
  facilityBookingHelp?: ReactNode;
}

type CalMeta =
  | {
      kind: "class";
      request: CalendarRequest;
      classroomId: string;
      classroomName: string;
      professorName: string;
      status: RequestStatus;
    }
  | { kind: "task"; task: StudentTask }
  | { kind: "facility"; booking: FacilityBooking };

type CalEvent = RBCEvent & {
  meta: CalMeta;
};

const TASK_STATUS_COLORS = {
  todo: "#64748b",
  in_progress: "#f59e0b",
  completed: "#94a3b8",
} as const;

/**
 * Tasks only store a due *date* (no time). We show them as **all-day** events on that day
 * so they sit in the all-day row (week/day) and read as “due this date”, not a fake 9:00 slot.
 * RBC uses an exclusive end at midnight the next day.
 */
function taskDueAllDayRange(dueDateStr: string): { start: Date; end: Date } {
  const day = dueDateStr.split("T")[0];
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end };
}

/** Calendar event body: icon + label so timetable vs task is obvious at a glance. */
function CalendarEventLabel({
  event,
  title,
}: {
  event: RBCEvent;
  title: string;
}) {
  const cal = event as CalEvent;
  if (cal.meta?.kind === "task") {
    return (
      <span className="flex items-center gap-1 min-w-0 w-full">
        <ListTodo className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
        <span className="truncate font-medium">{cal.meta.task.title}</span>
      </span>
    );
  }
  if (cal.meta?.kind === "facility") {
    return (
      <span className="flex items-center gap-1 min-w-0 w-full">
        <Building2 className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
        <span className="truncate">{title}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 min-w-0 w-full">
      <CalendarDays className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
      <span className="truncate">{title}</span>
    </span>
  );
}

function TaskDetailCard({ task, eventColor }: { task: StudentTask; eventColor: string }) {
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "completed"
        ? "Completed"
        : "To do";
  return (
    <div className="rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: eventColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              My task
            </p>
            <h2 className="text-lg font-semibold leading-tight text-foreground mt-0.5">
              {task.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Due {format(new Date(task.due_date), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        <div className="flex items-center gap-3 text-sm text-foreground">
          <ListTodo className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{statusLabel}</span>
        </div>
        {task.description && (
          <div className="flex items-start gap-3 text-sm text-foreground pt-1 border-t">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{task.description}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">
          Manage this task in the <strong>Task Tracker</strong> tab.
        </p>
      </div>
    </div>
  );
}

const VIEWS: View[] = ["month", "week", "day"];

function EventDetailCard({
  request,
  eventColor,
  showDescription,
  showStatus,
}: {
  request: CalendarRequest;
  eventColor: string;
  showDescription: boolean;
  showStatus: boolean;
}) {
  const professorDisplay =
    request.professor?.full_name ?? request.professor_email ?? "—";
  const statusLabel =
    request.status === "clarification_needed"
      ? "Clarification needed"
      : request.status;
  const groupNames =
    request.student_groups && request.student_groups.length > 0
      ? request.student_groups.map((g) => g.name).join(", ")
      : request.student_group?.name ?? "—";

  return (
    <div className="rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: eventColor }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight text-foreground">
              {request.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(request.event_date), "EEEE, MMMM d")}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        <div className="flex min-w-0 items-center gap-3 text-sm text-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{toTitleCase(request.classroom?.name ?? "—")}</span>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-sm text-foreground">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{toTitleCase(professorDisplay)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-sm text-foreground">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{toTitleCase(groupNames)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>
            {request.start_time?.slice(0, 5)} – {request.end_time?.slice(0, 5)}
          </span>
        </div>
        {showStatus && (
          <div className="flex items-center gap-3 text-sm text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{toTitleCase(statusLabel)}</span>
          </div>
        )}
        {showDescription && request.description && (
          <div className="flex items-start gap-3 text-sm text-foreground pt-1 border-t">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="break-words text-muted-foreground">{request.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FacilityDetailCard({
  booking,
  eventColor,
  bookingHelp,
}: {
  booking: FacilityBooking;
  eventColor: string;
  bookingHelp?: ReactNode;
}) {
  const typeLabel = FACILITY_TYPE_LABELS[booking.facility_type];
  const venue = facilityVenueLabel(booking.facility_type, booking.venue_code);
  const who =
    booking.requester?.full_name ?? booking.requester_email ?? "—";
  return (
    <div className="rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: eventColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Campus facility
            </p>
            <h2 className="text-lg font-semibold leading-tight text-foreground mt-0.5">
              {typeLabel}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(`${booking.booking_date}T12:00:00`), "EEEE, MMMM d")}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        <div className="flex items-center gap-3 text-sm text-foreground">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{venue}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>
            {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{toTitleCase(who)}</span>
        </div>
        {booking.purpose && (
          <div className="flex items-start gap-3 text-sm text-foreground pt-1 border-t">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="break-words text-muted-foreground">{booking.purpose}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2">
          {bookingHelp ?? (
            <>
              Book a facility from the <strong>Campus facilities</strong> tab.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function RequestCalendar({
  bookings,
  studentTasks,
  classrooms = [],
  loading = false,
  colorBy = "classroom",
  onSelectEvent,
  onSelectSlot,
  bookingClassroomId = null,
  emptyMessage,
  alwaysShowCalendar = false,
  showDescription = true,
  showStatus = true,
  eventDetailActions,
  facilityBookings = [],
  facilityBookingHelp,
}: RequestCalendarProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(() => new Date());
  const [selectedPanel, setSelectedPanel] = useState<
    | { kind: "class"; request: CalendarRequest }
    | { kind: "task"; task: StudentTask }
    | { kind: "facility"; booking: FacilityBooking }
    | null
  >(null);

  const canBookSlots = Boolean(onSelectSlot && bookingClassroomId);
  const slotSelectionActive = canBookSlots && (view === "week" || view === "day");

  /** Full 24h day in the time grid */
  const { min, max } = useMemo(() => {
    const base = new Date();
    base.setSeconds(0, 0);
    const minD = new Date(base);
    minD.setHours(0, 0, 0, 0);
    const maxD = new Date(base);
    maxD.setHours(23, 59, 59, 999);
    return { min: minD, max: maxD };
  }, []);

  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
    getDay,
    locales: {},
  });

  const events: CalEvent[] = useMemo(() => {
    const classEvents: CalEvent[] = bookings.map((b) => ({
      title: b.title,
      start: combineDateAndTimeLocal(b.event_date, b.start_time),
      end: combineDateAndTimeLocal(b.event_date, b.end_time),
      allDay: false,
      meta: {
        kind: "class" as const,
        request: b,
        classroomId: b.classroom_id,
        classroomName: b.classroom?.name ?? "—",
        professorName: b.professor?.full_name ?? b.professor_email ?? "—",
        status: b.status,
      },
    }));

    const tasks = studentTasks ?? [];
    const taskEvents: CalEvent[] = tasks.map((t) => {
      const { start, end } = taskDueAllDayRange(t.due_date);
      return {
        title: t.title,
        start,
        end,
        allDay: true,
        meta: { kind: "task" as const, task: t },
      };
    });

    const facilityEvents: CalEvent[] = (facilityBookings ?? [])
      .filter((b) => b.status === "approved")
      .map((b) => {
        const typeLabel = FACILITY_TYPE_LABELS[b.facility_type];
        const venue = facilityVenueLabel(b.facility_type, b.venue_code);
        return {
          title: `${typeLabel} · ${venue}`,
          start: combineDateAndTimeLocal(b.booking_date, b.start_time),
          end: combineDateAndTimeLocal(b.booking_date, b.end_time),
          allDay: false,
          meta: { kind: "facility" as const, booking: b },
        };
      });

    return [...classEvents, ...taskEvents, ...facilityEvents];
  }, [bookings, studentTasks, facilityBookings]);

  function colorForClassroom(classroomId: string): string {
    const idx = classrooms.findIndex((c) => c.id === classroomId);
    return classroomPalette[(idx >= 0 ? idx : 0) % classroomPalette.length];
  }

  function colorForEvent(event: CalEvent): string {
    if (event.meta.kind === "task") {
      const s = event.meta.task.status;
      return TASK_STATUS_COLORS[s] ?? TASK_STATUS_COLORS.todo;
    }
    if (event.meta.kind === "facility") {
      return FACILITY_OVERLAY_COLOR;
    }
    if (colorBy === "status") {
      return statusColors[event.meta.status];
    }
    return event.meta.classroomId
      ? colorForClassroom(event.meta.classroomId)
      : classroomPalette[0];
  }

  function handleSelectEvent(e: RBCEvent) {
    const calEvent = e as CalEvent;
    if (calEvent.meta.kind === "task") {
      setSelectedPanel({ kind: "task", task: calEvent.meta.task });
      return;
    }
    if (calEvent.meta.kind === "facility") {
      setSelectedPanel({
        kind: "facility",
        booking: calEvent.meta.booking,
      });
      return;
    }
    const request = calEvent.meta.request;
    if (onSelectEvent) {
      onSelectEvent(e, request);
      return;
    }
    setSelectedPanel({ kind: "class", request });
  }

  function handleSelectSlot(slotInfo: {
    start: Date;
    end: Date;
    resourceId?: string | number;
    action?: string;
  }) {
    if (!onSelectSlot || !bookingClassroomId) return;
    onSelectSlot({
      start: slotInfo.start,
      end: slotInfo.end,
      resourceId: bookingClassroomId,
      action: slotInfo.action as CalendarSlotInfo["action"],
    });
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <span className="sr-only">Loading calendar</span>
        <BigCalendarSkeleton />
      </div>
    );
  }

  const taskCount = studentTasks?.length ?? 0;
  const facilityApprovedCount =
    facilityBookings?.filter((b) => b.status === "approved").length ?? 0;
  const showEmptyOnly =
    !alwaysShowCalendar &&
    bookings.length === 0 &&
    taskCount === 0 &&
    facilityApprovedCount === 0 &&
    emptyMessage &&
    !onSelectSlot;
  if (showEmptyOnly) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 max-w-full space-y-2">
      {alwaysShowCalendar &&
        bookings.length === 0 &&
        taskCount === 0 &&
        facilityApprovedCount === 0 &&
        emptyMessage && (
        <p className="text-center text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-background p-2">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <div className="h-[min(720px,calc(100dvh-12rem))] min-h-[280px] min-w-[640px]">
          <BigCalendar
            localizer={localizer}
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            views={VIEWS}
            step={60}
            timeslots={1}
            min={min}
            max={max}
            dayLayoutAlgorithm="no-overlap"
            startAccessor="start"
            endAccessor="end"
            selectable={slotSelectionActive ? "ignoreEvents" : false}
            onSelectSlot={slotSelectionActive ? handleSelectSlot : undefined}
            onSelectEvent={handleSelectEvent}
            components={{
              event: CalendarEventLabel,
            }}
            eventPropGetter={(event: RBCEvent) => {
              const cal = event as CalEvent;
              const color = colorForEvent(cal);
              const isTask = cal.meta.kind === "task";
              const isFacility = cal.meta.kind === "facility";
              return {
                className: isTask
                  ? "rbc-calendar-event-task"
                  : isFacility
                    ? "rbc-calendar-event-facility"
                    : "rbc-calendar-event-class",
                style: {
                  backgroundColor: color,
                  borderColor: isTask
                    ? "rgba(255,255,255,0.55)"
                    : isFacility
                      ? "rgba(255,255,255,0.35)"
                      : color,
                  color: "white",
                  borderStyle: isTask ? "dashed" : "solid",
                  borderWidth: isTask || isFacility ? 2 : 1,
                },
              };
            }}
          />
          </div>
        </div>
      </div>

      {/* Event / task detail side panel — slides in from right, no overlay */}
      {selectedPanel && (
        <>
          <div
            className="fixed inset-0 z-[45] bg-black/20"
            aria-hidden
            onClick={() => setSelectedPanel(null)}
          />
          <aside
            className="fixed top-16 bottom-0 right-0 z-[60] flex w-full max-w-md flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label={
              selectedPanel.kind === "task"
                ? "Task details"
                : selectedPanel.kind === "facility"
                  ? "Facility booking details"
                  : "Event details"
            }
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPanel(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedPanel.kind === "class" ? (
                <EventDetailCard
                  request={selectedPanel.request}
                  eventColor={
                    colorBy === "status"
                      ? statusColors[selectedPanel.request.status]
                      : colorForClassroom(selectedPanel.request.classroom_id)
                  }
                  showDescription={showDescription}
                  showStatus={showStatus}
                />
              ) : selectedPanel.kind === "facility" ? (
                <FacilityDetailCard
                  booking={selectedPanel.booking}
                  eventColor={FACILITY_OVERLAY_COLOR}
                  bookingHelp={facilityBookingHelp}
                />
              ) : (
                <TaskDetailCard
                  task={selectedPanel.task}
                  eventColor={
                    TASK_STATUS_COLORS[selectedPanel.task.status] ??
                    TASK_STATUS_COLORS.todo
                  }
                />
              )}
            </div>
            {eventDetailActions && selectedPanel.kind === "class" && (
              <div className="shrink-0 border-t p-4 bg-background">
                {eventDetailActions(selectedPanel.request, () => setSelectedPanel(null))}
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
