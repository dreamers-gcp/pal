import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import type { ProfessorAssignment } from "@/lib/types";
import { coerceCredits } from "@/lib/credits-parse";
import { totalSessionsFromCredits, weeklySessionsRequired } from "@/lib/timetable-credits";
import { TIMETABLE_SLOTS, toDbTime } from "@/lib/timetable-slots";
import {
  parseLlmJson,
  validateLlmSchedule,
  validateLlmTermSchedule,
  type LlmWeeklyEntry,
  type LlmTermEntry,
} from "@/lib/timetable-llm-validate";
import {
  getTimetableGenerateSystemPrompt,
  buildTimetableGenerateUserPrompt,
} from "@/prompts/timetable-generate";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.OPENAI_TIMETABLE_MODEL?.trim() || "gpt-4o";

function calculateTermWeeks(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 1;
  }
  const ms = end.getTime() - start.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

function isoDateToWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const js = d.getUTCDay();
  return js >= 1 && js <= 6 ? js : 1;
}

function listWeekdayDates(startDate: string, endDate: string): Record<number, string[]> {
  const out: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    const js = current.getUTCDay();
    if (js >= 1 && js <= 6) out[js].push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

function expandWeeklyToTermSchedule(
  weekly: LlmWeeklyEntry[],
  expectedTotalByKey: Map<string, number>,
  startDate: string,
  endDate: string
): LlmTermEntry[] {
  const byWeekday = listWeekdayDates(startDate, endDate);
  const grouped = new Map<string, LlmWeeklyEntry[]>();
  for (const e of weekly) {
    const key = `${e.course_name.trim().toLowerCase()}|${e.professor_email.toLowerCase()}`;
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  const term: LlmTermEntry[] = [];

  for (const [key, expectedTotal] of expectedTotalByKey) {
    const patterns = (grouped.get(key) ?? []).slice().sort((a, b) => a.day_of_week - b.day_of_week);
    if (patterns.length === 0) continue;
    const perPatternCount = new Array<number>(patterns.length).fill(0);
    for (let i = 0; i < expectedTotal; i++) {
      const patternIdx = i % patterns.length;
      const p = patterns[patternIdx];
      const day = p.day_of_week;
      const dates = byWeekday[day] ?? [];
      if (dates.length === 0) continue;
      const cursor = perPatternCount[patternIdx];
      const chosen = dates[Math.min(cursor, dates.length - 1)];
      perPatternCount[patternIdx] = cursor + 1;
      term.push({
        course_name: p.course_name,
        professor_email: p.professor_email,
        event_date: chosen,
        slot: p.slot,
        classroom_id: p.classroom_id,
      });
    }
  }
  return term;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { term?: string; startDate?: string; endDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const term = body.term?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  if (!term || !startDate || !endDate) {
    return NextResponse.json(
      { error: "term, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const [paRes, crRes, sgRes, seRes] = await Promise.all([
    supabase.from("professor_assignments").select("*").eq("term", term),
    supabase.from("classrooms").select("id, name, capacity").order("name"),
    supabase.from("student_groups").select("id, name"),
    supabase.from("student_enrollments").select("email, subject, term").eq("term", term),
  ]);

  const assignments = ((paRes.data ?? []) as ProfessorAssignment[]).map((a) => ({
    ...a,
    credits: coerceCredits(a.credits),
    professor: typeof a.professor === "string" ? a.professor : "",
    course_id: typeof a.course_id === "string" ? a.course_id : "",
  }));
  if (assignments.length === 0) {
    return NextResponse.json(
      { error: "No professor assignments for this term" },
      { status: 400 }
    );
  }

  const classrooms = (crRes.data ?? []) as Array<{
    id: string;
    name: string;
    capacity: number | null;
  }>;
  const withCap = classrooms.filter((c) => (c.capacity ?? 0) > 0);
  if (withCap.length === 0) {
    return NextResponse.json(
      { error: "No classrooms with capacity set" },
      { status: 400 }
    );
  }

  const groups = (sgRes.data ?? []) as { id: string; name: string }[];
  const groupByName = new Map(groups.map((g) => [g.name, g]));

  const enrollments = seRes.data ?? [];
  const enrollmentBySubject: Record<string, number> = {};
  for (const e of enrollments) {
    enrollmentBySubject[e.subject] = (enrollmentBySubject[e.subject] ?? 0) + 1;
  }

  const termWeeks = calculateTermWeeks(startDate, endDate);
  const coursesPayload: Array<{
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
  }> = [];

  const expectedTotalByKey = new Map<string, number>();
  const expectedWeeklyByKey = new Map<string, number>();

  for (const a of assignments) {
    const g = groupByName.get(a.subject);
    if (!g) {
      return NextResponse.json(
        {
          error: `Program (course) not found for "${a.subject}". Create the program or fix CSV.`,
        },
        { status: 400 }
      );
    }
    const total = totalSessionsFromCredits(a.credits);
    const weekly = weeklySessionsRequired(total, termWeeks);
    const key = `${a.subject.toLowerCase()}|${a.email.toLowerCase()}`;
    expectedTotalByKey.set(key, total);
    expectedWeeklyByKey.set(key, weekly);

    const enrolled = enrollmentBySubject[a.subject] ?? 0;

    coursesPayload.push({
      course_name: a.subject,
      professor_email: a.email,
      professor: a.professor,
      course_id: a.course_id ?? "",
      credits: a.credits,
      total_sessions_in_term: total,
      weekly_sessions_required: weekly,
      preferred_slot_1: a.preferred_slot_1 ?? null,
      preferred_slot_2: a.preferred_slot_2 ?? null,
      preferred_slot_3: a.preferred_slot_3 ?? null,
      max_teaching_hours_per_day: Math.min(3, a.max_hours_per_day ?? 3),
      enrolled_students: enrolled,
    });
  }

  const userPrompt = buildTimetableGenerateUserPrompt({
    term,
    startDate,
    endDate,
    termWeeks,
    courses: coursesPayload,
    classrooms: withCap,
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.15,
      max_tokens: 16384,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getTimetableGenerateSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
    });
    content = completion.choices[0]?.message?.content ?? "";
    if (!content) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `OpenAI error: ${msg}` }, { status: 502 });
  }

  let parsed: { term_schedule?: LlmTermEntry[]; weekly_schedule?: LlmWeeklyEntry[]; notes?: string };
  try {
    parsed = parseLlmJson(content) as {
      term_schedule?: LlmTermEntry[];
      weekly_schedule?: LlmWeeklyEntry[];
      notes?: string;
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Failed to parse model JSON: ${msg}`, raw: content.slice(0, 2000) },
      { status: 422 }
    );
  }

  const parsedTerm = Array.isArray(parsed.term_schedule) ? parsed.term_schedule : [];
  const parsedWeekly = Array.isArray(parsed.weekly_schedule) ? parsed.weekly_schedule : [];
  let rawEntries: LlmTermEntry[] = parsedTerm;
  let validation = validateLlmTermSchedule(
    rawEntries,
    withCap,
    assignments,
    expectedTotalByKey,
    enrollmentBySubject,
    startDate,
    endDate
  );

  if (!validation.ok) {
    // Fallback 1: if weekly schedule exists, validate weekly then expand deterministically to term.
    if (parsedWeekly.length > 0) {
      const weeklyValidation = validateLlmSchedule(
        parsedWeekly,
        withCap,
        assignments,
        expectedWeeklyByKey,
        enrollmentBySubject
      );
      if (weeklyValidation.ok) {
        rawEntries = expandWeeklyToTermSchedule(
          parsedWeekly,
          expectedTotalByKey,
          startDate,
          endDate
        );
        validation = validateLlmTermSchedule(
          rawEntries,
          withCap,
          assignments,
          expectedTotalByKey,
          enrollmentBySubject,
          startDate,
          endDate
        );
      }
    }
  }

  if (rawEntries.length === 0) {
    return NextResponse.json(
      { error: "Model returned no usable schedule entries", raw: content.slice(0, 2000) },
      { status: 422 }
    );
  }

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "Generated timetable failed validation",
        validationErrors: validation.errors,
        notes: parsed.notes,
        rawEntries,
      },
      { status: 422 }
    );
  }

  const profByEmail = new Map(assignments.map((a) => [a.email.toLowerCase(), a]));

  const slots: Array<{
    subject: string;
    professorEmail: string;
    professorName: string;
    studentGroupId: string;
    studentGroupName: string;
    classroomId: string;
    classroomName: string;
    eventDate: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotCode: string;
  }> = [];

  for (const e of rawEntries) {
    const slotCode = e.slot as keyof typeof TIMETABLE_SLOTS;
    const times = TIMETABLE_SLOTS[slotCode];
    const pa = profByEmail.get(e.professor_email.toLowerCase());
    const profName = pa?.professor ?? e.professor_email;
    const g =
      groups.find(
        (x) => x.name.toLowerCase() === e.course_name.trim().toLowerCase()
      ) ?? groupByName.get(e.course_name);
    if (!g) {
      return NextResponse.json(
        { error: `Could not resolve program for course "${e.course_name}"` },
        { status: 500 }
      );
    }
    const room = withCap.find((c) => c.id === e.classroom_id);
    if (!room) {
      return NextResponse.json(
        { error: `Could not resolve classroom ${e.classroom_id}` },
        { status: 500 }
      );
    }

    const d = new Date(`${e.event_date}T00:00:00Z`);
    const jsDay = d.getUTCDay();
    const dayOfWeek = jsDay >= 1 && jsDay <= 6 ? jsDay : 1;

    slots.push({
      subject: e.course_name,
      professorEmail: e.professor_email.toLowerCase(),
      professorName: profName,
      studentGroupId: g.id,
      studentGroupName: g.name,
      classroomId: room.id,
      classroomName: room.name,
      eventDate: e.event_date,
      dayOfWeek,
      startTime: toDbTime(times.start),
      endTime: toDbTime(times.end),
      slotCode: e.slot,
    });
  }

  return NextResponse.json({
    slots,
    warnings: [],
    modelNotes: parsed.notes ?? "",
    model: MODEL,
  });
}
