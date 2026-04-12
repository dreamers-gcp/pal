import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCalendarRequests } from "./calendar-request-normalize";
import type { CalendarRequest, Classroom, FacilityBooking, StudentTask } from "../types";

export async function fetchCampusApprovedCalendarRequests(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<CalendarRequest[]> {
  const { data, error } = await supabase
    .from("calendar_requests")
    .select(
      "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
    )
    .eq("status", "approved")
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return normalizeCalendarRequests(data ?? []);
}

export async function fetchApprovedFacilityBookings(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<FacilityBooking[]> {
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
    .eq("status", "approved")
    .gte("booking_date", from)
    .lte("booking_date", to)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return normalizeFacilityBookings((data as FacilityBooking[]) ?? []);
}

function normalizeFacilityBookings(list: FacilityBooking[]): FacilityBooking[] {
  return list.map((b) => ({
    ...b,
    requester: Array.isArray(b.requester) ? b.requester[0] : b.requester,
  }));
}

export async function fetchClassroomsOrdered(supabase: SupabaseClient): Promise<Classroom[]> {
  const { data } = await supabase.from("classrooms").select("*").order("name");
  return (data as Classroom[]) ?? [];
}

export async function fetchStudentTasksForCalendar(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentTask[]> {
  const { data } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("student_id", studentId)
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as StudentTask[];
}
