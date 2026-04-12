"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MapPin,
  BookOpen,
  Users,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { CalendarRequest, Profile, AttendanceRecord } from "@/lib/types";
import {
  decodeCalendarRequestSubjects,
  eventMatchesAttendanceSubjectFilter,
  uniqueAttendanceSubjectLabels,
} from "@/lib/calendar-request-subject";
import { AttendanceViewSkeleton } from "@/components/ui/loading-skeletons";

interface Props {
  profile: Profile;
}

interface EventAttendanceInfo {
  event: CalendarRequest;
  records: (AttendanceRecord & { student?: Profile })[];
  enrolledStudents: Profile[];
}

type CalendarRequestWithGroups = CalendarRequest & {
  student_groups?: { student_group?: { id: string } | null }[] | null;
};

function groupIdsForCalendarEvent(e: CalendarRequestWithGroups): string[] {
  const ids = new Set<string>();
  if (e.student_group_id) ids.add(e.student_group_id);
  for (const row of e.student_groups ?? []) {
    const id = row?.student_group?.id;
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export function AttendanceView({ profile }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<EventAttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overridingKey, setOverridingKey] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<
    "all" | "today" | "upcoming" | "past" | "low-attendance"
  >("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const fetchData = useCallback(async () => {
    const { data: events } = await supabase
      .from("calendar_requests")
      .select(
        "*, student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(id))"
      )
      .eq("status", "approved")
      .or(`professor_id.eq.${profile.id},professor_email.eq.${profile.email}`)
      .order("event_date", { ascending: false })
      .limit(50);

    if (!events || events.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const eventIds = events.map((e) => e.id);
    const { data: records } = await supabase
      .from("attendance_records")
      .select("*, student:profiles!attendance_records_student_id_fkey(*)")
      .in("event_id", eventIds);

    const recordsByEvent: Record<string, (AttendanceRecord & { student?: Profile })[]> = {};
    for (const r of records ?? []) {
      if (!recordsByEvent[r.event_id]) recordsByEvent[r.event_id] = [];
      recordsByEvent[r.event_id].push(r);
    }

    const allGroupIds = [
      ...new Set(
        events.flatMap((e) =>
          groupIdsForCalendarEvent(e as CalendarRequestWithGroups)
        )
      ),
    ];

    type MemberRow = { group_id: string; student?: Profile | null };
    let members: MemberRow[] = [];
    if (allGroupIds.length > 0) {
      const { data: m } = await supabase
        .from("student_group_members")
        .select("group_id, student:profiles!student_group_members_student_id_fkey(*)")
        .in("group_id", allGroupIds);
      members = (m ?? []) as unknown as MemberRow[];
    }

    function enrolledForEvent(ev: CalendarRequestWithGroups): Profile[] {
      const gids = new Set(groupIdsForCalendarEvent(ev));
      const seen = new Set<string>();
      const out: Profile[] = [];
      for (const row of members) {
        if (!gids.has(row.group_id)) continue;
        const student = row.student;
        if (!student || seen.has(student.id)) continue;
        seen.add(student.id);
        out.push(student);
      }
      return out;
    }

    const infos: EventAttendanceInfo[] = events.map((e) => ({
      event: e as CalendarRequest,
      records: recordsByEvent[e.id] ?? [],
      enrolledStudents: enrolledForEvent(e as CalendarRequestWithGroups),
    }));

    setData(infos);
    setLoading(false);
  }, [profile.id, profile.email, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function setStudentAttendance(
    event: CalendarRequest,
    student: Profile,
    present: boolean
  ) {
    const key = `${event.id}:${student.id}`;
    setOverridingKey(key);

    try {
      if (present) {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(
            {
              student_id: student.id,
              event_id: event.id,
              photo_path: `manual-override/${event.id}/${student.id}`,
              similarity_score: 1,
              verified: true,
              marked_at: new Date().toISOString(),
            },
            { onConflict: "student_id,event_id" }
          );
        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(
            {
              student_id: student.id,
              event_id: event.id,
              photo_path: `manual-override-absent/${event.id}/${student.id}`,
              similarity_score: 0,
              verified: false,
              marked_at: new Date().toISOString(),
            },
            { onConflict: "student_id,event_id" }
          );
        if (error) {
          throw new Error(error.message);
        }
      }

      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update attendance";
      console.error(msg);
    } finally {
      setOverridingKey(null);
    }
  }

  const subjectOptions = useMemo(
    () => uniqueAttendanceSubjectLabels(data.map((d) => d.event)),
    [data]
  );

  const filteredData = useMemo(() => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");

    return data.filter(({ event, records, enrolledStudents }) => {
      const eventDate = event.event_date;
      const total = enrolledStudents.length;
      const attended = enrolledStudents.filter((s) =>
        records.some((r) => r.student_id === s.id && r.verified)
      ).length;
      const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

      if (!eventMatchesAttendanceSubjectFilter(event, subjectFilter)) return false;

      if (quickFilter === "today") return eventDate === today;
      if (quickFilter === "upcoming") return eventDate > today;
      if (quickFilter === "past") return eventDate < today;
      if (quickFilter === "low-attendance") return total > 0 && pct < 75;

      return true;
    });
  }, [data, quickFilter, subjectFilter]);

  if (loading) {
    return (
      <div className="py-2">
        <span className="sr-only">
          Loading attendance. Getting your recent classes and attendance records.
        </span>
        <AttendanceViewSkeleton />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No class events found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {[
            { id: "all", label: "All" },
            { id: "today", label: "Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past" },
            { id: "low-attendance", label: "Low attendance" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setQuickFilter(f.id as typeof quickFilter)}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                quickFilter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            className="ml-auto h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="all">All subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredData.map(({ event, records, enrolledStudents }) => {
        const isExpanded = expanded === event.id;
        const recordByStudent = new Map(records.map((r) => [r.student_id, r]));
        const attendedCount = enrolledStudents.filter(
          (s) => recordByStudent.get(s.id)?.verified === true
        ).length;
        const totalStudents = enrolledStudents.length;
        const pct = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;

        return (
          <Card
            key={event.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setExpanded(isExpanded ? null : event.id)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">
                    {event.title}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      pct >= 75
                        ? "bg-accent/15 text-accent-foreground border-accent/30"
                        : pct >= 50
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                    }
                  >
                    {attendedCount}/{totalStudents} ({pct}%)
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.classroom?.name ?? "—"}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {decodeCalendarRequestSubjects(event.subject).join(", ") || "—"}
                </span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="border-t pt-3 space-y-1">
                  {enrolledStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No enrolled students found for this class.
                    </p>
                  ) : (
                    [...enrolledStudents]
                      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
                      .map((student) => {
                        const record = recordByStudent.get(student.id);
                        const present = record?.verified === true;
                        const key = `${event.id}:${student.id}`;
                        const busy = overridingKey === key;
                        return (
                          <div
                            key={student.id}
                            className="flex items-center justify-between gap-3 text-base py-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {present ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <span className="truncate">{student.full_name || student.email}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={
                                  present
                                    ? "bg-accent/15 text-accent-foreground border-accent/30"
                                    : "bg-destructive/10 text-destructive border-destructive/30"
                                }
                              >
                                {present ? "Present" : "Absent"}
                              </Badge>
                              {present ? (
                                <button
                                  type="button"
                                  className="text-sm underline text-muted-foreground hover:text-foreground disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => setStudentAttendance(event, student, false)}
                                >
                                  Mark Absent
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="text-sm underline text-primary hover:text-primary/80 disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => setStudentAttendance(event, student, true)}
                                >
                                  Mark Present
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
      {filteredData.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No classes match the selected filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
