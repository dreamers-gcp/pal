import type { AttendanceRecord, CalendarRequest, Profile } from "./types";
import { getSupabase } from "./supabase";

/**
 * Mirrors `StudentDashboard` group resolution + approved events (direct + junction).
 */
export async function fetchStudentEventsForProfile(
  profile: Profile
): Promise<CalendarRequest[]> {
  const supabase = getSupabase();
  let groupIds: string[] = [];

  const { data: enrollmentSubjects } = await supabase
    .from("student_enrollments")
    .select("subject")
    .eq("email", profile.email);

  if (enrollmentSubjects && enrollmentSubjects.length > 0) {
    const subjectNames = [...new Set(enrollmentSubjects.map((e) => e.subject))];
    const { data: groups } = await supabase
      .from("student_groups")
      .select("id, name")
      .in("name", subjectNames);

    if (groups && groups.length > 0) {
      groupIds = groups.map((g) => g.id);
    }
  }

  if (groupIds.length === 0) {
    const { data: memberships } = await supabase
      .from("student_group_members")
      .select("group_id, student_group:student_groups(id, name)")
      .eq("student_id", profile.id);

    if (memberships && memberships.length > 0) {
      groupIds = memberships.map((m) => m.group_id);
    }
  }

  if (groupIds.length === 0 && profile.student_group) {
    const { data: groupData } = await supabase
      .from("student_groups")
      .select("id, name")
      .eq("name", profile.student_group)
      .single();
    if (groupData) {
      groupIds = [groupData.id];
    }
  }

  if (groupIds.length === 0) {
    return [];
  }

  const select =
    "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)";

  const { data: directEvents } = await supabase
    .from("calendar_requests")
    .select(select)
    .eq("status", "approved")
    .in("student_group_id", groupIds)
    .order("event_date", { ascending: true });

  const { data: junctionLinks } = await supabase
    .from("calendar_request_groups")
    .select("calendar_request_id")
    .in("student_group_id", groupIds);

  const junctionIds = (junctionLinks ?? []).map((l) => l.calendar_request_id);
  const directIds = new Set((directEvents ?? []).map((e) => e.id));
  const extraIds = junctionIds.filter((id) => !directIds.has(id));

  let allEvents = (directEvents ?? []) as CalendarRequest[];

  if (extraIds.length > 0) {
    const { data: extraEvents } = await supabase
      .from("calendar_requests")
      .select(select)
      .eq("status", "approved")
      .in("id", extraIds)
      .order("event_date", { ascending: true });

    if (extraEvents) {
      allEvents = [...allEvents, ...(extraEvents as CalendarRequest[])];
    }
  }

  allEvents.sort(
    (a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
  return allEvents;
}

export async function fetchAttendanceMap(
  studentId: string
): Promise<Record<string, AttendanceRecord>> {
  const { data } = await getSupabase()
    .from("attendance_records")
    .select("*")
    .eq("student_id", studentId);

  const map: Record<string, AttendanceRecord> = {};
  for (const r of data ?? []) {
    map[r.event_id] = r as AttendanceRecord;
  }
  return map;
}
