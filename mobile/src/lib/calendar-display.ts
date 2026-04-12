import type { CalendarRequest, Classroom } from "../types";
import { toTitleCase } from "./format-text";

/** Prefer joined `classroom`, else resolve from the loaded classroom list (RLS can omit embed). */
export function classroomDisplayName(r: CalendarRequest, classrooms: Classroom[]): string {
  const joined = r.classroom?.name?.trim();
  if (joined) return joined;
  const id = r.classroom_id;
  if (id) {
    const c = classrooms.find((x) => x.id === id);
    if (c?.name?.trim()) return c.name.trim();
  }
  return "—";
}

/** Title-case a person name; show email as-is when there is no name. */
export function professorCalendarLine(r: CalendarRequest): string {
  const name = r.professor?.full_name?.trim();
  if (name) return toTitleCase(name);
  const email = r.professor_email?.trim();
  return email || "—";
}
