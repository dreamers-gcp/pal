/**
 * Types for BLE mesh attendance (`ble_attendance_sessions` / `ble_attendance_verifications`).
 * Apply `supabase/ble-mesh-attendance.sql` on your project before using.
 *
 * Native BLE: add e.g. `npx expo install react-native-ble-plx`, then `expo prebuild` / EAS build.
 * Server enforces relay eligibility and per-student rate limits on insert.
 */

export type BleAttendanceSessionStatus = "active" | "ended";

export type BleAttendanceSession = {
  id: string;
  calendar_event_id: string;
  professor_id: string;
  status: BleAttendanceSessionStatus;
  started_at: string;
  ended_at: string | null;
  public_beacon_token: string;
};

export type BleAttendanceVerification = {
  id: string;
  session_id: string;
  student_id: string;
  verified_at: string;
  hop_count: number;
  verifier_student_id: string | null;
  device_relay_node_id: string | null;
};

/** Payload your app encodes into BLE manufacturer data (keep tiny; map token → session via Supabase). */
export type BleMeshBeaconPayloadV1 = {
  v: 1;
  t: string;
  h: number;
};
