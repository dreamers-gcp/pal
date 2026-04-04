"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type Event as RBCEvent,
} from "react-big-calendar";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./student-calendar.css";
import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentProviderCode,
  FacilityBookingType,
  GuestHouseCode,
  MessMealPeriod,
  SportType,
  SportsVenueCode,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  combineDateAndTimeLocal,
  facilityVenueCodesForFilter,
} from "@/lib/campus-use-cases";

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
  | { kind: "appointment"; providerCode: AppointmentProviderCode; label?: string }
  /** All approved leave in range (any student). */
  | { kind: "leave" }
  /** All approved mess extra-guest slots in range. */
  | { kind: "mess" }
  /** Approved guest-house stays for one room. */
  | {
      kind: "guest_house";
      guestHouse: GuestHouseCode;
      roomNumber: string;
      label?: string;
    };

type BusyEvent = RBCEvent & { id: string };

/** Approximate mess-hall windows for calendar blocks (approved mess requests). */
const MESS_SLOT: Record<
  MessMealPeriod,
  { start: string; end: string }
> = {
  breakfast: { start: "07:00:00", end: "09:00:00" },
  lunch: { start: "11:30:00", end: "13:30:00" },
  dinner: { start: "18:00:00", end: "20:30:00" },
};

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
  if (r.kind === "appointment") return `a:${r.providerCode}`;
  if (r.kind === "leave") return "leave";
  if (r.kind === "mess") return "mess";
  return `gh:${r.guestHouse}:${r.roomNumber}`;
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
  adminView = false,
}: {
  resource: ResourceAvailabilitySpec | null;
  className?: string;
  /** Tighter grid for drawers/sidebars. */
  compact?: boolean;
  /** Admin dashboard: neutral copy (no “your request” wording). */
  adminView?: boolean;
}) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<BusyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Full 24h day in the time grid (was 8:00–23:00, which hid early/late bookings). */
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
      start: combineDateAndTimeLocal(bookingDate, startTime),
      end: combineDateAndTimeLocal(bookingDate, endTime),
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
          const venueCodes = facilityVenueCodesForFilter(
            spec.facilityType,
            spec.venueCode
          );
          const { data, error: qErr } = await supabase
            .from("facility_bookings")
            .select("id, booking_date, start_time, end_time")
            .eq("facility_type", spec.facilityType)
            .in("venue_code", venueCodes)
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

        if (spec.kind === "appointment") {
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
          return;
        }

        if (spec.kind === "leave") {
          const { data, error: qErr } = await supabase
            .from("student_leave_requests")
            .select(
              "id, start_date, end_date, student:profiles!student_leave_requests_student_id_fkey(full_name)"
            )
            .eq("status", "approved")
            .gte("end_date", from)
            .lte("start_date", to)
            .order("start_date", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? []).map((r: any) => {
              const name = r.student?.full_name ?? "Student";
              const start = parseISO(`${r.start_date}T00:00:00`);
              const end = addDays(parseISO(`${r.end_date}T00:00:00`), 1);
              return {
                id: r.id,
                title: `Leave · ${name}`,
                start,
                end,
                allDay: true,
              } as BusyEvent;
            })
          );
          return;
        }

        if (spec.kind === "mess") {
          const { data, error: qErr } = await supabase
            .from("mess_extra_requests")
            .select(
              "id, meal_date, meal_period, extra_guest_count, student:profiles!mess_extra_requests_student_id_fkey(full_name)"
            )
            .eq("status", "approved")
            .gte("meal_date", from)
            .lte("meal_date", to)
            .order("meal_date", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? []).map((r: any) => {
              const slot = MESS_SLOT[r.meal_period as MessMealPeriod] ?? MESS_SLOT.lunch;
              const name = r.student?.full_name ?? "Student";
              const n = Number(r.extra_guest_count) || 0;
              return mapRow(
                r.id,
                r.meal_date,
                slot.start,
                slot.end,
                `Mess +${n} · ${name}`
              );
            })
          );
          return;
        }

        if (spec.kind === "guest_house") {
          const roomStr = String(spec.roomNumber).trim();
          const roomNum = Number(roomStr);
          const roomFilter =
            Number.isFinite(roomNum) && String(roomNum) === roomStr
              ? [roomStr, roomNum]
              : [roomStr];
          const { data, error: qErr } = await supabase
            .from("guest_house_bookings")
            .select("id, check_in_date, check_out_date, guest_name, room_number")
            .eq("guest_house", spec.guestHouse)
            .in("room_number", roomFilter)
            .eq("status", "approved")
            .gte("check_out_date", from)
            .lte("check_in_date", to)
            .order("check_in_date", { ascending: true });
          if (qErr) throw qErr;
          setEvents(
            (data ?? [])
              .filter(
                (r: { room_number?: string | number }) =>
                  String(r.room_number) === roomStr
              )
              .map((r: any) => {
                const start = parseISO(`${r.check_in_date}T00:00:00`);
                const end = addDays(parseISO(`${r.check_out_date}T00:00:00`), 1);
                return {
                  id: r.id,
                  title: r.guest_name ? `Guest · ${r.guest_name}` : "Booked",
                  start,
                  end,
                  allDay: true,
                } as BusyEvent;
              })
          );
          return;
        }

        setEvents([]);
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
    if ("label" in resource && resource.label) return resource.label;
    switch (resource.kind) {
      case "classroom":
        return "This classroom";
      case "sports":
        return "This venue";
      case "facility":
        return "This facility";
      case "appointment":
        return "This provider";
      case "leave":
        return "Approved student leave";
      case "mess":
        return "Mess (extra guests)";
      case "guest_house":
        return `Room ${resource.roomNumber}`;
      default:
        return "This resource";
    }
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
          {adminView
            ? "Shaded blocks are approved bookings. Empty time is free."
            : "Grey blocks are already approved. Empty gaps are free in the calendar (your request still needs admin approval)."}
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
              allDayAccessor={(e) => Boolean((e as BusyEvent & { allDay?: boolean }).allDay)}
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
