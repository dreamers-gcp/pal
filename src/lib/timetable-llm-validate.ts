import type { ProfessorAssignment } from "@/lib/types";
import { TIMETABLE_SLOT_CODES, type TimetableSlotCode } from "@/lib/timetable-slots";

export interface LlmWeeklyEntry {
  course_name: string;
  professor_email: string;
  day_of_week: number;
  slot: string;
  classroom_id: string;
}

export interface LlmTermEntry {
  course_name: string;
  professor_email: string;
  event_date: string;
  slot: string;
  classroom_id: string;
}

export interface ClassroomInfo {
  id: string;
  name: string;
  capacity: number | null;
}

export function isValidSlot(s: string): s is TimetableSlotCode {
  return TIMETABLE_SLOT_CODES.includes(s as TimetableSlotCode);
}

export function validateLlmSchedule(
  entries: LlmWeeklyEntry[],
  classrooms: ClassroomInfo[],
  assignmentRows: ProfessorAssignment[],
  expectedWeeklyByKey: Map<string, number>,
  enrollmentBySubject: Record<string, number>
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const roomIds = new Set(classrooms.map((c) => c.id));
  const roomById = new Map(classrooms.map((c) => [c.id, c]));

  const assignmentByCourseProf = new Map<string, ProfessorAssignment>();
  for (const a of assignmentRows) {
    assignmentByCourseProf.set(`${a.subject.toLowerCase()}|${a.email.toLowerCase()}`, a);
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    e.slot = String(e.slot).trim().toUpperCase();
    const row = i + 1;
    if (!e.course_name?.trim()) errors.push(`Entry ${row}: missing course_name`);
    if (!e.professor_email?.includes("@")) errors.push(`Entry ${row}: invalid professor_email`);
    if (!Number.isInteger(e.day_of_week) || e.day_of_week < 1 || e.day_of_week > 6) {
      errors.push(`Entry ${row}: day_of_week must be 1–6 (Mon–Sat)`);
    }
    if (!isValidSlot(e.slot)) {
      errors.push(`Entry ${row}: slot must be one of ${TIMETABLE_SLOT_CODES.join(", ")}`);
    }
    if (!e.classroom_id || !roomIds.has(e.classroom_id)) {
      errors.push(`Entry ${row}: unknown classroom_id`);
    }
    const key = `${e.course_name.trim().toLowerCase()}|${e.professor_email.toLowerCase()}`;
    if (!assignmentByCourseProf.has(key)) {
      errors.push(
        `Entry ${row}: no professor assignment for course "${e.course_name}" and ${e.professor_email}`
      );
    }

    const room = roomById.get(e.classroom_id);
    const subj = e.course_name.trim();
    let need = enrollmentBySubject[subj] ?? 0;
    if (need === 0) {
      const lower = subj.toLowerCase();
      for (const [k, v] of Object.entries(enrollmentBySubject)) {
        if (k.toLowerCase() === lower) {
          need = v;
          break;
        }
      }
    }
    if (room && need > 0 && (room.capacity ?? 0) < need) {
      errors.push(
        `Entry ${row}: classroom "${room.name}" capacity ${room.capacity} < enrollment ${need} for ${subj}`
      );
    }
  }

  // Overlap: professor
  const profSlot = new Set<string>();
  const roomSlot = new Set<string>();
  const groupSlot = new Set<string>();

  for (const e of entries) {
    const pe = `${e.professor_email.toLowerCase()}|${e.day_of_week}|${e.slot}`;
    if (profSlot.has(pe)) errors.push(`Professor double-booked: ${pe}`);
    profSlot.add(pe);

    const re = `${e.classroom_id}|${e.day_of_week}|${e.slot}`;
    if (roomSlot.has(re)) errors.push(`Classroom double-booked: ${re}`);
    roomSlot.add(re);

    const gk = `${e.course_name.toLowerCase()}|${e.day_of_week}|${e.slot}`;
    if (groupSlot.has(gk)) errors.push(`Course "${e.course_name}" double-booked same slot`);
    groupSlot.add(gk);
  }

  // Max teaching slots per day per professor (CSV max hours; hard cap 3h = 2 slots)
  function maxSlotsForProf(email: string): number {
    const rows = assignmentRows.filter(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
    if (rows.length === 0) return 2;
    let minH = 3;
    for (const r of rows) {
      minH = Math.min(minH, Math.min(3, r.max_hours_per_day ?? 3));
    }
    return Math.max(1, Math.floor(minH / 1.5));
  }

  const profDayCount: Record<string, Record<number, number>> = {};
  for (const e of entries) {
    const em = e.professor_email.toLowerCase();
    if (!profDayCount[em]) profDayCount[em] = {};
    profDayCount[em][e.day_of_week] = (profDayCount[em][e.day_of_week] ?? 0) + 1;
  }
  for (const em of Object.keys(profDayCount)) {
    const maxSlots = maxSlotsForProf(em);
    for (const [d, c] of Object.entries(profDayCount[em])) {
      if (c > maxSlots) {
        errors.push(
          `Professor ${em} has ${c} slots on day ${d} (max ${maxSlots} slots/day from CSV / 3h cap)`
        );
      }
    }
  }

  // Weekly session counts
  const countByKey = new Map<string, number>();
  for (const e of entries) {
    const k = `${e.course_name.trim().toLowerCase()}|${e.professor_email.toLowerCase()}`;
    countByKey.set(k, (countByKey.get(k) ?? 0) + 1);
  }

  for (const [k, expected] of expectedWeeklyByKey) {
    const got = countByKey.get(k) ?? 0;
    if (got !== expected) {
      errors.push(
        `Course ${k}: expected ${expected} weekly slot(s), got ${got}`
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function parseIsoDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getWeekdayFromIsoDate(value: string): number | null {
  const d = parseIsoDateOnly(value);
  if (!d) return null;
  const js = d.getUTCDay(); // 0=Sun ... 6=Sat
  if (js === 0) return null;
  return js;
}

export function validateLlmTermSchedule(
  entries: LlmTermEntry[],
  classrooms: ClassroomInfo[],
  assignmentRows: ProfessorAssignment[],
  expectedTotalByKey: Map<string, number>,
  enrollmentBySubject: Record<string, number>,
  startDate: string,
  endDate: string
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const roomIds = new Set(classrooms.map((c) => c.id));
  const roomById = new Map(classrooms.map((c) => [c.id, c]));
  const start = parseIsoDateOnly(startDate);
  const end = parseIsoDateOnly(endDate);
  if (!start || !end || start > end) {
    return { ok: false, errors: ["Invalid term date range"] };
  }

  const assignmentByCourseProf = new Map<string, ProfessorAssignment>();
  for (const a of assignmentRows) {
    assignmentByCourseProf.set(`${a.subject.toLowerCase()}|${a.email.toLowerCase()}`, a);
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    e.slot = String(e.slot).trim().toUpperCase();
    const row = i + 1;
    if (!e.course_name?.trim()) errors.push(`Entry ${row}: missing course_name`);
    if (!e.professor_email?.includes("@")) errors.push(`Entry ${row}: invalid professor_email`);
    if (!isValidSlot(e.slot)) {
      errors.push(`Entry ${row}: slot must be one of ${TIMETABLE_SLOT_CODES.join(", ")}`);
    }
    if (!e.classroom_id || !roomIds.has(e.classroom_id)) {
      errors.push(`Entry ${row}: unknown classroom_id`);
    }
    const ed = parseIsoDateOnly(e.event_date);
    const weekday = getWeekdayFromIsoDate(e.event_date);
    if (!ed) {
      errors.push(`Entry ${row}: invalid event_date (expected YYYY-MM-DD)`);
    } else {
      if (ed < start || ed > end) {
        errors.push(`Entry ${row}: event_date ${e.event_date} outside term range`);
      }
      if (!weekday) {
        errors.push(`Entry ${row}: event_date ${e.event_date} must be Monday-Saturday`);
      }
    }

    const key = `${e.course_name.trim().toLowerCase()}|${e.professor_email.toLowerCase()}`;
    if (!assignmentByCourseProf.has(key)) {
      errors.push(
        `Entry ${row}: no professor assignment for course "${e.course_name}" and ${e.professor_email}`
      );
    }

    const room = roomById.get(e.classroom_id);
    const subj = e.course_name.trim();
    let need = enrollmentBySubject[subj] ?? 0;
    if (need === 0) {
      const lower = subj.toLowerCase();
      for (const [k, v] of Object.entries(enrollmentBySubject)) {
        if (k.toLowerCase() === lower) {
          need = v;
          break;
        }
      }
    }
    if (room && need > 0 && (room.capacity ?? 0) < need) {
      errors.push(
        `Entry ${row}: classroom "${room.name}" capacity ${room.capacity} < enrollment ${need} for ${subj}`
      );
    }
  }

  const profSlot = new Set<string>();
  const roomSlot = new Set<string>();
  const groupSlot = new Set<string>();
  for (const e of entries) {
    const pe = `${e.professor_email.toLowerCase()}|${e.event_date}|${e.slot}`;
    if (profSlot.has(pe)) errors.push(`Professor double-booked: ${pe}`);
    profSlot.add(pe);

    const re = `${e.classroom_id}|${e.event_date}|${e.slot}`;
    if (roomSlot.has(re)) errors.push(`Classroom double-booked: ${re}`);
    roomSlot.add(re);

    const gk = `${e.course_name.toLowerCase()}|${e.event_date}|${e.slot}`;
    if (groupSlot.has(gk)) errors.push(`Course "${e.course_name}" double-booked same slot`);
    groupSlot.add(gk);
  }

  function maxSlotsForProf(email: string): number {
    const rows = assignmentRows.filter(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
    if (rows.length === 0) return 2;
    let minH = 3;
    for (const r of rows) {
      minH = Math.min(minH, Math.min(3, r.max_hours_per_day ?? 3));
    }
    return Math.max(1, Math.floor(minH / 1.5));
  }

  const profDateCount: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    const em = e.professor_email.toLowerCase();
    if (!profDateCount[em]) profDateCount[em] = {};
    profDateCount[em][e.event_date] = (profDateCount[em][e.event_date] ?? 0) + 1;
  }
  for (const em of Object.keys(profDateCount)) {
    const maxSlots = maxSlotsForProf(em);
    for (const [d, c] of Object.entries(profDateCount[em])) {
      if (c > maxSlots) {
        errors.push(
          `Professor ${em} has ${c} slots on ${d} (max ${maxSlots} slots/day from CSV / 3h cap)`
        );
      }
    }
  }

  const countByKey = new Map<string, number>();
  for (const e of entries) {
    const k = `${e.course_name.trim().toLowerCase()}|${e.professor_email.toLowerCase()}`;
    countByKey.set(k, (countByKey.get(k) ?? 0) + 1);
  }

  for (const [k, expected] of expectedTotalByKey) {
    const got = countByKey.get(k) ?? 0;
    if (got !== expected) {
      errors.push(
        `Course ${k}: expected ${expected} total session(s) in term, got ${got}`
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

export function parseLlmJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object in model response");
    return JSON.parse(jsonMatch[0]);
  }
}
