import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarRequest, Profile } from "../types";

/**
 * Approved calendar events for the student's group(s). Mirrors web student-dashboard fetch
 * (enrollments → groups, then student_group_members, then profiles.student_group legacy).
 */
export async function fetchStudentEventsForAttendance(
  supabase: SupabaseClient<any>,
  profile: Profile
): Promise<CalendarRequest[]> {
  let groupIds: string[] = [];

  const { data: enrollmentRows } = await supabase
    .from("student_enrollments")
    .select("program")
    .eq("email", profile.email);

  if (enrollmentRows && enrollmentRows.length > 0) {
    const programNames = [
      ...new Set(
        enrollmentRows
          .map((e: { program?: string | null }) => e.program)
          .filter((p): p is string => Boolean(p))
      ),
    ];
    if (programNames.length > 0) {
      const { data: groups } = await supabase
        .from("student_groups")
        .select("id, name")
        .in("name", programNames);
      if (groups && groups.length > 0) {
        groupIds = groups.map((g: { id: string }) => g.id);
      }
    }
  }

  if (groupIds.length === 0) {
    const { data: memberships } = await supabase
      .from("student_group_members")
      .select("group_id")
      .eq("student_id", profile.id);
    if (memberships && memberships.length > 0) {
      groupIds = memberships.map((m: { group_id: string }) => m.group_id);
    }
  }

  if (groupIds.length === 0 && profile.student_group) {
    const { data: groupData } = await supabase
      .from("student_groups")
      .select("id")
      .eq("name", profile.student_group)
      .single();
    if (groupData) groupIds = [(groupData as { id: string }).id];
  }

  if (groupIds.length === 0) return [];

  const selectQ =
    "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)";

  const { data: directEvents } = await supabase
    .from("calendar_requests")
    .select(selectQ)
    .eq("status", "approved")
    .in("student_group_id", groupIds)
    .order("event_date", { ascending: true });

  const { data: junctionLinks } = await supabase
    .from("calendar_request_groups")
    .select("calendar_request_id")
    .in("student_group_id", groupIds);

  const junctionIds = (junctionLinks ?? []).map((l: { calendar_request_id: string }) => l.calendar_request_id);
  const directIds = new Set((directEvents ?? []).map((e: { id: string }) => e.id));
  const extraIds = junctionIds.filter((id) => !directIds.has(id));

  let allEvents = (directEvents ?? []) as CalendarRequest[];

  if (extraIds.length > 0) {
    const { data: extraEvents } = await supabase
      .from("calendar_requests")
      .select(selectQ)
      .eq("status", "approved")
      .in("id", extraIds)
      .order("event_date", { ascending: true });
    if (extraEvents) allEvents = [...allEvents, ...(extraEvents as CalendarRequest[])];
  }

  allEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  return allEvents;
}
