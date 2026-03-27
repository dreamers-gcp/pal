import type { SportType, SportsVenueCode } from "@/lib/types";

export const SPORT_LABELS: Record<SportType, string> = {
  badminton: "Badminton",
  cricket: "Cricket",
};

export const SPORTS_VENUE_LABELS: Record<SportsVenueCode, string> = {
  badminton_court_1: "Court 1",
  badminton_court_2: "Court 2",
  badminton_court_3: "Court 3",
  badminton_court_4: "Court 4",
  cricket_main_ground: "Main Ground",
};

export const SPORT_VENUES: Record<SportType, SportsVenueCode[]> = {
  badminton: [
    "badminton_court_1",
    "badminton_court_2",
    "badminton_court_3",
    "badminton_court_4",
  ],
  cricket: ["cricket_main_ground"],
};

export function venuesForSport(sport: SportType): SportsVenueCode[] {
  return SPORT_VENUES[sport];
}

export function isTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && startB < endA;
}
