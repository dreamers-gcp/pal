/**
 * `calendar_requests.subject` stores optional subjects as JSON array text, e.g. `["A","B"]`.
 * Legacy rows may be a single plain string (treated as one subject).
 */
export function encodeCalendarRequestSubjects(subjects: string[]): string | null {
  const cleaned = [
    ...new Set(subjects.map((s) => s.trim()).filter(Boolean)),
  ];
  if (cleaned.length === 0) return null;
  cleaned.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return JSON.stringify(cleaned);
}

export function decodeCalendarRequestSubjects(
  raw: string | null | undefined
): string[] {
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
      /* single legacy string */
    }
  }
  return [t];
}
