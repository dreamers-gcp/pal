import type { StudentGroup } from "@/lib/types";

/**
 * Returns all student_groups (programs) sorted alphabetically.
 * Programs are created dynamically when the admin uploads a student roster CSV.
 */
export function groupsForProfessorBookingForm(all: StudentGroup[]): StudentGroup[] {
  return [...all].sort((a, b) => a.name.localeCompare(b.name));
}
