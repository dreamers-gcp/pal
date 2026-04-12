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

function parseLocalStart(dateStr: string, timeStr: string): Date | null {
  const dateOnly = String(dateStr).split("T")[0];
  const raw = String(timeStr ?? "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) || !m) return null;
  const [y, mo, day] = dateOnly.split("-").map(Number);
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return new Date(y!, mo! - 1, day!, h, mi, 0, 0);
}

export function isBookingStartBeforeNow(
  dateStr: string,
  timeStr: string,
  now = new Date()
): boolean {
  const dt = parseLocalStart(dateStr, timeStr);
  if (!dt || Number.isNaN(dt.getTime())) return true;
  return dt.getTime() < now.getTime();
}
