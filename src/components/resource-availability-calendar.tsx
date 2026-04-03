"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type Event as RBCEvent,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./student-calendar.css";
import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentProviderCode,
  FacilityBookingType,
  SportType,
  SportsVenueCode,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const BUSY_COLOR = "#64748b";

/** Week-only: month view is confusing for slot availability on request forms. */
const VIEWS: View[] = ["week"];

export type ResourceAvailabilitySpec =
  | { kind: "classroom"; classroomId: string; label?: string }
  | {
      kind: "sports";
      sport: SportType;
      venueCode: SportsVenueCode;
      label?: string;
    }
  | {
      kind: "facility";
      facilityType: FacilityBookingType;
      venueCode: string;
      label?: string;
    }
  | { kind: "appointment"; providerCode: AppointmentProviderCode; label?: string };

type BusyEvent = RBCEvent & { id: string };

/** Body text only — TimeGridEvent always shows `eventTimeRangeFormat` in `.rbc-event-label`. */
function busyEventTitle(titleExtra?: string): string {
  if (titleExtra) return `${titleExtra} · Booked`;
  return "Booked";
}

function resourceFetchKey(r: ResourceAvailabilitySpec | null): string {
  if (!r) return "";
  if (r.kind === "classroom") return `c:${r.classroomId}`;
  if (r.kind === "sports") return `s:${r.sport}:${r.venueCode}`;
  if (r.kind === "facility") return `f:${r.facilityType}:${r.venueCode}`;
  return `a:${r.providerCode}`;
}

function rangeAround(date: Date, monthsBack: number, monthsForward: number) {
  const from = format(
    startOfMonth(subMonths(date, monthsBack)),
    "yyyy-MM-dd"
  );
  const to = format(endOfMonth(addMonths(date, monthsForward)), "yyyy-MM-dd");
  return { from, to };
}

export function ResourceAvailabilityCalendar({
  resource,
  className,
  compact = false,
}: {
  resource: ResourceAvailabilitySpec | null;
  className?: string;
  /** Tighter grid for drawers/sidebars. */
  compact?: boolean;
}) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<BusyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const calendarFormats = useMemo(
    () => ({
      timeGutterFormat: (d: Date) => format(d, "h:mm a"),
      selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`,
      eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`,
      eventTimeRangeStartFormat: ({ start }: { start: Date }) =>
        `${format(start, "h:mm a")} – `,
      eventTimeRangeEndFormat: ({ end }: { end: Date }) =>
        ` – ${format(end, "h:mm a")}`,
    }),
    []
  );

  const fetchKey = resourceFetchKey(resource);
  const resourceRef = useRef(resource);
  resourceRef.current = resource;

  useEffect(() => {
    const spec = resourceRef.current;
    if (!spec || !fetchKey) {
      setEvents([]);
      setError(null);
      return;
    }

    const supabase = createClient();
    const { from, to } = rangeAround(date, 1, 4);
    setLoading(true);
    setError(null);

    const mapRow = (
      id: string,
      bookingDate: string,
      startTime: string,
      endTime: string,
      titleExtra?: string
    ): BusyEvent => ({
      id,
      title: busyEventTitle(titleExtra),
      start: new Date(`${bookingDate}T${startTime}`),
      end: new Date(`${bookingDate}T${endTime}`),
    });

    (async () => {
      try {
        if (spec.kind === "classroom") {
          const { data, error: qErr } = await supabase
            .from("calendar_requests")
            .select("id, event_date, start_time, end_time, title")
            .eq("classroom_id", spec.classroomId)
            .eq("status", "approved")
            .gte("event_date", from)
            .lte("event_date", to)
            .order("event_date", { ascending: true })
            .order("start_time", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? []).map((r) =>
              mapRow(r.id, r.event_date, r.start_time, r.end_time, r.title)
            )
          );
          return;
        }

        if (spec.kind === "sports") {
          const { data, error: qErr } = await supabase
            .from("sports_bookings")
            .select("id, booking_date, start_time, end_time")
            .eq("sport", spec.sport)
            .eq("venue_code", spec.venueCode)
            .eq("status", "approved")
            .gte("booking_date", from)
            .lte("booking_date", to)
            .order("booking_date", { ascending: true })
            .order("start_time", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? []).map((r) =>
              mapRow(r.id, r.booking_date, r.start_time, r.end_time)
            )
          );
          return;
        }

        if (spec.kind === "facility") {
          const { data, error: qErr } = await supabase
            .from("facility_bookings")
            .select("id, booking_date, start_time, end_time")
            .eq("facility_type", spec.facilityType)
            .eq("venue_code", spec.venueCode)
            .eq("status", "approved")
            .gte("booking_date", from)
            .lte("booking_date", to)
            .order("booking_date", { ascending: true })
            .order("start_time", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? []).map((r) =>
              mapRow(r.id, r.booking_date, r.start_time, r.end_time)
            )
          );
          return;
        }

        const { data, error: qErr } = await supabase
          .from("appointment_bookings")
          .select("id, booking_date, start_time, end_time")
          .eq("provider_code", spec.providerCode)
          .eq("status", "approved")
          .gte("booking_date", from)
          .lte("booking_date", to)
          .order("booking_date", { ascending: true })
          .order("start_time", { ascending: true });
        if (qErr) throw qErr;
        setEvents(
          (data ?? []).map((r) =>
            mapRow(r.id, r.booking_date, r.start_time, r.end_time)
          )
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchKey, date]);

  const title = useMemo(() => {
    if (!resource) return "";
    return (
      resource.label ??
      (resource.kind === "classroom"
        ? "This classroom"
        : resource.kind === "sports"
          ? "This venue"
          : resource.kind === "facility"
            ? "This facility"
            : "This provider")
    );
  }, [resource]);

  if (!resource) {
    return (
      <div
        className={`rounded-lg border border-dashed border-muted-foreground/25 bg-muted/15 px-3 py-3 text-sm text-muted-foreground ${className ?? ""}`}
      >
        Select a room, venue, or provider to see approved bookings across dates.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div>
        <p className="text-sm font-medium text-foreground">
          Availability for {title}
        </p>
        <p className="text-xs text-muted-foreground">
          Grey blocks are already approved. Empty gaps are free in the calendar
          (your request still needs admin approval).
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive">
          Could not load schedule: {error}
        </p>
      )}
      {loading ? (
        <div className="rounded-lg border bg-muted/10 p-2 space-y-2" aria-busy>
          <span className="sr-only">Loading schedule</span>
          <Skeleton className="h-7 w-full max-w-[280px] rounded-md" />
          <Skeleton
            className={compact ? "h-[220px] w-full rounded-md" : "h-[280px] w-full rounded-md"}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden p-1.5">
          <div className={compact ? "h-[260px]" : "h-[320px]"}>
            <BigCalendar
              localizer={localizer}
              events={events}
              view={view}
              date={date}
              onView={setView}
              onNavigate={setDate}
              views={VIEWS}
              formats={calendarFormats}
              step={60}
              timeslots={1}
              min={min}
              max={max}
              dayLayoutAlgorithm="no-overlap"
              startAccessor="start"
              endAccessor="end"
              selectable={false}
              components={{
                event: ({ event }: { event: RBCEvent }) => (
                  <span className="block truncate font-medium leading-tight">
                    {event.title}
                  </span>
                ),
              }}
              eventPropGetter={() => ({
                style: {
                  backgroundColor: BUSY_COLOR,
                  borderColor: BUSY_COLOR,
                  color: "white",
                  fontSize: "0.7rem",
                },
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
