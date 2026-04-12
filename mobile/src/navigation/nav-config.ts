import type { UserRole } from "../types";

/** Drawer row: link or non-interactive section heading. */
export type NavEntry =
  | { type: "link"; id: string; label: string }
  | { type: "heading"; label: string };

/** @deprecated Use `NavEntry` / `navEntriesForRole`. */
export type NavItem = { id: string; label: string };

/** Matches web student dashboard sidebar; Attendance omitted (built last). */
export const STUDENT_NAV: NavEntry[] = [
  { type: "link", id: "events", label: "Events" },
  { type: "link", id: "calendar", label: "Calendar" },
  { type: "link", id: "attendance", label: "Attendance" },
  { type: "link", id: "face-registration", label: "Face registration" },
  { type: "link", id: "tasks", label: "Task Tracker" },
  { type: "link", id: "guest-house", label: "Guest House Requests" },
  { type: "link", id: "sports", label: "Sports Requests" },
  { type: "link", id: "campus", label: "Campus services" },
  { type: "link", id: "parcels", label: "Parcels" },
];

/** Matches web professor dashboard sidebar; Attendance omitted. */
export const PROFESSOR_NAV: NavEntry[] = [
  { type: "link", id: "my-requests", label: "My Requests" },
  { type: "link", id: "calendar", label: "Calendar" },
  { type: "link", id: "sports", label: "Sports Requests" },
  { type: "link", id: "parcels", label: "Parcels" },
  { type: "link", id: "script-evaluation", label: "Script evaluation" },
];

/** Admin: requests + availability calendars + rest of rail (web order). */
export const ADMIN_NAV: NavEntry[] = [
  { type: "link", id: "request-overview", label: "Overview" },
  { type: "link", id: "calendar", label: "Calendar" },
  { type: "link", id: "request-event-requests", label: "Event requests" },
  { type: "link", id: "request-guest-house-requests", label: "Guest house" },
  { type: "link", id: "request-sports-requests", label: "Sports" },
  { type: "link", id: "request-campus-leave", label: "Student leave" },
  { type: "link", id: "request-campus-facilities", label: "Campus facilities" },
  { type: "link", id: "request-campus-mess", label: "Mess requests" },
  { type: "link", id: "request-campus-health", label: "Health appointments" },
  { type: "heading", label: "Availability" },
  { type: "link", id: "avail-event-venues", label: "Event venues" },
  { type: "link", id: "avail-sports", label: "Sports venues" },
  { type: "link", id: "avail-guest-house", label: "Guest house" },
  { type: "link", id: "avail-facilities", label: "Facility availability" },
  { type: "link", id: "avail-health", label: "Health availability" },
  { type: "heading", label: "More" },
  { type: "link", id: "enrollments", label: "Enrollments" },
  { type: "link", id: "students", label: "Manage Students" },
  { type: "link", id: "prof-assignments", label: "Professor Assignments" },
  { type: "link", id: "professors", label: "Manage Professors" },
  { type: "link", id: "parcel-management", label: "Parcel management" },
  { type: "link", id: "timetable", label: "Timetable" },
];

export function defaultNavId(role: UserRole): string {
  if (role === "student") return "events";
  if (role === "professor") return "my-requests";
  return "request-overview";
}

export function navEntriesForRole(role: UserRole): NavEntry[] {
  if (role === "student") return STUDENT_NAV;
  if (role === "professor") return PROFESSOR_NAV;
  return ADMIN_NAV;
}

/** @deprecated Use `navEntriesForRole`. */
export function navItemsForRole(role: UserRole): NavItem[] {
  return navEntriesForRole(role)
    .filter((e): e is NavEntry & { type: "link" } => e.type === "link")
    .map((e) => ({ id: e.id, label: e.label }));
}
