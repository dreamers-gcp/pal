/**
 * Canonical teaching slots (90 minutes each, breaks between).
 * Used by LLM timetable generation and UI grid.
 */
export const TIMETABLE_SLOTS = {
  S1: { start: "08:30", end: "10:00", label: "08:30 – 10:00" },
  S2: { start: "10:30", end: "12:00", label: "10:30 – 12:00" },
  S3: { start: "12:15", end: "13:45", label: "12:15 – 13:45" },
  S4: { start: "14:45", end: "16:15", label: "14:45 – 16:15" },
  S5: { start: "16:30", end: "18:00", label: "16:30 – 18:00" },
  S6: { start: "18:30", end: "20:00", label: "18:30 – 20:00" },
  S7: { start: "20:15", end: "21:45", label: "20:15 – 21:45" },
} as const;

export type TimetableSlotCode = keyof typeof TIMETABLE_SLOTS;

export const TIMETABLE_SLOT_CODES = Object.keys(TIMETABLE_SLOTS) as TimetableSlotCode[];

/** Normalize "08:30:00" or "8:30" → "08:30" */
export function normalizeTimeShort(t: string | null | undefined): string {
  if (!t) return "";
  const parts = t.trim().split(":");
  const h = String(Number(parts[0])).padStart(2, "0");
  const m = String(Number(parts[1] ?? 0)).padStart(2, "0");
  return `${h}:${m}`;
}

/** Map DB time to slot code, if it matches a canonical slot start. */
export function inferSlotCodeFromStartTime(startTime: string): TimetableSlotCode | null {
  const n = normalizeTimeShort(startTime);
  for (const code of TIMETABLE_SLOT_CODES) {
    if (TIMETABLE_SLOTS[code].start === n) return code;
  }
  return null;
}

/** For Supabase `time` columns */
export function toDbTime(hhmm: string): string {
  const n = normalizeTimeShort(hhmm);
  return n.length === 5 ? `${n}:00` : n;
}
