import type { Profile } from "@/lib/types";

/** Super admin — only this account may edit dashboard section access. */
export const SUPER_ADMIN_EMAIL = "admin@test.com";

/** Super-admin-only nav value (not assignable to other admins). */
export const SUPER_ADMIN_NAV_VALUE = "admin-request-routing";

export type DashboardNavGroup = "requests" | "main";

export type AdminDashboardSection = {
  value: string;
  label: string;
  navGroup: DashboardNavGroup;
};

/**
 * All left-rail sections the super admin can assign (order matches sidebar).
 * Values must match `TabsTrigger` / `TabsContent` in the admin dashboard.
 */
export const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSection[] = [
  { value: "request-overview", label: "Overview", navGroup: "requests" },
  { value: "request-event-requests", label: "Event requests", navGroup: "requests" },
  { value: "request-guest-house-requests", label: "Guest house", navGroup: "requests" },
  { value: "request-sports-requests", label: "Sports", navGroup: "requests" },
  { value: "request-campus-leave", label: "Student leave", navGroup: "requests" },
  { value: "request-campus-facilities", label: "Campus facilities", navGroup: "requests" },
  { value: "request-campus-mess", label: "Mess requests", navGroup: "requests" },
  { value: "request-campus-health", label: "Health appointments", navGroup: "requests" },
  { value: "enrollments", label: "Enrollments", navGroup: "main" },
  { value: "students", label: "Manage Students", navGroup: "main" },
  { value: "prof-assignments", label: "Professor Assignments", navGroup: "main" },
  { value: "professors", label: "Manage Professors", navGroup: "main" },
  { value: "parcel-management", label: "Parcel management", navGroup: "main" },
  { value: "timetable", label: "Timetable", navGroup: "main" },
];

/** Subset under “Requests” — for backward compatibility and grouped UI. */
export const ADMIN_REQUEST_SUBTABS: AdminDashboardSection[] =
  ADMIN_DASHBOARD_SECTIONS.filter((s) => s.navGroup === "requests");

export const ADMIN_ASSIGNABLE_SECTION_VALUES: string[] = ADMIN_DASHBOARD_SECTIONS.map(
  (s) => s.value
);

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperAdminProfile(profile: Pick<Profile, "email">): boolean {
  return normalizeAdminEmail(profile.email) === normalizeAdminEmail(SUPER_ADMIN_EMAIL);
}

export function sectionLabelForValue(value: string): string {
  return ADMIN_DASHBOARD_SECTIONS.find((s) => s.value === value)?.label ?? value;
}
