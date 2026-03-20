"use client";

import { useMemo, useState } from "react";
import type { CalendarRequest, Classroom } from "@/lib/types";
import type { RequestStatus } from "@/lib/types";
import { Calendar as BigCalendar, dateFnsLocalizer, type View, type Event as RBCEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./student-calendar.css";
import { toTitleCase } from "@/lib/utils";
import { CalendarDays, Clock, MapPin, User, Users, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors: Record<RequestStatus, string> = {
  pending: "#eab308",
  approved: "#22c55e",
  rejected: "#ef4444",
  clarification_needed: "#3b82f6",
};

const classroomPalette = ["#2563eb", "#7c3aed", "#0f766e", "#ea580c", "#db2777"];

/** RBC passes this shape to onSelectSlot */
export type CalendarSlotInfo = {
  start: Date;
  end: Date;
  resourceId?: string | number;
  action?: "select" | "click" | "doubleClick";
};

export interface RequestCalendarProps {
  bookings: CalendarRequest[];
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
}

type CalMeta = {
  request: CalendarRequest;
  classroomId: string;
  classroomName: string;
  professorName: string;
  status: RequestStatus;
};

type CalEvent = RBCEvent & {
  meta: CalMeta;
};

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
        <div className="flex items-center gap-3 text-sm text-foreground">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{toTitleCase(request.classroom?.name ?? "—")}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{toTitleCase(professorDisplay)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-foreground">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{toTitleCase(groupNames)}</span>
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
            <span className="text-muted-foreground">{request.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RequestCalendar({
  bookings,
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
}: RequestCalendarProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(() => new Date());
  const [selectedEventRequest, setSelectedEventRequest] = useState<CalendarRequest | null>(null);

  const canBookSlots = Boolean(onSelectSlot && bookingClassroomId);
  const slotSelectionActive = canBookSlots && (view === "week" || view === "day");

  /** Match BookedSchedule: 8:00–23:00 (week/day time grid) */
  const { min, max } = useMemo(() => {
    const base = new Date();
    base.setSeconds(0, 0);
    const minD = new Date(base);
    minD.setHours(8, 0, 0, 0);
    const maxD = new Date(base);
    maxD.setHours(23, 0, 0, 0);
    return { min: minD, max: maxD };
  }, []);

  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
    getDay,
    locales: {},
  });

  const events: CalEvent[] = useMemo(
    () =>
      bookings.map((b) => ({
        title: b.title,
        start: new Date(`${b.event_date}T${b.start_time}`),
        end: new Date(`${b.event_date}T${b.end_time}`),
        allDay: false,
        meta: {
          request: b,
          classroomId: b.classroom_id,
          classroomName: b.classroom?.name ?? "—",
          professorName: b.professor?.full_name ?? b.professor_email ?? "—",
          status: b.status,
        },
      })),
    [bookings]
  );

  function colorForClassroom(classroomId: string): string {
    const idx = classrooms.findIndex((c) => c.id === classroomId);
    return classroomPalette[(idx >= 0 ? idx : 0) % classroomPalette.length];
  }

  function colorForEvent(event: CalEvent): string {
    if (colorBy === "status" && event.meta?.status) {
      return statusColors[event.meta.status];
    }
    return event.meta?.classroomId
      ? colorForClassroom(event.meta.classroomId)
      : classroomPalette[0];
  }

  function handleSelectEvent(e: RBCEvent) {
    const calEvent = e as CalEvent;
    const request = calEvent.meta?.request;
    if (onSelectEvent && request) {
      onSelectEvent(e, request);
      return;
    }
    if (request) setSelectedEventRequest(request);
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
      <div className="flex justify-center py-16">
        <div className="animate-pulse text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  const showEmptyOnly =
    !alwaysShowCalendar && bookings.length === 0 && emptyMessage && !onSelectSlot;
  if (showEmptyOnly) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      {alwaysShowCalendar && bookings.length === 0 && emptyMessage && (
        <p className="text-center text-sm text-muted-foreground">{emptyMessage}</p>
      )}
      <div className="rounded-lg border bg-background overflow-hidden p-2">
        <div className="h-[720px]">
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
            eventPropGetter={(event: RBCEvent) => {
              const color = colorForEvent(event as CalEvent);
              return {
                style: {
                  backgroundColor: color,
                  borderColor: color,
                  color: "white",
                },
              };
            }}
          />
        </div>
      </div>

      {/* Event detail side panel — slides in from right, no overlay */}
      {selectedEventRequest && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setSelectedEventRequest(null)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label="Event details"
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEventRequest(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <EventDetailCard
                request={selectedEventRequest}
                eventColor={
                  colorBy === "status"
                    ? statusColors[selectedEventRequest.status]
                    : colorForClassroom(selectedEventRequest.classroom_id)
                }
                showDescription={showDescription}
                showStatus={showStatus}
              />
            </div>
            {eventDetailActions && (
              <div className="shrink-0 border-t p-4 bg-background">
                {eventDetailActions(selectedEventRequest, () => setSelectedEventRequest(null))}
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
