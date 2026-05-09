import { addMinutes, isWithinInterval } from "date-fns";

/** If end time is missing or not after start, assume this duration from start. */
const FALLBACK_CLASS_DURATION_MINUTES = 90;

/**
 * Parse `event_date` (yyyy-MM-dd) + `timeStr` (HH:mm or HH:mm:ss) in the user's local timezone.
 */
export function parseLocalEventDateTime(
  eventDate: string,
  timeStr: string
): Date | null {
  const part = String(eventDate).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  const [y, mo, d] = part.split("-").map(Number);
  const raw = String(timeStr ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hh = Math.min(23, Math.max(0, parseInt(match[1]!, 10)));
  const mm = Math.min(59, Math.max(0, parseInt(match[2]!, 10)));
  const ss =
    match[3] !== undefined ? Math.min(59, Math.max(0, parseInt(match[3]!, 10))) : 0;
  return new Date(y!, mo! - 1, d!, hh, mm, ss);
}

export function getClassScheduledInterval(event: {
  event_date: string;
  start_time: string;
  end_time: string;
}): { start: Date; end: Date } {
  const start = parseLocalEventDateTime(event.event_date, event.start_time);
  const endRaw = parseLocalEventDateTime(event.event_date, event.end_time);
  const now = new Date();
  if (!start || Number.isNaN(start.getTime())) {
    return { start: now, end: now };
  }
  let end = endRaw;
  if (!end || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end = addMinutes(start, FALLBACK_CLASS_DURATION_MINUTES);
  }
  return { start, end };
}

/** True when `now` is between scheduled class start and end (inclusive of boundaries). */
export function isWithinClassAttendanceWindow(
  event: { event_date: string; start_time: string; end_time: string },
  now = new Date()
): boolean {
  const { start, end } = getClassScheduledInterval(event);
  return isWithinInterval(now, { start, end });
}
