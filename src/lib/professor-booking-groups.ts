import type { StudentGroup } from "@/lib/types";

/** Student groups shown in the professor “Create request” form (order preserved). */
export const PROFESSOR_BOOKING_STUDENT_GROUP_NAMES = [
  "GMP-A",
  "GMP-B",
  "HRM-A",
  "HRM-B",
  "HRM-C",
  "BM-A",
  "BM-B",
  "BM-C",
  "BM-D",
] as const;

export function groupsForProfessorBookingForm(all: StudentGroup[]): StudentGroup[] {
  const byName = new Map(all.map((g) => [g.name, g]));
  return PROFESSOR_BOOKING_STUDENT_GROUP_NAMES.map((name) => byName.get(name)).filter(
    (g): g is StudentGroup => g != null
  );
}
