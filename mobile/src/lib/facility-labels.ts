import type { FacilityBookingType } from "../types";

export const FACILITY_TYPE_LABELS: Record<FacilityBookingType, string> = {
  auditorium: "Auditorium",
  computer_hall: "Computer Hall",
  board_room: "Board Room",
  conference_room: "Conference Room",
};

/** DB may store legacy `main` / `conf_*` codes for some halls — match web filter. */
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

export function venuesForFacilityType(t: FacilityBookingType): { code: string; label: string }[] {
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

export function facilityVenueLabel(facilityType: FacilityBookingType, venueCode: string): string {
  const list = venuesForFacilityType(facilityType);
  const match = list.find((v) => v.code === venueCode);
  if (match) return match.label;
  return venueCode.replace(/_/g, " ");
}
