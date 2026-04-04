import type {
  AppointmentProviderCode,
  FacilityBookingType,
  MessMealPeriod,
} from "@/lib/types";

/**
 * DB `time` values may be `HH:mm:ss`, `HH:mm`, or include fractional seconds.
 * Combine with a `yyyy-MM-dd` date for a local `Date` (react-big-calendar).
 */
export function combineDateAndTimeLocal(dateStr: string, timeStr: string): Date {
  const raw = String(timeStr ?? "").trim();
  const noTz = raw.split(/[Z+-]/)[0] ?? raw;
  const m = noTz.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date(NaN);
  const h = String(Math.min(23, Math.max(0, parseInt(m[1], 10) || 0))).padStart(2, "0");
  const mi = String(Math.min(59, Math.max(0, parseInt(m[2], 10) || 0))).padStart(2, "0");
  const s = String(Math.min(59, Math.max(0, parseInt(m[3] ?? "0", 10) || 0))).padStart(2, "0");
  return new Date(`${dateStr}T${h}:${mi}:${s}`);
}

/**
 * Approved rows may use legacy `venue_code` values (`main`, `conf_a`, …).
 * Expand the selected bookable code so queries match those rows.
 */
export function facilityVenueCodesForFilter(
  facilityType: FacilityBookingType,
  selectedCode: string
): string[] {
  const codes = new Set<string>([selectedCode]);
  if (selectedCode === "auditorium1" && facilityType === "auditorium") {
    codes.add("main");
  }
  if (selectedCode === "computerhall1" && facilityType === "computer_hall") {
    codes.add("main");
  }
  if (selectedCode === "boardroom1" && facilityType === "board_room") {
    codes.add("main");
  }
  if (selectedCode === "conferencehall1" && facilityType === "conference_room") {
    codes.add("conf_a");
  }
  if (selectedCode === "conferencehall2" && facilityType === "conference_room") {
    codes.add("conf_b");
  }
  return [...codes];
}

/** Display labels for facility categories (UI). */
export const FACILITY_TYPE_LABELS: Record<FacilityBookingType, string> = {
  auditorium: "Auditorium",
  computer_hall: "Computer Hall",
  board_room: "Board Room",
  conference_room: "Conference Room",
};

/**
 * Stable venue codes stored in DB (no underscores).
 * Each facility type has 3 bookable rooms/halls.
 */
export function venuesForFacilityType(
  t: FacilityBookingType
): { code: string; label: string }[] {
  switch (t) {
    case "auditorium":
      return [
        { code: "auditorium1", label: "Auditorium 1" },
        { code: "auditorium2", label: "Auditorium 2" },
        { code: "auditorium3", label: "Auditorium 3" },
      ];
    case "computer_hall":
      return [
        { code: "computerhall1", label: "Computer Hall 1" },
        { code: "computerhall2", label: "Computer Hall 2" },
        { code: "computerhall3", label: "Computer Hall 3" },
      ];
    case "board_room":
      return [
        { code: "boardroom1", label: "Board Room 1" },
        { code: "boardroom2", label: "Board Room 2" },
        { code: "boardroom3", label: "Board Room 3" },
      ];
    case "conference_room":
      return [
        { code: "conferencehall1", label: "Conference Hall 1" },
        { code: "conferencehall2", label: "Conference Hall 2" },
        { code: "conferencehall3", label: "Conference Hall 3" },
      ];
    default:
      return [];
  }
}

/** Human-readable hall name for a stored venue_code (handles legacy rows). */
export function facilityVenueLabel(
  facilityType: FacilityBookingType,
  venueCode: string
): string {
  const list = venuesForFacilityType(facilityType);
  const match = list.find((v) => v.code === venueCode);
  if (match) return match.label;

  if (venueCode === "main") {
    if (facilityType === "auditorium") return "Auditorium 1";
    if (facilityType === "computer_hall") return "Computer Hall 1";
    if (facilityType === "board_room") return "Board Room 1";
    return "Main";
  }
  if (venueCode === "conf_a") return "Conference Hall 1";
  if (venueCode === "conf_b") return "Conference Hall 2";

  return venueCode;
}

export const MEAL_PERIOD_LABELS: Record<MessMealPeriod, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const APPOINTMENT_PROVIDER_LABELS: Record<AppointmentProviderCode, string> = {
  counsellor_1: "Counsellor",
  doctor_1: "Doctor 1",
  doctor_2: "Doctor 2",
};

export function providersForService(
  service: "counsellor" | "doctor"
): AppointmentProviderCode[] {
  if (service === "counsellor") return ["counsellor_1"];
  return ["doctor_1", "doctor_2"];
}

/** Next calendar day (local) as yyyy-MM-dd */
export function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeTimeForDb(t: string): string {
  const s = t.trim();
  if (s.length === 5) return `${s}:00`;
  return s;
}

export function timeSlice(t: string): string {
  return t.slice(0, 5);
}
