import * as XLSX from "xlsx";
import { format } from "date-fns";
import { formatCreditsDisplay } from "@/lib/credits-parse";

export type StudentRosterExportRow = {
  name: string;
  email: string;
  /** Profile program name when known. */
  studentGroup?: string | null;
  subjects: string[];
  signedUp: boolean;
};

export type ProfessorRosterExportRow = {
  name: string;
  email: string;
  subjects: string[];
  terms: string[];
  totalCredits: number;
};

/**
 * Exports the same rows shown in Manage Students (respects term/subject filters).
 */
export function downloadStudentRosterXlsx(
  rows: StudentRosterExportRow[]
): void {
  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
  const aoa: (string | number)[][] = [
    ["Name", "Email", "Program", "Subjects", "Status"],
    ...rows.map((r) => [
      r.name,
      r.email,
      r.studentGroup?.trim() ? r.studentGroup : "—",
      r.subjects.length ? r.subjects.join("; ") : "—",
      r.signedUp ? "Signed up" : "Pending",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, `students-roster_${stamp}.xlsx`);
}

/**
 * Exports the same rows shown in Manage Professors (respects term/subject filters).
 */
export function downloadProfessorRosterXlsx(
  rows: ProfessorRosterExportRow[]
): void {
  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
  const aoa: (string | number)[][] = [
    ["Name", "Email", "Subjects", "Terms", "Total credits"],
    ...rows.map((r) => [
      r.name,
      r.email,
      r.subjects.join("; "),
      r.terms.sort().join("; "),
      formatCreditsDisplay(r.totalCredits),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Professors");
  XLSX.writeFile(wb, `professors-roster_${stamp}.xlsx`);
}
