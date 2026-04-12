import { combineDateAndTimeLocal } from "@/lib/campus-use-cases";

export const BOOKING_NOT_IN_PAST_MSG =
  "Date and time must be now or in the future.";

export const BOOKING_DATE_NOT_IN_PAST_MSG =
  "Date must be today or a future day.";

/** `yyyy-MM-dd` strictly before local today. */
export function isDateOnlyBeforeToday(dateStr: string, now = new Date()): boolean {
  const part = String(dateStr).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return true;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  return part < today;
}

/**
 * True if local start instant (date + time) is strictly before `now`.
 * Invalid date/time strings are treated as "before now" (reject).
 */
export function isBookingStartBeforeNow(
  dateStr: string,
  timeStr: string,
  now = new Date()
): boolean {
  const dateOnly = String(dateStr).split("T")[0];
  const d = combineDateAndTimeLocal(dateOnly, timeStr);
  return Number.isNaN(d.getTime()) || d.getTime() < now.getTime();
}
