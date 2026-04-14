import { Ionicons } from "@expo/vector-icons";

/**
 * Ionicons for each drawer `NavEntry` link id (student / professor / admin).
 * Fallback: generic app grid icon for unknown ids.
 */
export const DRAWER_NAV_ICON: Partial<Record<string, keyof typeof Ionicons.glyphMap>> = {
  // Student
  events: "today-outline",
  calendar: "calendar-outline",
  attendance: "finger-print-outline",
  "ble-mesh": "bluetooth-outline",
  "face-registration": "scan-outline",
  tasks: "checkbox-outline",
  "guest-house": "bed-outline",
  sports: "basketball-outline",
  campus: "business-outline",
  parcels: "cube-outline",
  // Professor
  "my-requests": "document-text-outline",
  "script-evaluation": "create-outline",
  // Admin — requests & tools
  "request-overview": "stats-chart-outline",
  "request-event-requests": "calendar-number-outline",
  "request-guest-house-requests": "bed-outline",
  "request-sports-requests": "trophy-outline",
  "request-campus-leave": "airplane-outline",
  "request-campus-facilities": "construct-outline",
  "request-campus-mess": "restaurant-outline",
  "request-campus-health": "medkit-outline",
  "avail-event-venues": "location-outline",
  "avail-sports": "barbell-outline",
  "avail-guest-house": "home-outline",
  "avail-facilities": "library-outline",
  "avail-health": "fitness-outline",
  enrollments: "school-outline",
  students: "people-outline",
  "prof-assignments": "link-outline",
  professors: "person-outline",
  "parcel-management": "archive-outline",
  timetable: "time-outline",
  "admin-request-routing": "shield-checkmark-outline",
};

export function drawerNavIconName(navId: string): keyof typeof Ionicons.glyphMap {
  return DRAWER_NAV_ICON[navId] ?? "apps-outline";
}
