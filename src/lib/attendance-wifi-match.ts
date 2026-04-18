import type { Classroom } from "@/lib/types";

/** Hex digits only, for BSSID comparison. */
export function normalizeBssidForCompare(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase().replace(/-/g, ":");
  const hex = s.replace(/[^a-f0-9]/g, "");
  return hex.length > 0 ? hex : null;
}

/** Whether this classroom expects any Wi‑Fi check for attendance. */
export function classroomExpectsWifi(classroom: Pick<Classroom, "attendance_wifi_ssid" | "attendance_wifi_bssid"> | null | undefined): boolean {
  if (!classroom) return false;
  const s = classroom.attendance_wifi_ssid?.trim() ?? "";
  const b = classroom.attendance_wifi_bssid?.trim() ?? "";
  return s.length > 0 || b.length > 0;
}

export type WifiMatchResult = { ok: true } | { ok: false; message: string };

/**
 * Client-side mirror of DB trigger (better UX). SSID: case-insensitive trim.
 * BSSID: MAC normalized to hex digits.
 */
export function matchStudentWifiToClassroom(
  classroom: Pick<Classroom, "attendance_wifi_ssid" | "attendance_wifi_bssid"> | null | undefined,
  studentSsid: string | null | undefined,
  studentBssid: string | null | undefined
): WifiMatchResult {
  if (!classroomExpectsWifi(classroom)) return { ok: true };

  const reqSsid = classroom!.attendance_wifi_ssid?.trim() ?? "";
  const reqBssid = classroom!.attendance_wifi_bssid?.trim() ?? "";

  const stSsid = studentSsid?.trim() ?? "";
  const stBssid = studentBssid?.trim() ?? "";

  if (reqSsid.length > 0) {
    if (!stSsid || stSsid.toLowerCase() !== reqSsid.toLowerCase()) {
      return {
        ok: false,
        message:
          "Your phone is not on the class Wi‑Fi (SSID mismatch). Connect to the room network and try again.",
      };
    }
  }

  if (reqBssid.length > 0) {
    const a = normalizeBssidForCompare(stBssid);
    const b = normalizeBssidForCompare(reqBssid);
    if (!a || a !== b) {
      return {
        ok: false,
        message:
          "Your phone is not connected to the expected access point (BSSID mismatch). Connect to the class Wi‑Fi and try again.",
      };
    }
  }

  return { ok: true };
}

export const WEB_ATTENDANCE_WIFI_BLOCKED =
  "This class requires Wi‑Fi verification. Mark attendance from The Nucleus mobile app on the room network.";
