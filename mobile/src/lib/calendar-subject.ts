/** Same as web `encodeCalendarRequestSubjects`. */
export function encodeCalendarRequestSubjects(subjects: string[]): string | null {
  const cleaned = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  cleaned.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return JSON.stringify(cleaned);
}

/** Same as web `decodeCalendarRequestSubjects`. */
export function decodeCalendarRequestSubjects(raw: string | null | undefined): string[] {
  if (raw == null || raw === "") return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      /* legacy */
    }
  }
  return [t];
}

/** When `calendar_requests.subject` is empty, attendance filters use this bucket label. */
export const ATTENDANCE_SUBJECT_UNLISTED = "Unlisted";

type SubjectCarrier = { subject?: string | null };

export function attendanceSubjectLabelsForEvent(event: SubjectCarrier): string[] {
  const decoded = decodeCalendarRequestSubjects(event.subject);
  if (decoded.length > 0) return decoded;
  return [ATTENDANCE_SUBJECT_UNLISTED];
}

export function uniqueAttendanceSubjectLabels(events: SubjectCarrier[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    for (const s of attendanceSubjectLabelsForEvent(e)) set.add(s);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export function eventMatchesAttendanceSubjectFilter(
  event: SubjectCarrier,
  subjectFilter: string
): boolean {
  if (subjectFilter === "all") return true;
  return attendanceSubjectLabelsForEvent(event).includes(subjectFilter);
}
