import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { facilityVenueCodesForFilter } from "./facility-labels";
import type {
  AppointmentProviderCode,
  FacilityBookingType,
  SportType,
  SportsVenueCode,
} from "../types";

const MINUTES_PER_DAY = 24 * 60;

export type AvailabilityTimedSlot = {
  id: string;
  title: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};

export type AvailabilityAllDaySlot = {
  id: string;
  title: string;
  dayIndex: number;
};

export type AdminResourceAvailabilitySpec =
  | { kind: "classroom"; classroomId: string }
  | { kind: "sports"; sport: SportType; venueCode: SportsVenueCode }
  | { kind: "facility"; facilityType: FacilityBookingType; venueCode: string }
  | { kind: "appointment"; providerCode: AppointmentProviderCode };

export type AdminAvailabilityFetchResult = {
  kind: "grid";
  timed: AvailabilityTimedSlot[];
  allDay: AvailabilityAllDaySlot[];
};

function rangeAroundIso(date: Date, monthsBack: number, monthsForward: number): { from: string; to: string } {
  const from = format(startOfMonth(subMonths(date, monthsBack)), "yyyy-MM-dd");
  const to = format(endOfMonth(addMonths(date, monthsForward)), "yyyy-MM-dd");
  return { from, to };
}

function combineDateTimeLocal(dateStr: string, timeStr: string): Date {
  const part = String(dateStr).split("T")[0]!;
  const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10));
  const t = String(timeStr).trim() || "00:00:00";
  const parts = t.split(":");
  const hh = parseInt(parts[0] ?? "0", 10);
  const mm = parseInt(parts[1] ?? "0", 10);
  const ss = parseInt(parts[2] ?? "0", 10);
  return new Date(y, mo - 1, d, hh, mm, ss, 0);
}

function clampMinutes(m: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, m));
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function timedSlotsInWeek(
  start: Date,
  end: Date,
  weekStart: Date,
  id: string,
  title: string
): AvailabilityTimedSlot[] {
  const ws = startOfDay(weekStart);
  const out: AvailabilityTimedSlot[] = [];
  if (end <= start) return out;
  let dayStart = startOfDay(start);
  while (dayStart < end) {
    const di = differenceInCalendarDays(dayStart, ws);
    if (di >= 0 && di < 7) {
      const nextMid = addDays(dayStart, 1);
      const segStart = maxDate([start, dayStart]);
      const segEnd = minDate([end, nextMid]);
      const sm = clampMinutes(minutesSinceMidnight(segStart));
      let em = clampMinutes(minutesSinceMidnight(segEnd));
      if (em <= sm) em = Math.min(sm + 30, MINUTES_PER_DAY);
      if (em > sm) {
        out.push({
          id: `${id}:${format(dayStart, "yyyy-MM-dd")}:${sm}`,
          title,
          dayIndex: di,
          startMin: sm,
          endMin: em,
        });
      }
    }
    dayStart = addDays(dayStart, 1);
  }
  return out;
}

/** Approved busy slots for one resource, clipped to the Monday-start week of `weekStart`. */
export async function fetchAdminResourceAvailability(
  supabase: SupabaseClient<any>,
  spec: AdminResourceAvailabilitySpec,
  weekStart: Date
): Promise<AdminAvailabilityFetchResult> {
  const anchor = weekStart;
  const { from, to } = rangeAroundIso(anchor, 1, 4);
  const ws = startOfDay(weekStart);

  const mapTimed = (
    id: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    title: string
  ): AvailabilityTimedSlot[] => {
    const s = combineDateTimeLocal(bookingDate, startTime);
    let e = combineDateTimeLocal(bookingDate, endTime);
    if (e <= s) {
      e = new Date(s.getTime() + 30 * 60 * 1000);
    }
    return timedSlotsInWeek(s, e, ws, id, title);
  };

  if (spec.kind === "classroom") {
    const { data, error } = await supabase
      .from("calendar_requests")
      .select("id, event_date, start_time, end_time, title")
      .eq("classroom_id", spec.classroomId)
      .eq("status", "approved")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const timed: AvailabilityTimedSlot[] = [];
    for (const r of data ?? []) {
      const title = r.title ? `Booked · ${r.title}` : "Booked";
      timed.push(...mapTimed(r.id, r.event_date, r.start_time, r.end_time, title));
    }
    return { kind: "grid", timed, allDay: [] };
  }

  if (spec.kind === "sports") {
    const { data, error } = await supabase
      .from("sports_bookings")
      .select("id, booking_date, start_time, end_time")
      .eq("sport", spec.sport)
      .eq("venue_code", spec.venueCode)
      .eq("status", "approved")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const timed: AvailabilityTimedSlot[] = [];
    for (const r of data ?? []) {
      timed.push(...mapTimed(r.id, r.booking_date, r.start_time, r.end_time, "Booked"));
    }
    return { kind: "grid", timed, allDay: [] };
  }

  if (spec.kind === "facility") {
    const venueCodes = facilityVenueCodesForFilter(spec.facilityType, spec.venueCode);
    const { data, error } = await supabase
      .from("facility_bookings")
      .select("id, booking_date, start_time, end_time")
      .eq("facility_type", spec.facilityType)
      .in("venue_code", venueCodes)
      .eq("status", "approved")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const timed: AvailabilityTimedSlot[] = [];
    for (const r of data ?? []) {
      timed.push(...mapTimed(r.id, r.booking_date, r.start_time, r.end_time, "Booked"));
    }
    return { kind: "grid", timed, allDay: [] };
  }

  if (spec.kind === "appointment") {
    const { data, error } = await supabase
      .from("appointment_bookings")
      .select("id, booking_date, start_time, end_time")
      .eq("provider_code", spec.providerCode)
      .eq("status", "approved")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const timed: AvailabilityTimedSlot[] = [];
    for (const r of data ?? []) {
      timed.push(...mapTimed(r.id, r.booking_date, r.start_time, r.end_time, "Booked"));
    }
    return { kind: "grid", timed, allDay: [] };
  }

  return { kind: "grid", timed: [], allDay: [] };
}
