import type { SportType, SportsVenueCode } from "@/lib/types";

/** Display order matches campus inventory. */
export const SPORT_LABELS: Record<SportType, string> = {
  cricket: "Cricket",
  badminton: "Badminton",
  basketball: "Basketball",
  football: "Football",
  table_tennis: "Table tennis",
  lawn_tennis: "Lawn tennis",
  snooker: "Snooker",
};

/** Order for dropdowns and admin lists. */
export const SPORT_TYPES_ORDER: SportType[] = [
  "cricket",
  "badminton",
  "basketball",
  "football",
  "table_tennis",
  "lawn_tennis",
  "snooker",
];

export const SPORTS_VENUE_LABELS: Record<SportsVenueCode, string> = {
  cricket_ground: "Cricket ground",
  badminton_court: "Badminton court",
  basketball_court: "Basketball court",
  football_field: "Football",
  table_tennis: "Table tennis",
  lawn_tennis: "Lawn tennis",
  snooker_board_1: "Snooker board 1",
  snooker_board_2: "Snooker board 2",
};

/** Bookable venue codes per sport (snooker has two boards). */
export const SPORT_VENUES: Record<SportType, SportsVenueCode[]> = {
  cricket: ["cricket_ground"],
  badminton: ["badminton_court"],
  basketball: ["basketball_court"],
  football: ["football_field"],
  table_tennis: ["table_tennis"],
  lawn_tennis: ["lawn_tennis"],
  snooker: ["snooker_board_1", "snooker_board_2"],
};

export function venuesForSport(sport: SportType): SportsVenueCode[] {
  return SPORT_VENUES[sport];
}

/** Parse "HH:mm", "HH:mm:ss", or a time fragment from Postgres/ISO into minutes from midnight. */
export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (t == null || t === "") return null;
  const s = String(t).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return h * 60 + min;
}

/**
 * Whether two half-open [start, end) time ranges overlap (same calendar day).
 * Uses numeric minutes — string comparison is unsafe for "9:00" vs "17:00".
 */
export function isTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = parseTimeToMinutes(startA);
  const a1 = parseTimeToMinutes(endA);
  const b0 = parseTimeToMinutes(startB);
  const b1 = parseTimeToMinutes(endB);
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  if (a0 >= a1 || b0 >= b1) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * Sports “my requests” lists should use `.eq("requester_id", profile.id)` (Supabase query
 * builder), not a raw `.or(...)` string with `requester_email` — unquoted `@` in emails
 * breaks PostgREST filters and can return every RLS-visible row. The venue calendar still
 * loads all approved bookings in `ResourceAvailabilityCalendar`.
 */
