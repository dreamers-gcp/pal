import type { SportType, SportsVenueCode } from "../types";

export const SPORT_LABELS: Record<SportType, string> = {
  cricket: "Cricket",
  badminton: "Badminton",
  basketball: "Basketball",
  football: "Football",
  table_tennis: "Table Tennis",
  lawn_tennis: "Lawn Tennis",
  snooker: "Snooker",
};

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
  cricket_ground: "Cricket Ground",
  badminton_court: "Badminton Court",
  basketball_court: "Basketball Court",
  football_field: "Football",
  table_tennis: "Table Tennis",
  lawn_tennis: "Lawn Tennis",
  snooker_board_1: "Snooker Board 1",
  snooker_board_2: "Snooker Board 2",
};

const SPORT_VENUES: Record<SportType, SportsVenueCode[]> = {
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

export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (t == null || t === "") return null;
  const s = String(t).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return h * 60 + min;
}

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
