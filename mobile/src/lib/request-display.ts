import type { CalendarRequestKind, RequestStatus } from "../types";

export function requestStatusLabel(s: RequestStatus): string {
  if (s === "clarification_needed") return "Clarification";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const KIND_LABELS: Partial<Record<CalendarRequestKind, string>> = {
  guest_speaker_session: "Guest speaker",
  extra_class: "Extra class",
  exam: "Exam",
  conclave: "Conclave",
  conference: "Conference",
  student_event: "Student event",
  faculty_meeting: "Faculty meeting",
  class: "Class",
};

export function requestKindLabel(kind: CalendarRequestKind | string | null | undefined): string {
  if (!kind) return "Request";
  return KIND_LABELS[kind as CalendarRequestKind] ?? String(kind).replace(/_/g, " ");
}
