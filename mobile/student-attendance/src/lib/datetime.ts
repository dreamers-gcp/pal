import { addMinutes, isWithinInterval, parse } from "date-fns";
import type { CalendarRequest } from "./types";

export const ATTENDANCE_WINDOW_MINUTES = 15;

export function isEventToday(dateStr: string): boolean {
  const now = new Date();
  const [y, m, d] = String(dateStr).split("T")[0].split("-").map(Number);
  return (
    now.getFullYear() === y &&
    now.getMonth() + 1 === m &&
    now.getDate() === d
  );
}

export function isWithinAttendanceWindow(event: CalendarRequest): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t = String(event.start_time).trim();
  const startTime = parse(
    t.length === 5 ? `${t}:00` : t,
    "HH:mm:ss",
    today
  );
  const windowEnd = addMinutes(startTime, ATTENDANCE_WINDOW_MINUTES);
  return isWithinInterval(now, { start: startTime, end: windowEnd });
}
