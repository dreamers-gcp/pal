import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

/** Same range as web student/professor calendar tabs. */
export function calendarWindowBounds(now = new Date()): { from: string; to: string } {
  const from = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const to = format(endOfMonth(addMonths(now, 5)), "yyyy-MM-dd");
  return { from, to };
}
