import type { CalendarRequest, Classroom, Profile, StudentGroup } from "../types";

/** PostgREST sometimes returns a many-to-one embed as a one-element array. */
function unwrapRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.length > 0 ? (value[0] as T) : undefined;
  return value as T;
}

/**
 * Normalize `calendar_requests` rows from Supabase so nested joins match `CalendarRequest`
 * (unwrap single-element arrays; flatten `calendar_request_groups`).
 */
export function normalizeCalendarRequests(data: unknown[]): CalendarRequest[] {
  return (data ?? []).map((row) => {
    const req = row as Record<string, unknown> & {
      professor?: Profile | Profile[];
      student_group?: StudentGroup | StudentGroup[];
      classroom?: Classroom | Classroom[];
      student_groups?: { student_group?: StudentGroup | StudentGroup[] }[];
    };

    const professor = unwrapRelation(req.professor);
    const student_group = unwrapRelation(req.student_group);
    const classroom = unwrapRelation(req.classroom);

    const student_groups =
      req.student_groups
        ?.map((sg) => unwrapRelation(sg.student_group))
        .filter((g): g is StudentGroup => Boolean(g)) ?? [];

    return {
      ...req,
      professor,
      student_group,
      classroom,
      student_groups,
    } as CalendarRequest;
  });
}
