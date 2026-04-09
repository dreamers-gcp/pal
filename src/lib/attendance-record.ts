/** Professor "mark absent" rows use this storage path prefix (no real photo). */
export const PROFESSOR_ABSENT_PHOTO_PREFIX = "manual-override-absent/" as const;

export function isProfessorMarkedAbsent(
  record: { photo_path?: string | null } | undefined | null
): boolean {
  return Boolean(record?.photo_path?.startsWith(PROFESSOR_ABSENT_PHOTO_PREFIX));
}

export function isStudentPresent(
  record: { verified?: boolean | null } | undefined | null
): boolean {
  return record?.verified === true;
}
