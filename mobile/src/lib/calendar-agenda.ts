import { endOfDay, format, startOfDay } from "date-fns";
import { eventStartDateTime, parseCalendarTimeParts } from "./event-datetime";
import type { CalendarRequest, FacilityBooking, StudentTask } from "../types";

export type AgendaRow =
  | { type: "class"; req: CalendarRequest }
  | { type: "facility"; b: FacilityBooking }
  | { type: "task"; t: StudentTask };

export interface AgendaDaySection {
  dateKey: string;
  dateLabel: string;
  rows: AgendaRow[];
}

export function dateKeyFromStr(dateStr: string): string {
  return String(dateStr).split("T")[0];
}

export function matchesVisibleMonth(dateStr: string, anchor: Date): boolean {
  const part = dateKeyFromStr(dateStr);
  const [y, m] = part.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m)) return false;
  return y === anchor.getFullYear() && m === anchor.getMonth() + 1;
}

function dayStartFromDateStr(dateStr: string): Date {
  const part = dateKeyFromStr(dateStr);
  const [y, mo, d] = part.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return new Date(0);
  return startOfDay(new Date(y, mo - 1, d));
}

export function dateInInclusiveRange(dateStr: string, intervalStart: Date, intervalEnd: Date): boolean {
  const day = dayStartFromDateStr(dateStr);
  return day >= startOfDay(intervalStart) && day <= endOfDay(intervalEnd);
}

export function facilityStartMs(b: FacilityBooking): number {
  const dateOnly = dateKeyFromStr(b.booking_date);
  const [y, mo, d] = dateOnly.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return 0;
  const { h, m } = parseCalendarTimeParts(
    String(b.start_time).trim() ? b.start_time : "00:00:00"
  );
  return new Date(y, mo - 1, d, h, m, 0).getTime();
}

function taskDueStartMs(t: StudentTask): number {
  const part = dateKeyFromStr(t.due_date);
  const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return 0;
  return new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
}

export function agendaRowSortMs(row: AgendaRow): number {
  switch (row.type) {
    case "class":
      return eventStartDateTime(row.req).getTime();
    case "facility":
      return facilityStartMs(row.b);
    case "task":
      return taskDueStartMs(row.t);
    default:
      return 0;
  }
}

function labelForDayKey(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return dateKey;
  return format(new Date(y, mo - 1, d), "EEEE, MMM d, yyyy");
}

/** Sparse days (only days with at least one row), sorted. */
export function buildAgendaSectionsForMonth(
  visibleMonth: Date,
  classReqs: CalendarRequest[],
  facilities: FacilityBooking[],
  tasks: StudentTask[]
): AgendaDaySection[] {
  const filteredClass = classReqs.filter((r) => matchesVisibleMonth(r.event_date, visibleMonth));
  const filteredFac = facilities.filter((b) => matchesVisibleMonth(b.booking_date, visibleMonth));
  const filteredTasks = tasks.filter((t) => matchesVisibleMonth(t.due_date, visibleMonth));

  const keys = new Set<string>();
  for (const r of filteredClass) keys.add(dateKeyFromStr(r.event_date));
  for (const b of filteredFac) keys.add(dateKeyFromStr(b.booking_date));
  for (const t of filteredTasks) keys.add(dateKeyFromStr(t.due_date));

  const sortedKeys = [...keys].sort();

  return sortedKeys.map((dateKey) => {
    const rows: AgendaRow[] = [];
    for (const r of filteredClass) {
      if (dateKeyFromStr(r.event_date) === dateKey) rows.push({ type: "class", req: r });
    }
    for (const b of filteredFac) {
      if (dateKeyFromStr(b.booking_date) === dateKey) rows.push({ type: "facility", b });
    }
    for (const t of filteredTasks) {
      if (dateKeyFromStr(t.due_date) === dateKey) rows.push({ type: "task", t });
    }
    rows.sort((a, b) => agendaRowSortMs(a) - agendaRowSortMs(b));
    return { dateKey, dateLabel: labelForDayKey(dateKey), rows };
  });
}

/** Same as month builder but for an arbitrary inclusive day range (e.g. Mon–Sun week). */
export function buildAgendaSectionsForInterval(
  intervalStart: Date,
  intervalEnd: Date,
  classReqs: CalendarRequest[],
  facilities: FacilityBooking[],
  tasks: StudentTask[]
): AgendaDaySection[] {
  const filteredClass = classReqs.filter((r) =>
    dateInInclusiveRange(r.event_date, intervalStart, intervalEnd)
  );
  const filteredFac = facilities.filter((b) =>
    dateInInclusiveRange(b.booking_date, intervalStart, intervalEnd)
  );
  const filteredTasks = tasks.filter((t) =>
    dateInInclusiveRange(t.due_date, intervalStart, intervalEnd)
  );

  const keys = new Set<string>();
  for (const r of filteredClass) keys.add(dateKeyFromStr(r.event_date));
  for (const b of filteredFac) keys.add(dateKeyFromStr(b.booking_date));
  for (const t of filteredTasks) keys.add(dateKeyFromStr(t.due_date));

  const sortedKeys = [...keys].sort();

  return sortedKeys.map((dateKey) => {
    const rows: AgendaRow[] = [];
    for (const r of filteredClass) {
      if (dateKeyFromStr(r.event_date) === dateKey) rows.push({ type: "class", req: r });
    }
    for (const b of filteredFac) {
      if (dateKeyFromStr(b.booking_date) === dateKey) rows.push({ type: "facility", b });
    }
    for (const t of filteredTasks) {
      if (dateKeyFromStr(t.due_date) === dateKey) rows.push({ type: "task", t });
    }
    rows.sort((a, b) => agendaRowSortMs(a) - agendaRowSortMs(b));
    return { dateKey, dateLabel: labelForDayKey(dateKey), rows };
  });
}

/** Which calendar days in `visibleMonth` have at least one class, facility, or task. */
export function collectAgendaDateKeysInMonth(
  visibleMonth: Date,
  classReqs: CalendarRequest[],
  facilities: FacilityBooking[],
  tasks: StudentTask[]
): Set<string> {
  const keys = new Set<string>();
  for (const r of classReqs) {
    if (matchesVisibleMonth(r.event_date, visibleMonth)) keys.add(dateKeyFromStr(r.event_date));
  }
  for (const b of facilities) {
    if (matchesVisibleMonth(b.booking_date, visibleMonth)) keys.add(dateKeyFromStr(b.booking_date));
  }
  for (const t of tasks) {
    if (matchesVisibleMonth(t.due_date, visibleMonth)) keys.add(dateKeyFromStr(t.due_date));
  }
  return keys;
}

export function collectAgendaDateKeysInInterval(
  intervalStart: Date,
  intervalEnd: Date,
  classReqs: CalendarRequest[],
  facilities: FacilityBooking[],
  tasks: StudentTask[]
): Set<string> {
  const keys = new Set<string>();
  for (const r of classReqs) {
    if (dateInInclusiveRange(r.event_date, intervalStart, intervalEnd)) {
      keys.add(dateKeyFromStr(r.event_date));
    }
  }
  for (const b of facilities) {
    if (dateInInclusiveRange(b.booking_date, intervalStart, intervalEnd)) {
      keys.add(dateKeyFromStr(b.booking_date));
    }
  }
  for (const t of tasks) {
    if (dateInInclusiveRange(t.due_date, intervalStart, intervalEnd)) {
      keys.add(dateKeyFromStr(t.due_date));
    }
  }
  return keys;
}
