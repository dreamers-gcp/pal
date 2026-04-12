import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCalendarRequests } from "./calendar-request-normalize";
import type { CalendarRequest, Profile } from "../types";

export async function resolveStudentGroupIds(
  supabase: SupabaseClient,
  profile: Profile
): Promise<{ groupIds: string[]; groupIdToName: Record<string, string> }> {
  const idNameMap: Record<string, string> = {};
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
        groupIds = groups.map((g) => g.id);
        for (const g of groups) idNameMap[g.id] = g.name;
      }
    }
  }

  if (groupIds.length === 0) {
    const { data: memberships } = await supabase
      .from("student_group_members")
      .select("group_id, student_group:student_groups(id, name)")
      .eq("student_id", profile.id);
    if (memberships && memberships.length > 0) {
      groupIds = memberships.map((m: { group_id: string }) => m.group_id);
      for (const m of memberships) {
        const raw = m.student_group as unknown;
        const sg = (Array.isArray(raw) ? raw[0] : raw) as
          | { id: string; name: string }
          | null
          | undefined;
        if (sg?.name) idNameMap[m.group_id] = sg.name;
      }
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
      idNameMap[groupData.id] = groupData.name;
    }
  }

  return { groupIds, groupIdToName: idNameMap };
}

export async function fetchApprovedEventsForStudent(
  supabase: SupabaseClient,
  groupIds: string[]
): Promise<CalendarRequest[]> {
  if (groupIds.length === 0) return [];

  const { data: directEvents } = await supabase
    .from("calendar_requests")
    .select(
      "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
    )
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

  let allEvents = normalizeCalendarRequests(directEvents ?? []);

  if (extraIds.length > 0) {
    const { data: extraEvents } = await supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
      )
      .eq("status", "approved")
      .in("id", extraIds)
      .order("event_date", { ascending: true });
    if (extraEvents) allEvents = [...allEvents, ...normalizeCalendarRequests(extraEvents)];
  }

  allEvents.sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
  return allEvents;
}

export async function fetchProfessorRequests(
  supabase: SupabaseClient,
  profile: Profile
): Promise<CalendarRequest[]> {
  const [byIdRes, byEmailRes] = await Promise.all([
    supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)"
      )
      .eq("professor_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)"
      )
      .eq("professor_email", profile.email)
      .is("professor_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const byId = normalizeCalendarRequests((byIdRes.data ?? []) as unknown[]);
  const byEmail = normalizeCalendarRequests((byEmailRes.data ?? []) as unknown[]);
  const seen = new Set(byId.map((r) => r.id));
  return [...byId, ...byEmail.filter((r) => !seen.has(r.id))];
}
