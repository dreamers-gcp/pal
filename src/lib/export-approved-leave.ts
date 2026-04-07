import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { StudentLeaveRequest } from "@/lib/types";
import { formatSubmittedAt } from "@/lib/utils";

/**
 * Inclusive overlap: leave [leaveStart, leaveEnd] vs filter window [from, to].
 * Empty from or to means unbounded on that side.
 */
export function leaveOverlapsDateRange(
  leaveStart: string,
  leaveEnd: string,
  filterFrom: string,
  filterTo: string
): boolean {
  let from = filterFrom;
  let to = filterTo;
  if (from && to && from > to) {
    [from, to] = [to, from];
  }
  if (!from && !to) return true;
  if (from && !to) return leaveEnd >= from;
  if (!from && to) return leaveStart <= to;
  return leaveStart <= to && leaveEnd >= from;
}

export function downloadApprovedLeaveXlsx(rows: StudentLeaveRequest[]): void {
  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
  const aoa: (string | number)[][] = [
    [
      "Student name",
      "Email",
      "Student group",
      "Leave start",
      "Leave end",
      "Reason",
      "Submitted",
    ],
    ...rows.map((r) => [
      r.student?.full_name ?? "",
      r.student?.email ?? "",
      r.student?.student_group ?? "",
      r.start_date,
      r.end_date,
      r.reason ?? "",
      formatSubmittedAt(r.created_at),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Approved leave");
  XLSX.writeFile(wb, `approved-student-leave_${stamp}.xlsx`);
}
