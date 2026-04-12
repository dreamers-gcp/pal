import type { CalendarRequest } from "../types";

export function transformCalendarRequestJoins(data: unknown[]): CalendarRequest[] {
  return data.map((req: any) => ({
    ...req,
    student_groups: req.student_groups?.map((sg: any) => sg.student_group).filter(Boolean) || [],
  }));
}
