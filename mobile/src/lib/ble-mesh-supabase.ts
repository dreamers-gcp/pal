import type { SupabaseClient } from "@supabase/supabase-js";
import type { BleAttendanceSession } from "./ble-mesh-types";
import type { CalendarRequest } from "../types";

export type BleSessionWithEvent = BleAttendanceSession & {
  calendar_requests: CalendarRequest | null;
};

export async function fetchProfessorActiveBleSessions(
  supabase: SupabaseClient,
  professorId: string
): Promise<BleSessionWithEvent[]> {
  const { data, error } = await supabase
    .from("ble_attendance_sessions")
    .select(
      "*, calendar_requests(*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*))"
    )
    .eq("professor_id", professorId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BleSessionWithEvent[];
}

export async function createBleAttendanceSession(
  supabase: SupabaseClient,
  professorId: string,
  calendarEventId: string
): Promise<BleAttendanceSession> {
  const { data, error } = await supabase
    .from("ble_attendance_sessions")
    .insert({
      professor_id: professorId,
      calendar_event_id: calendarEventId,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as BleAttendanceSession;
}

export async function endBleAttendanceSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("ble_attendance_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function fetchBleSessionByBeaconToken(
  supabase: SupabaseClient,
  tokenHex: string
): Promise<BleSessionWithEvent | null> {
  const normalized = tokenHex.trim().toLowerCase();
  const { data, error } = await supabase
    .from("ble_attendance_sessions")
    .select(
      "*, calendar_requests(*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*))"
    )
    .eq("public_beacon_token", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return (data as BleSessionWithEvent) ?? null;
}

export async function insertBleVerification(
  supabase: SupabaseClient,
  args: {
    sessionId: string;
    studentId: string;
    hopCount: number;
    verifierStudentId: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("ble_attendance_verifications").insert({
    session_id: args.sessionId,
    student_id: args.studentId,
    hop_count: args.hopCount,
    verifier_student_id: args.verifierStudentId,
  });
  if (error) throw error;
}

export async function fetchExistingBleVerification(
  supabase: SupabaseClient,
  sessionId: string,
  studentId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("ble_attendance_verifications")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string } | null;
}

/** Today's approved classes for this professor (for starting a session). */
export function filterProfessorApprovedToday(
  requests: CalendarRequest[],
  todayYmd: string
): CalendarRequest[] {
  return requests.filter(
    (r) => r.status === "approved" && r.event_date === todayYmd
  );
}
