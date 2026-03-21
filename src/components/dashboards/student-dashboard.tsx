"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, CalendarRequest } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ClipboardList,
  CalendarDays,
  Clock,
  Filter,
  GraduationCap,
  ListTodo,
  MapPin,
  ScanFace,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { TaskTracker } from "@/components/task-tracker";
import { StudentCalendar } from "@/components/student-calendar";
import { AttendanceMarker } from "@/components/attendance-marker";

/** Local calendar day for an event (no UTC shift from date-only strings). */
function eventBaseLocalDate(e: CalendarRequest): Date | null {
  const dateOnly = String(e.event_date).split("T")[0];
  const [y, mo, d] = dateOnly.split("-").map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  return new Date(y, mo - 1, d);
}

function withTimeOnDate(base: Date, timeStr: string, fallback: string): Date {
  const t = timeStr?.trim() || fallback;
  const parts = t.split(":");
  const hh = parseInt(parts[0] ?? "0", 10);
  const mm = parseInt(parts[1] ?? "0", 10);
  const ss = parseInt(parts[2] ?? "0", 10);
  const out = new Date(base.getTime());
  out.setHours(hh, mm, ss, 0);
  return out;
}

function eventStartDateTime(e: CalendarRequest): Date {
  const b = eventBaseLocalDate(e);
  if (!b) return new Date(0);
  return withTimeOnDate(b, e.start_time, "00:00:00");
}

/** Local end instant (event_date + end_time). */
function eventEndDateTime(e: CalendarRequest): Date {
  const b = eventBaseLocalDate(e);
  if (!b) return new Date(0);
  return withTimeOnDate(b, e.end_time, "23:59:59");
}

/** Class is in session (between start and end, local time). */
function isEventOngoing(now: Date, e: CalendarRequest): boolean {
  const s = eventStartDateTime(e);
  const end = eventEndDateTime(e);
  return now >= s && now < end;
}

export function StudentDashboard({ profile }: { profile: Profile }) {
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentGroupIds, setStudentGroupIds] = useState<string[]>([]);
  const [studentGroupNames, setStudentGroupNames] = useState<string[]>([]);
  const [groupIdToName, setGroupIdToName] = useState<Record<string, string>>({});
  const [filterSubject, setFilterSubject] = useState("all");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  /** Tick so "Upcoming" → "Ongoing" updates without navigating away. */
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleOpenTabMenu() {
      setTabMenuOpen(true);
    }
    window.addEventListener("pal:open-tab-menu", handleOpenTabMenu);
    return () => window.removeEventListener("pal:open-tab-menu", handleOpenTabMenu);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      let groupIds: string[] = [];
      let groupNames: string[] = [];
      const idNameMap: Record<string, string> = {};

      // Strategy 1: Look up enrollments by email (most reliable — directly from CSV)
      const { data: enrollmentSubjects } = await supabase
        .from("student_enrollments")
        .select("subject")
        .eq("email", profile.email);

      if (enrollmentSubjects && enrollmentSubjects.length > 0) {
        const subjectNames = [...new Set(enrollmentSubjects.map((e) => e.subject))];
        const { data: groups } = await supabase
          .from("student_groups")
          .select("id, name")
          .in("name", subjectNames);

        if (groups && groups.length > 0) {
          groupIds = groups.map((g) => g.id);
          groupNames = groups.map((g) => g.name);
          for (const g of groups) idNameMap[g.id] = g.name;
        }
      }

      // Strategy 2: Check student_group_members join table
      if (groupIds.length === 0) {
        const { data: memberships } = await supabase
          .from("student_group_members")
          .select("group_id, student_group:student_groups(id, name)")
          .eq("student_id", profile.id);

        if (memberships && memberships.length > 0) {
          groupIds = memberships.map((m) => m.group_id);
          for (const m of memberships) {
            const sg = m.student_group as unknown as { id: string; name: string } | null;
            if (sg) {
              idNameMap[m.group_id] = sg.name;
              groupNames.push(sg.name);
            }
          }
        }
      }

      // Strategy 3: Legacy fallback — profiles.student_group
      if (groupIds.length === 0 && profile.student_group) {
        const { data: groupData } = await supabase
          .from("student_groups")
          .select("id, name")
          .eq("name", profile.student_group)
          .single();
        if (groupData) {
          groupIds = [groupData.id];
          groupNames = [groupData.name];
          idNameMap[groupData.id] = groupData.name;
        }
      }

      setGroupIdToName(idNameMap);
      setStudentGroupIds(groupIds);
      setStudentGroupNames(groupNames);

      if (groupIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch approved events via direct student_group_id
      const { data: directEvents } = await supabase
        .from("calendar_requests")
        .select(
          "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
        )
        .eq("status", "approved")
        .in("student_group_id", groupIds)
        .order("event_date", { ascending: true });

      // Also fetch events linked via the junction table (multi-group support)
      const { data: junctionLinks } = await supabase
        .from("calendar_request_groups")
        .select("calendar_request_id")
        .in("student_group_id", groupIds);

      const junctionIds = (junctionLinks ?? []).map((l) => l.calendar_request_id);
      const directIds = new Set((directEvents ?? []).map((e) => e.id));
      const extraIds = junctionIds.filter((id) => !directIds.has(id));

      let allEvents = directEvents ?? [];

      if (extraIds.length > 0) {
        const { data: extraEvents } = await supabase
          .from("calendar_requests")
          .select(
            "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
          )
          .eq("status", "approved")
          .in("id", extraIds)
          .order("event_date", { ascending: true });

        if (extraEvents) allEvents = [...allEvents, ...extraEvents];
      }

      allEvents.sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
      setEvents(allEvents);
      setLoading(false);
    }

    fetchEvents();
  }, [profile.id, profile.email, profile.student_group]);

  const filteredEvents =
    filterSubject === "all"
      ? events
      : events.filter((e) => e.student_group_id === filterSubject);

  const upcoming = filteredEvents.filter((e) => now < eventEndDateTime(e));
  const past = filteredEvents.filter((e) => now >= eventEndDateTime(e));

  const upcomingSorted = useMemo(() => {
    const list = [...upcoming];
    list.sort((a, b) => {
      const ao = isEventOngoing(now, a) ? 0 : 1;
      const bo = isEventOngoing(now, b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return eventStartDateTime(a).getTime() - eventStartDateTime(b).getTime();
    });
    return list;
  }, [upcoming, now]);

  const filteredGroupIds =
    filterSubject === "all" ? studentGroupIds : [filterSubject];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {greeting}, {profile.full_name}!
        </h1>
      </div>

      {!loading && studentGroupIds.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> You haven&apos;t been assigned to any
              student groups yet. Once your admin uploads the enrollment roster,
              your upcoming events will appear here. Contact your admin with
              your email: <strong>{profile.email}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="events" className="gap-1">
        {tabMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20"
              aria-hidden
              onClick={() => setTabMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] border-r bg-background p-4 shadow-2xl animate-in slide-in-from-left duration-200">
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Navigate</h2>
              <TabsList className="flex h-auto w-full flex-col items-stretch">
                <TabsTrigger
                  value="events"
                  className="w-full justify-start gap-1.5"
                  onClick={() => setTabMenuOpen(false)}
                >
                  <ClipboardList className="h-4 w-4" />
                  Events
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="w-full justify-start gap-1.5"
                  onClick={() => setTabMenuOpen(false)}
                >
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger
                  value="attendance"
                  className="w-full justify-start gap-1.5"
                  onClick={() => setTabMenuOpen(false)}
                >
                  <ScanFace className="h-4 w-4" />
                  Attendance
                </TabsTrigger>
                <TabsTrigger
                  value="tasks"
                  className="w-full justify-start gap-1.5"
                  onClick={() => setTabMenuOpen(false)}
                >
                  <ListTodo className="h-4 w-4" />
                  Task Tracker
                </TabsTrigger>
              </TabsList>
            </aside>
          </>
        )}

        <TabsList className="hidden">
          <TabsTrigger value="events" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5">
            <ScanFace className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            Task Tracker
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-3 space-y-4">
          {/* Subject filter */}
          {studentGroupIds.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground font-medium">Subject:</label>
                <select
                  className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="all">All Subjects</option>
                  {studentGroupIds.map((gid) => (
                    <option key={gid} value={gid}>
                      {groupIdToName[gid] ?? gid}
                    </option>
                  ))}
                </select>
              </div>
              {filterSubject !== "all" && (
                <button
                  onClick={() => setFilterSubject("all")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Upcoming & ongoing (not yet ended) */}
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming &amp; ongoing ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No upcoming or ongoing events scheduled for your group.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingSorted.map((event) => {
                  const ongoing = isEventOngoing(now, event);
                  return (
                  <Card
                    key={event.id}
                    className={`relative overflow-hidden border-l-4 ${
                      ongoing ? "border-l-blue-500" : "border-l-green-500"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        {ongoing ? (
                          <Badge
                            className="bg-blue-500/15 text-blue-800 border-blue-500/40 dark:text-blue-200"
                            variant="outline"
                          >
                            Ongoing
                          </Badge>
                        ) : (
                          <Badge className="bg-accent/15 text-accent-foreground" variant="outline">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                      {event.description && (
                        <CardDescription>{event.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        <span>
                          {format(new Date(event.event_date), "EEEE, MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {event.start_time.slice(0, 5)} -{" "}
                          {event.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{event.classroom?.name ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Prof. {event.professor?.full_name ?? "—"}</span>
                      </div>
                      {event.student_group?.name && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                            {event.student_group.name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Events */}
          {past.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-2 text-muted-foreground">
                Past Events ({past.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <Card key={event.id} className="opacity-60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        <span>
                          {format(new Date(event.event_date), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {event.start_time.slice(0, 5)} -{" "}
                          {event.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{event.classroom?.name ?? "—"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-3 space-y-4">
          {events.length > 0 && (
            <AttendanceMarker profile={profile} events={events} />
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-3">
          <TaskTracker studentId={profile.id} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-3 space-y-3">
          {/* Subject filter for calendar */}
          {studentGroupIds.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground font-medium">Subject:</label>
                <select
                  className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="all">All Subjects</option>
                  {studentGroupIds.map((gid) => (
                    <option key={gid} value={gid}>
                      {groupIdToName[gid] ?? gid}
                    </option>
                  ))}
                </select>
              </div>
              {filterSubject !== "all" && (
                <button
                  onClick={() => setFilterSubject("all")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {studentGroupIds.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">
                  <GraduationCap className="inline h-4 w-4 mr-1 align-text-bottom" />
                  No class groups yet — you&apos;ll see scheduled classes here once an admin assigns your roster.
                  Your personal tasks from the Task Tracker still appear below.
                </p>
              </CardContent>
            </Card>
          )}
          <StudentCalendar
            studentGroupIds={filteredGroupIds}
            studentId={profile.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
