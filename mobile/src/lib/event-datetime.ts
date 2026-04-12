import type { CalendarRequest } from "../types";

/** Local calendar day for an event (no UTC shift from date-only strings). */
export function eventBaseLocalDate(e: CalendarRequest): Date | null {
  const dateOnly = String(e.event_date).split("T")[0];
  const [y, mo, d] = dateOnly.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d);
}

/**
 * Parse Postgres `time`, `HH:mm:ss`, or ISO datetime strings from Supabase.
 * Plain `split(":")` breaks on values like `1970-01-01T09:00:00`.
 */
export function parseCalendarTimeParts(
  timeStr: string | null | undefined
): { h: number; m: number; s: number } {
  const raw = String(timeStr ?? "").trim();
  if (!raw) return { h: 0, m: 0, s: 0 };

  /* Plain time / Postgres `time` (may include offset suffix without a `T` date). */
  if (!raw.includes("T")) {
    const leading = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (leading) {
      return {
        h: parseInt(leading[1]!, 10) || 0,
        m: parseInt(leading[2]!, 10) || 0,
        s: parseInt(leading[3] ?? "0", 10) || 0,
      };
    }
  }

  const isoMatch = raw.match(
    /T(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i
  );
  if (isoMatch) {
    return {
      h: parseInt(isoMatch[1]!, 10) || 0,
      m: parseInt(isoMatch[2]!, 10) || 0,
      s: parseInt(isoMatch[3] ?? "0", 10) || 0,
    };
  }

  const tailMatch = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (tailMatch) {
    return {
      h: parseInt(tailMatch[1]!, 10) || 0,
      m: parseInt(tailMatch[2]!, 10) || 0,
      s: parseInt(tailMatch[3] ?? "0", 10) || 0,
    };
  }

  return { h: 0, m: 0, s: 0 };
}

/** `HH:mm` for list/grid labels (24h). */
export function formatCalendarTimeHm(timeStr: string | null | undefined): string {
  const { h, m } = parseCalendarTimeParts(timeStr);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function withTimeOnDate(base: Date, timeStr: string, fallback: string): Date {
  const raw = timeStr?.trim() ? timeStr : fallback;
  const { h, m, s } = parseCalendarTimeParts(raw);
  const out = new Date(base.getTime());
  out.setHours(h, m, s, 0);
  return out;
}

export function eventStartDateTime(e: CalendarRequest): Date {
  const b = eventBaseLocalDate(e);
  if (!b) return new Date(0);
  return withTimeOnDate(b, e.start_time, "00:00:00");
}

export function eventEndDateTime(e: CalendarRequest): Date {
  const b = eventBaseLocalDate(e);
  if (!b) return new Date(0);
  return withTimeOnDate(b, e.end_time, "23:59:59");
}

export function isEventOngoing(now: Date | null, e: CalendarRequest): boolean {
  if (!now) return false;
  const s = eventStartDateTime(e);
  const end = eventEndDateTime(e);
  return now >= s && now < end;
}
