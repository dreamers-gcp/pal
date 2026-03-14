"use client";

import { useEffect, useState } from "react";
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
  CalendarDays,
  Clock,
  Filter,
  GraduationCap,
  ListTodo,
  MapPin,
  User,
} from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";
import { TaskTracker } from "@/components/task-tracker";
import { StudentCalendar } from "@/components/student-calendar";

export function StudentDashboard({ profile }: { profile: Profile }) {
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentGroupIds, setStudentGroupIds] = useState<string[]>([]);
  const [studentGroupNames, setStudentGroupNames] = useState<string[]>([]);
  const [groupIdToName, setGroupIdToName] = useState<Record<string, string>>({});
  const [filterSubject, setFilterSubject] = useState("all");

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

      // Fetch approved events for all groups
      const { data } = await supabase
        .from("calendar_requests")
        .select(
          "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
        )
        .eq("status", "approved")
        .in("student_group_id", groupIds)
        .order("event_date", { ascending: true });

      if (data) setEvents(data);
      setLoading(false);
    }

    fetchEvents();
  }, [profile.id, profile.email, profile.student_group]);

  const today = startOfToday();

  const filteredEvents =
    filterSubject === "all"
      ? events
      : events.filter((e) => e.student_group_id === filterSubject);

  const upcoming = filteredEvents.filter(
    (e) => !isBefore(new Date(e.event_date), today)
  );
  const past = filteredEvents.filter((e) =>
    isBefore(new Date(e.event_date), today)
  );

  const filteredGroupIds =
    filterSubject === "all" ? studentGroupIds : [filterSubject];

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
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {profile.full_name}.
          {studentGroupNames.length > 0
            ? ` You belong to: ${studentGroupNames.join(", ")}.`
            : " Your groups haven't been assigned yet — contact your admin."}
        </p>
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

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            Task Tracker
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-6 space-y-6">
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

          {/* Upcoming Events */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming Events ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No upcoming events scheduled for your group.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <Card
                    key={event.id}
                    className="relative overflow-hidden border-l-4 border-l-green-500"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <Badge className="bg-green-100 text-green-800" variant="outline">
                          Upcoming
                        </Badge>
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
                ))}
              </div>
            )}
          </div>

          {/* Past Events */}
          {past.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-muted-foreground">
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

        <TabsContent value="tasks" className="mt-6">
          <TaskTracker studentId={profile.id} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6 space-y-4">
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

          {studentGroupIds.length > 0 ? (
            <StudentCalendar studentGroupIds={filteredGroupIds} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Your groups haven&apos;t been assigned yet. Calendar will appear once an admin uploads the roster.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
