import type { CalendarRequestKind, Classroom } from "../types";

export const CALENDAR_REQUEST_KINDS: Exclude<CalendarRequestKind, "class">[] = [
  "guest_speaker_session",
  "extra_class",
  "exam",
  "conclave",
  "conference",
  "student_event",
  "faculty_meeting",
];

export const CALENDAR_REQUEST_KIND_LABELS: Record<CalendarRequestKind, string> = {
  guest_speaker_session: "Guest Speaker Session",
  extra_class: "Extra Class",
  exam: "Exam",
  conclave: "Conclave",
  conference: "Conference",
  student_event: "Student Event",
  faculty_meeting: "Faculty Meeting",
  class: "Extra Class",
};

export const PROFESSOR_VENUE_NAMES = [
  "Class Room",
  "Exam Hall",
  "Seminar Hall",
  "Board Room",
  "Auditorium",
  "Computer Hall",
] as const;

export type ProfessorVenueName = (typeof PROFESSOR_VENUE_NAMES)[number];

export function professorVenueNamesForRequestKind(
  kind: CalendarRequestKind
): ProfessorVenueName[] {
  const k = kind === "class" ? "extra_class" : kind;
  switch (k) {
    case "extra_class":
    case "exam":
      return ["Class Room", "Seminar Hall", "Exam Hall", "Computer Hall"];
    case "conclave":
    case "conference":
      return ["Seminar Hall", "Auditorium"];
    case "student_event":
      return ["Class Room", "Seminar Hall", "Auditorium"];
    case "faculty_meeting":
      return ["Class Room", "Board Room"];
    case "guest_speaker_session":
      return ["Class Room", "Seminar Hall", "Auditorium"];
    default:
      return [...PROFESSOR_VENUE_NAMES];
  }
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveProfessorVenues(classrooms: Classroom[]): Map<ProfessorVenueName, Classroom> {
  const byNorm = new Map<string, Classroom>();
  for (const c of classrooms) {
    byNorm.set(normName(c.name), c);
  }
  const out = new Map<ProfessorVenueName, Classroom>();
  for (const label of PROFESSOR_VENUE_NAMES) {
    const row = byNorm.get(normName(label));
    if (row) out.set(label, row);
  }
  return out;
}

export function groupsForProfessorBookingForm<T extends { name: string }>(all: T[]): T[] {
  return [...all].sort((a, b) => a.name.localeCompare(b.name));
}
