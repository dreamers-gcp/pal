/**
 * Timetable LLM prompts — edit this file to change scheduling instructions.
 * Used by: POST /api/timetable/generate
 */
import { TIMETABLE_SLOTS, TIMETABLE_SLOT_CODES } from "@/lib/timetable-slots";

export function getTimetableGenerateSystemPrompt(): string {
  return `You are an expert university timetable scheduler. You MUST output valid JSON only (no markdown fences).

Hard constraints (must never violate):
- Each professor teaches at most 3 hours per day (each class slot is 1.5 hours, so at most 2 slots per day per professor).
- No overlapping assignments for the same professor (same day + slot).
- No overlapping use of the same classroom (same day + slot).
- No two classes for the same course in the same day + slot.
- Only use slot codes S1–S7 and days 1–6 (Monday–Saturday).
- Assign exactly the required number of total sessions in the full term per (course, professor) pair.

Soft constraints (optimize when possible):
- Prefer stated preferred time slots.
- Spread classes across the week; avoid huge gaps for a professor; balance workload.

You should return JSON with shape:
{"term_schedule":[{"course_name":"string","professor_email":"string","event_date":"YYYY-MM-DD","slot":"S1","classroom_id":"uuid"}],"notes":"string"}

term_schedule should list ONE entry per actual class session in the full term date range. event_date must be Monday-Saturday only and inside the term range.

If generating the full term is too large, return weekly_schedule instead:
{"weekly_schedule":[{"course_name":"string","professor_email":"string","day_of_week":1,"slot":"S1","classroom_id":"uuid"}],"notes":"string"}

When returning weekly_schedule, include a conflict-free weekly pattern with exactly weekly_sessions_required entries per course+professor pair, where day_of_week is 1-6 (Mon-Sat).`;
}

export type TimetableGenerateUserPromptInput = {
  term: string;
  startDate: string;
  endDate: string;
  termWeeks: number;
  courses: Array<{
    course_name: string;
    professor_email: string;
    professor: string;
    course_id: string;
    credits: number;
    total_sessions_in_term: number;
    weekly_sessions_required: number;
    preferred_slot_1: string | null;
    preferred_slot_2: string | null;
    preferred_slot_3: string | null;
    max_teaching_hours_per_day: number;
    enrolled_students: number;
  }>;
  classrooms: Array<{ id: string; name: string; capacity: number | null }>;
};

/** User message body: term context + slot list + rooms + course JSON. */
export function buildTimetableGenerateUserPrompt(input: TimetableGenerateUserPromptInput): string {
  return `Term: ${input.term}
Term date range: ${input.startDate} to ${input.endDate}
Approximate teaching weeks: ${input.termWeeks}

Slot definitions (90-minute teaching blocks; breaks are implicit between slots):
${TIMETABLE_SLOT_CODES.map(
    (c) =>
      `- ${c}: ${TIMETABLE_SLOTS[c].start}–${TIMETABLE_SLOTS[c].end}`
  ).join("\n")}

Classrooms (use classroom_id from this list only; room capacity must be >= enrolled_students for that course):
${input.classrooms.map((c) => `- ${c.id} | ${c.name} | capacity ${c.capacity ?? "?"}`).join("\n")}

Courses to schedule:
${JSON.stringify(input.courses, null, 2)}

Credit → total sessions per term mapping used for totals: 1.5 credits → 10 sessions, 2 → 13, 3 → 20 (interpolated for other credit values).
weekly_sessions_required = ceil(total_sessions_in_term / ${input.termWeeks}) (reference only; final output must match total_sessions_in_term exactly).

Produce a full-TERM timetable that satisfies all hard constraints and includes exactly total_sessions_in_term entries per course+professor pair.

Return JSON: {"term_schedule":[...],"notes":"brief explanation"}.
Fallback allowed JSON: {"weekly_schedule":[...],"notes":"brief explanation"}.`;
}
