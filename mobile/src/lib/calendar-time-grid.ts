import { differenceInCalendarDays, startOfDay } from "date-fns";
import { dateKeyFromStr } from "./calendar-agenda";
import type { AgendaRow } from "./calendar-agenda";
import { eventEndDateTime, eventStartDateTime, parseCalendarTimeParts } from "./event-datetime";
import type { CalendarRequest, FacilityBooking, StudentTask } from "../types";

const MINUTES_PER_DAY = 24 * 60;

function facilityEndDateTime(b: FacilityBooking): Date {
  const dateOnly = dateKeyFromStr(b.booking_date);
  const [y, mo, d] = dateOnly.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return new Date(0);
  const { h, m, s } = parseCalendarTimeParts(
    String(b.end_time).trim() ? b.end_time : "23:59:59"
  );
  return new Date(y, mo - 1, d, h, m, s, 0);
}

function facilityStartDate(b: FacilityBooking): Date {
  const dateOnly = dateKeyFromStr(b.booking_date);
  const [y, mo, d] = dateOnly.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return new Date(0);
  const { h, m, s } = parseCalendarTimeParts(
    String(b.start_time).trim() ? b.start_time : "00:00:00"
  );
  return new Date(y, mo - 1, d, h, m, s, 0);
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export type TimedGridEvent = {
  row: AgendaRow;
  dayIndex: number;
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
};

export type AllDayGridItem = {
  row: AgendaRow;
  dayIndex: number;
};

function clampMinutes(m: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY, m));
}

export type TimedLaneItem = { dayIndex: number; startMin: number; endMin: number };

/** Shared by class/facility grid and admin availability overlays. */
export function assignTimedLanes<T extends TimedLaneItem>(
  items: T[]
): Array<T & { lane: number; laneCount: number }> {
  const byDay = new Map<number, T[]>();
  for (const it of items) {
    const list = byDay.get(it.dayIndex) ?? [];
    list.push(it);
    byDay.set(it.dayIndex, list);
  }
  const out: Array<T & { lane: number; laneCount: number }> = [];
  for (const [, dayItems] of byDay) {
    const sorted = [...dayItems].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const laneEnds: number[] = [];
    const dayOut: Array<T & { lane: number; laneCount: number }> = [];
    for (const ev of sorted) {
      let lane = -1;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i]! <= ev.startMin) {
          lane = i;
          laneEnds[i] = ev.endMin;
          break;
        }
      }
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(ev.endMin);
      }
      dayOut.push({ ...ev, lane, laneCount: 1 });
    }
    const laneCount = Math.max(1, laneEnds.length);
    for (const o of dayOut) {
      out.push({ ...o, laneCount });
    }
  }
  return out;
}

function assignLanesByDay(
  items: { row: AgendaRow; dayIndex: number; startMin: number; endMin: number }[]
): TimedGridEvent[] {
  return assignTimedLanes(items);
}

/** Build timed + all-day items for Mon-start week or single-day (dayCount=1). */
export function buildTimeGridModel(
  rangeStart: Date,
  dayCount: 7 | 1,
  bookings: CalendarRequest[],
  facility: FacilityBooking[],
  tasks: StudentTask[]
): { timed: TimedGridEvent[]; allDay: AllDayGridItem[] } {
  const weekStart = startOfDay(rangeStart);
  const timedRaw: {
    row: AgendaRow;
    dayIndex: number;
    startMin: number;
    endMin: number;
  }[] = [];
  const allDay: AllDayGridItem[] = [];

  const inRange = (d: Date) => {
    const idx = differenceInCalendarDays(startOfDay(d), weekStart);
    return idx >= 0 && idx < dayCount;
  };

  const dayIndexFor = (d: Date) => differenceInCalendarDays(startOfDay(d), weekStart);

  for (const r of bookings) {
    const s = eventStartDateTime(r);
    const e = eventEndDateTime(r);
    if (!inRange(s)) continue;
    const di = dayIndexFor(s);
    const sm = Math.round(clampMinutes(minutesSinceMidnight(s)));
    let em = Math.round(clampMinutes(minutesSinceMidnight(e)));
    if (em <= sm) em = Math.min(sm + 30, MINUTES_PER_DAY);
    timedRaw.push({
      row: { type: "class", req: r },
      dayIndex: di,
      startMin: sm,
      endMin: em,
    });
  }

  for (const b of facility) {
    if (b.status !== "approved") continue;
    const s = facilityStartDate(b);
    const e = facilityEndDateTime(b);
    if (!inRange(s)) continue;
    const di = dayIndexFor(s);
    const sm = Math.round(clampMinutes(minutesSinceMidnight(s)));
    let em = Math.round(clampMinutes(minutesSinceMidnight(e)));
    if (em <= sm) em = Math.min(sm + 30, MINUTES_PER_DAY);
    timedRaw.push({
      row: { type: "facility", b },
      dayIndex: di,
      startMin: sm,
      endMin: em,
    });
  }

  for (const t of tasks) {
    const part = dateKeyFromStr(t.due_date);
    const [y, mo, d] = part.split("-").map((x) => parseInt(x, 10));
    if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) continue;
    const day = new Date(y, mo - 1, d);
    if (!inRange(day)) continue;
    allDay.push({ row: { type: "task", t }, dayIndex: dayIndexFor(day) });
  }

  return { timed: assignLanesByDay(timedRaw), allDay };
}
