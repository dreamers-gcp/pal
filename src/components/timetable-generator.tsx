"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  ProfessorAssignment,
  StudentEnrollment,
  Classroom,
  StudentGroup,
  GeneratedTimetable,
  TimetableEntry,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Wand2,
  Check,
  X,
  Calendar,
  Clock,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOUR_START = 8;
const HOUR_END = 18;

const SLOT_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-green-100 border-green-300 text-green-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-pink-100 border-pink-300 text-pink-900",
  "bg-teal-100 border-teal-300 text-teal-900",
  "bg-indigo-100 border-indigo-300 text-indigo-900",
  "bg-amber-100 border-amber-300 text-amber-900",
  "bg-cyan-100 border-cyan-300 text-cyan-900",
  "bg-rose-100 border-rose-300 text-rose-900",
];

interface ScheduleSlot {
  subject: string;
  professorEmail: string;
  professorName: string;
  studentGroupId: string;
  studentGroupName: string;
  classroomId: string;
  classroomName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function TimetableGenerator({ profile }: { profile: Profile }) {
  const [profAssignments, setProfAssignments] = useState<ProfessorAssignment[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [timetables, setTimetables] = useState<GeneratedTimetable[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTerm, setSelectedTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(4);
  const [generating, setGenerating] = useState(false);

  const [generatedSlots, setGeneratedSlots] = useState<ScheduleSlot[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genErrors, setGenErrors] = useState<string[]>([]);

  const [viewTimetableId, setViewTimetableId] = useState<string | null>(null);
  const [viewEntries, setViewEntries] = useState<TimetableEntry[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  const [expandedTimetable, setExpandedTimetable] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [paRes, seRes, crRes, sgRes, prRes, ttRes] = await Promise.all([
      supabase.from("professor_assignments").select("*").order("email"),
      supabase.from("student_enrollments").select("*").order("email"),
      supabase.from("classrooms").select("*").order("name"),
      supabase.from("student_groups").select("*").order("name"),
      supabase.from("profiles").select("*").eq("role", "professor").order("full_name"),
      supabase.from("generated_timetables").select("*").order("created_at", { ascending: false }),
    ]);

    if (paRes.data) setProfAssignments(paRes.data);
    if (seRes.data) setStudentEnrollments(seRes.data);
    if (crRes.data) setClassrooms(crRes.data);
    if (sgRes.data) setStudentGroups(sgRes.data);
    if (prRes.data) setProfessors(prRes.data);
    if (ttRes.data) setTimetables(ttRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allTerms = [...new Set(profAssignments.map((a) => a.term))].sort();

  useEffect(() => {
    if (allTerms.length > 0 && !selectedTerm) {
      setSelectedTerm(allTerms[0]);
    }
  }, [allTerms, selectedTerm]);

  function generateTimetable() {
    setGenerating(true);
    setGenErrors([]);
    setGeneratedSlots([]);

    const errors: string[] = [];

    const termAssignments = profAssignments.filter((a) => a.term === selectedTerm);
    if (termAssignments.length === 0) {
      errors.push("No professor assignments found for this term.");
      setGenErrors(errors);
      setGenerating(false);
      return;
    }

    const termEnrollments = studentEnrollments.filter((e) => e.term === selectedTerm);

    const subjectStudentCount: Record<string, number> = {};
    for (const e of termEnrollments) {
      const key = e.subject;
      subjectStudentCount[key] = (subjectStudentCount[key] || 0) + 1;
    }

    const sgByName: Record<string, StudentGroup> = {};
    for (const sg of studentGroups) {
      sgByName[sg.name] = sg;
    }

    const sortedClassrooms = [...classrooms]
      .filter((c) => c.capacity && c.capacity > 0)
      .sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0));

    if (sortedClassrooms.length === 0) {
      errors.push("No classrooms with defined capacity found. Add classrooms with capacity in Supabase.");
      setGenErrors(errors);
      setGenerating(false);
      return;
    }

    const subjectProfessorMap: Record<string, ProfessorAssignment[]> = {};
    for (const a of termAssignments) {
      if (!subjectProfessorMap[a.subject]) subjectProfessorMap[a.subject] = [];
      subjectProfessorMap[a.subject].push(a);
    }

    // Track occupancy: professor -> day -> hours used
    const profDayHours: Record<string, Record<number, number>> = {};
    // Track occupancy: professor -> day -> Set of subjects scheduled
    const profDaySubjects: Record<string, Record<number, Set<string>>> = {};
    // Track classroom occupancy: classroom -> day -> list of [startHour, endHour]
    const roomDaySlots: Record<string, Record<number, Array<[number, number]>>> = {};
    // Track student group occupancy: groupId -> day -> list of [startHour, endHour]
    const groupDaySlots: Record<string, Record<number, Array<[number, number]>>> = {};

    function getProfHours(email: string, day: number): number {
      return profDayHours[email]?.[day] ?? 0;
    }

    function hasProfSubjectOnDay(email: string, day: number, subject: string): boolean {
      return profDaySubjects[email]?.[day]?.has(subject) ?? false;
    }

    function isRoomFree(roomId: string, day: number, startH: number, endH: number): boolean {
      const slots = roomDaySlots[roomId]?.[day] ?? [];
      return !slots.some(([s, e]) => startH < e && s < endH);
    }

    function isGroupFree(groupId: string, day: number, startH: number, endH: number): boolean {
      const slots = groupDaySlots[groupId]?.[day] ?? [];
      return !slots.some(([s, e]) => startH < e && s < endH);
    }

    function bookSlot(
      email: string,
      roomId: string,
      groupId: string,
      day: number,
      startH: number,
      endH: number,
      subject: string
    ) {
      const duration = endH - startH;
      if (!profDayHours[email]) profDayHours[email] = {};
      profDayHours[email][day] = (profDayHours[email][day] ?? 0) + duration;

      if (!profDaySubjects[email]) profDaySubjects[email] = {};
      if (!profDaySubjects[email][day]) profDaySubjects[email][day] = new Set();
      profDaySubjects[email][day].add(subject);

      if (!roomDaySlots[roomId]) roomDaySlots[roomId] = {};
      if (!roomDaySlots[roomId][day]) roomDaySlots[roomId][day] = [];
      roomDaySlots[roomId][day].push([startH, endH]);

      if (!groupDaySlots[groupId]) groupDaySlots[groupId] = {};
      if (!groupDaySlots[groupId][day]) groupDaySlots[groupId][day] = [];
      groupDaySlots[groupId][day].push([startH, endH]);
    }

    const slots: ScheduleSlot[] = [];

    // Build the list of classes to schedule
    interface ClassToSchedule {
      subject: string;
      credits: number;
      professorEmail: string;
      professorName: string;
      studentGroupId: string;
      studentGroupName: string;
      studentCount: number;
    }

    const classesToSchedule: ClassToSchedule[] = [];

    for (const subject of Object.keys(subjectProfessorMap)) {
      const profList = subjectProfessorMap[subject];
      const sg = sgByName[subject];
      if (!sg) {
        errors.push(`Student group not found for subject "${subject}". Ensure the student group exists.`);
        continue;
      }

      const studCount = subjectStudentCount[subject] || 0;

      for (const pa of profList) {
        classesToSchedule.push({
          subject: pa.subject,
          credits: pa.credits,
          professorEmail: pa.email,
          professorName: pa.professor_name,
          studentGroupId: sg.id,
          studentGroupName: sg.name,
          studentCount: studCount,
        });
      }
    }

    // Sort: higher credits first (more classes/week = harder to schedule)
    classesToSchedule.sort((a, b) => b.credits - a.credits);

    for (const cls of classesToSchedule) {
      // credits = how many 1-hour classes per week
      const classesPerWeek = cls.credits;
      let scheduled = 0;

      // Find a suitable classroom based on student count
      const suitableRoom = sortedClassrooms.find(
        (c) => (c.capacity ?? 0) >= cls.studentCount
      ) ?? sortedClassrooms[sortedClassrooms.length - 1];

      for (let attempt = 0; attempt < classesPerWeek; attempt++) {
        let placed = false;

        // Try each day (Mon=1 to Fri=5), spread classes across different days
        const dayOrder = [1, 2, 3, 4, 5].sort((a, b) => {
          const aH = getProfHours(cls.professorEmail, a);
          const bH = getProfHours(cls.professorEmail, b);
          if (aH !== bH) return aH - bH;
          return a - b;
        });

        for (const day of dayOrder) {
          if (placed) break;

          // Constraint: max 1 class of the same subject per day per professor
          if (hasProfSubjectOnDay(cls.professorEmail, day, cls.subject)) continue;

          // Constraint: max hours per day for this professor
          if (getProfHours(cls.professorEmail, day) >= maxHoursPerDay) continue;

          // Try each 1-hour slot from HOUR_START to HOUR_END
          for (let startH = HOUR_START; startH < HOUR_END; startH++) {
            const endH = startH + 1;

            if (!isRoomFree(suitableRoom.id, day, startH, endH)) continue;
            if (!isGroupFree(cls.studentGroupId, day, startH, endH)) continue;

            bookSlot(cls.professorEmail, suitableRoom.id, cls.studentGroupId, day, startH, endH, cls.subject);

            slots.push({
              subject: cls.subject,
              professorEmail: cls.professorEmail,
              professorName: cls.professorName,
              studentGroupId: cls.studentGroupId,
              studentGroupName: cls.studentGroupName,
              classroomId: suitableRoom.id,
              classroomName: suitableRoom.name,
              dayOfWeek: day,
              startTime: `${String(startH).padStart(2, "0")}:00`,
              endTime: `${String(endH).padStart(2, "0")}:00`,
            });

            scheduled++;
            placed = true;
            break;
          }

          if (placed) break;

          // If the best room wasn't free, try other rooms
          for (const room of sortedClassrooms) {
            if (room.id === suitableRoom.id) continue;
            if ((room.capacity ?? 0) < cls.studentCount) continue;

            for (let startH = HOUR_START; startH < HOUR_END; startH++) {
              const endH = startH + 1;
              if (!isRoomFree(room.id, day, startH, endH)) continue;
              if (!isGroupFree(cls.studentGroupId, day, startH, endH)) continue;
              if (getProfHours(cls.professorEmail, day) >= maxHoursPerDay) break;

              bookSlot(cls.professorEmail, room.id, cls.studentGroupId, day, startH, endH, cls.subject);

              slots.push({
                subject: cls.subject,
                professorEmail: cls.professorEmail,
                professorName: cls.professorName,
                studentGroupId: cls.studentGroupId,
                studentGroupName: cls.studentGroupName,
                classroomId: room.id,
                classroomName: room.name,
                dayOfWeek: day,
                startTime: `${String(startH).padStart(2, "0")}:00`,
                endTime: `${String(endH).padStart(2, "0")}:00`,
              });

              scheduled++;
              placed = true;
              break;
            }
            if (placed) break;
          }
        }

        if (!placed) {
          errors.push(
            `Could not schedule class ${attempt + 1}/${classesPerWeek} for "${cls.subject}" (Prof. ${cls.professorName}). All slots conflict.`
          );
        }
      }
    }

    setGeneratedSlots(slots);
    setGenErrors(errors);
    setShowPreview(true);
    setGenerating(false);
  }

  async function saveTimetable() {
    if (generatedSlots.length === 0) return;
    setSaving(true);

    const supabase = createClient();

    const { data: tt, error: ttErr } = await supabase
      .from("generated_timetables")
      .insert({
        term: selectedTerm,
        start_date: startDate,
        end_date: endDate,
        max_hours_per_day: maxHoursPerDay,
        status: "draft",
        generated_by: profile.id,
      })
      .select()
      .single();

    if (ttErr || !tt) {
      toast.error("Failed to save timetable: " + (ttErr?.message ?? "Unknown error"));
      setSaving(false);
      return;
    }

    const profByEmail: Record<string, Profile> = {};
    for (const p of professors) profByEmail[p.email] = p;

    const entries = generatedSlots.map((slot) => ({
      timetable_id: tt.id,
      professor_id: profByEmail[slot.professorEmail]?.id ?? null,
      professor_email: slot.professorEmail,
      subject: slot.subject,
      student_group_id: slot.studentGroupId,
      classroom_id: slot.classroomId,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
    }));

    const { error: entryErr } = await supabase
      .from("timetable_entries")
      .insert(entries);

    if (entryErr) {
      toast.error("Failed to save timetable entries: " + entryErr.message);
      await supabase.from("generated_timetables").delete().eq("id", tt.id);
      setSaving(false);
      return;
    }

    toast.success("Timetable saved as draft! Review and approve it below.");
    setSaving(false);
    setShowPreview(false);
    setGeneratedSlots([]);
    fetchData();
  }

  async function viewTimetable(id: string) {
    setViewTimetableId(id);
    setViewLoading(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("timetable_entries")
      .select("*, professor:profiles!timetable_entries_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)")
      .eq("timetable_id", id)
      .order("day_of_week")
      .order("start_time");

    if (data) setViewEntries(data);
    setViewLoading(false);
  }

  async function approveTimetable(timetableId: string) {
    setApproving(true);
    const supabase = createClient();

    const { data: entries } = await supabase
      .from("timetable_entries")
      .select("*")
      .eq("timetable_id", timetableId);

    if (!entries || entries.length === 0) {
      toast.error("No entries found for this timetable.");
      setApproving(false);
      return;
    }

    const tt = timetables.find((t) => t.id === timetableId);
    if (!tt) {
      toast.error("Timetable not found.");
      setApproving(false);
      return;
    }

    // Resolve professor IDs from emails (best-effort; null if not signed up yet)
    const uniqueEmails = [...new Set(entries.map((e) => e.professor_email))];
    const { data: profProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "professor")
      .in("email", uniqueEmails);

    const emailToId: Record<string, string | null> = {};
    for (const e of uniqueEmails) emailToId[e] = null;
    for (const p of profProfiles ?? []) {
      emailToId[p.email] = p.id;
    }

    const unresolved = uniqueEmails.filter((e) => !emailToId[e]);
    if (unresolved.length > 0) {
      toast.info(
        `${unresolved.length} professor(s) haven't signed up yet (${unresolved.join(", ")}). Events will appear in their dashboards once they create accounts.`
      );
    }

    // Generate recurring calendar_requests for each entry across the date range
    const sDate = new Date(tt.start_date);
    const eDate = new Date(tt.end_date);

    const calendarRows: Array<{
      professor_id: string | null;
      professor_email: string;
      title: string;
      description: string;
      student_group_id: string | null;
      classroom_id: string | null;
      event_date: string;
      start_time: string;
      end_time: string;
      status: string;
      reviewed_by: string;
    }> = [];

    for (const entry of entries) {
      const profId = emailToId[entry.professor_email] ?? null;

      const current = new Date(sDate);
      while (current <= eDate) {
        // JS getDay(): 0=Sun, 1=Mon... our day_of_week: 1=Mon...5=Fri
        const jsDay = current.getDay();
        if (jsDay === entry.day_of_week) {
          calendarRows.push({
            professor_id: profId,
            professor_email: entry.professor_email,
            title: `${entry.subject} (Timetable)`,
            description: `Auto-generated from timetable for ${tt.term}`,
            student_group_id: entry.student_group_id,
            classroom_id: entry.classroom_id,
            event_date: current.toISOString().split("T")[0],
            start_time: entry.start_time,
            end_time: entry.end_time,
            status: "approved",
            reviewed_by: profile.id,
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }

    if (calendarRows.length === 0) {
      toast.error("No calendar events to create for the given date range.");
      setApproving(false);
      return;
    }

    // Insert in batches of 100
    for (let i = 0; i < calendarRows.length; i += 100) {
      const batch = calendarRows.slice(i, i + 100);
      const { error } = await supabase.from("calendar_requests").insert(batch);
      if (error) {
        toast.error(`Failed to create calendar events (batch ${Math.floor(i / 100) + 1}): ${error.message}`);
        setApproving(false);
        return;
      }
    }

    // Mark timetable as approved
    await supabase
      .from("generated_timetables")
      .update({ status: "approved", approved_by: profile.id, updated_at: new Date().toISOString() })
      .eq("id", timetableId);

    toast.success(`Timetable approved! ${calendarRows.length} calendar events created.`);
    setApproving(false);
    setViewTimetableId(null);
    fetchData();
  }

  async function deleteTimetable(id: string) {
    if (!window.confirm("Delete this timetable? This will remove the timetable and all its entries (but not any already-approved calendar events).")) return;
    const supabase = createClient();
    const { error } = await supabase.from("generated_timetables").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Timetable deleted.");
    fetchData();
  }

  const subjectColorMap: Record<string, string> = {};
  let colorIdx = 0;
  function getSubjectColor(subject: string): string {
    if (!subjectColorMap[subject]) {
      subjectColorMap[subject] = SLOT_COLORS[colorIdx % SLOT_COLORS.length];
      colorIdx++;
    }
    return subjectColorMap[subject];
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const termAssignmentCount = profAssignments.filter((a) => a.term === selectedTerm).length;

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Timetable
          </CardTitle>
          <CardDescription>
            Automatically schedule classes based on professor assignments, student enrollments, classroom capacities, and credit hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profAssignments.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              No professor assignments uploaded yet. Go to <strong>Professor Assignments</strong> tab to upload a CSV first.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>
                    Term
                    <span className="text-red-500">*</span>
                  </Label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    required
                  >
                    <option value="">Select...</option>
                    {allTerms.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{termAssignmentCount} assignments</p>
                </div>
                <div className="space-y-2">
                  <Label>
                    Term Start Date
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input type="date" min={new Date().toISOString().split("T")[0]} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>
                    Term End Date
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input type="date" min={startDate || new Date().toISOString().split("T")[0]} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Max Hours/Day per Prof</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={maxHoursPerDay}
                    onChange={(e) => setMaxHoursPerDay(parseInt(e.target.value) || 4)}
                  />
                </div>
              </div>

              <Button
                onClick={generateTimetable}
                disabled={generating || !selectedTerm || !startDate || !endDate}
                className="gap-2"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Generate Timetable</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generated preview */}
      {showPreview && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Generated Timetable Preview</CardTitle>
                <CardDescription>{generatedSlots.length} class slots generated for {selectedTerm}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTimetable} disabled={saving || generatedSlots.length === 0} className="gap-2">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="h-4 w-4" /> Save as Draft</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {genErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {genErrors.length} scheduling issue(s)
                </p>
                {genErrors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-700">{err}</p>
                ))}
              </div>
            )}

            <WeeklyGrid slots={generatedSlots} getSubjectColor={getSubjectColor} />
          </CardContent>
        </Card>
      )}

      {/* Existing timetables */}
      {timetables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Saved Timetables
            </CardTitle>
            <CardDescription>{timetables.length} timetable(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timetables.map((tt) => (
              <div key={tt.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tt.term}</span>
                      <Badge
                        className={
                          tt.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : tt.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                        variant="outline"
                      >
                        {tt.status.charAt(0).toUpperCase() + tt.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tt.start_date} to {tt.end_date} · Max {tt.max_hours_per_day}h/day
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (expandedTimetable === tt.id) {
                          setExpandedTimetable(null);
                        } else {
                          setExpandedTimetable(tt.id);
                          viewTimetable(tt.id);
                        }
                      }}
                      className="gap-1"
                    >
                      {expandedTimetable === tt.id ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Hide</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> View</>
                      )}
                    </Button>
                    {tt.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => viewTimetable(tt.id).then(() => setViewTimetableId(tt.id))}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Review & Approve
                      </Button>
                    )}
                    {tt.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTimetable(tt.id)}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {expandedTimetable === tt.id && (
                  <div className="mt-3">
                    {viewLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <WeeklyGrid
                        slots={viewEntries.map((e) => ({
                          subject: e.subject,
                          professorEmail: e.professor_email,
                          professorName: e.professor?.full_name ?? e.professor_email,
                          studentGroupId: e.student_group_id ?? "",
                          studentGroupName: e.student_group?.name ?? "",
                          classroomId: e.classroom_id ?? "",
                          classroomName: e.classroom?.name ?? "",
                          dayOfWeek: e.day_of_week,
                          startTime: e.start_time,
                          endTime: e.end_time,
                        }))}
                        getSubjectColor={getSubjectColor}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Approve dialog */}
      <Dialog open={!!viewTimetableId} onOpenChange={(open) => { if (!open) setViewTimetableId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Timetable</DialogTitle>
            <DialogDescription>
              Review the weekly schedule below. Approving will create calendar events for every week in the date range.
            </DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <WeeklyGrid
                slots={viewEntries.map((e) => ({
                  subject: e.subject,
                  professorEmail: e.professor_email,
                  professorName: e.professor?.full_name ?? e.professor_email,
                  studentGroupId: e.student_group_id ?? "",
                  studentGroupName: e.student_group?.name ?? "",
                  classroomId: e.classroom_id ?? "",
                  classroomName: e.classroom?.name ?? "",
                  dayOfWeek: e.day_of_week,
                  startTime: e.start_time,
                  endTime: e.end_time,
                }))}
                getSubjectColor={getSubjectColor}
              />

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {viewEntries.length} weekly slots will repeat across the entire term date range.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setViewTimetableId(null)}>
                    Cancel
                  </Button>
                  {timetables.find((t) => t.id === viewTimetableId)?.status === "draft" && (
                    <Button
                      onClick={() => approveTimetable(viewTimetableId!)}
                      disabled={approving}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {approving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Approving...</>
                      ) : (
                        <><Check className="h-4 w-4" /> Approve & Create Events</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeeklyGrid({
  slots,
  getSubjectColor,
}: {
  slots: ScheduleSlot[];
  getSubjectColor: (subject: string) => string;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  function timeToRow(time: string): number {
    const [h] = time.split(":").map(Number);
    return h - HOUR_START;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b">
          <div className="p-2 text-xs text-muted-foreground font-medium">Time</div>
          {[1, 2, 3, 4, 5].map((d) => (
            <div key={d} className="p-2 text-xs font-medium text-center border-l">
              {DAY_NAMES[d]}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-[60px_repeat(5,1fr)] border-b min-h-[48px]">
              <div className="p-1 text-[10px] text-muted-foreground font-medium flex items-start justify-end pr-2 pt-1">
                {String(h).padStart(2, "0")}:00
              </div>
              {[1, 2, 3, 4, 5].map((d) => {
                const daySlots = slots.filter(
                  (s) => s.dayOfWeek === d && timeToRow(s.startTime) === h - HOUR_START
                );
                return (
                  <div key={d} className="border-l relative min-h-[48px] p-0.5">
                    {daySlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className={`rounded px-1.5 py-0.5 border text-[10px] leading-tight mb-0.5 ${getSubjectColor(slot.subject)}`}
                        title={`${slot.subject}\nProf. ${slot.professorName}\n${slot.classroomName}\n${slot.studentGroupName}\n${slot.startTime}–${slot.endTime}`}
                      >
                        <div className="font-semibold truncate">{slot.subject}</div>
                        <div className="truncate opacity-80">{slot.classroomName}</div>
                        <div className="truncate opacity-70">Prof. {slot.professorName.split(" ").pop()}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        {[...new Set(slots.map((s) => s.subject))].sort().map((subject) => (
          <span
            key={subject}
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${getSubjectColor(subject)}`}
          >
            {subject}
          </span>
        ))}
      </div>
    </div>
  );
}
