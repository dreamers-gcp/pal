"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  RequestStatus,
  StudentGroup,
  StudentEnrollment,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Clock,
  HelpCircle,
  LayoutList,
  MapPin,
  Users,
  X,
  User,
  Inbox,
  GraduationCap,
  Mail,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { BookedSchedule } from "@/components/booked-schedule";
import { CsvUpload } from "@/components/csv-upload";
import { ProfessorCsvUpload } from "@/components/professor-csv-upload";
import { TimetableGenerator } from "@/components/timetable-generator";
import { FileSpreadsheet, Filter, BookOpen, Wand2 } from "lucide-react";
import type { ProfessorAssignment } from "@/lib/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  clarification_needed: "bg-blue-100 text-blue-800",
};

export function AdminDashboard({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<CalendarRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const [students, setStudents] = useState<Profile[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);

  const [profAssignments, setProfAssignments] = useState<ProfessorAssignment[]>([]);
  const [profLoading, setProfLoading] = useState(true);

  const [filterTerm, setFilterTerm] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [profFilterTerm, setProfFilterTerm] = useState("all");
  const [profFilterSubject, setProfFilterSubject] = useState("all");

  const fetchRequests = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
      )
      .order("created_at", { ascending: false });

    if (data) {
      // Transform the data to extract student_groups from the junction table
      const transformedData = data.map((req: any) => ({
        ...req,
        student_groups: req.student_groups?.map((sg: any) => sg.student_group) || [],
      }));
      setRequests(transformedData);
    }
    setLoading(false);
  }, []);

  const fetchStudents = useCallback(async () => {
    const supabase = createClient();
    const [studRes, groupRes, enrollRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .order("full_name"),
      supabase.from("student_groups").select("*").order("name"),
      supabase.from("student_enrollments").select("*").order("email"),
    ]);

    if (studRes.data) setStudents(studRes.data);
    if (groupRes.data) setStudentGroups(groupRes.data);
    if (enrollRes.data) setEnrollments(enrollRes.data);
    setStudentsLoading(false);
  }, []);

  const fetchProfAssignments = useCallback(async () => {
    const supabase = createClient();
    const [paRes, profRes] = await Promise.all([
      supabase.from("professor_assignments").select("*").order("email"),
      supabase.from("profiles").select("*").eq("role", "professor").order("full_name"),
    ]);
    if (paRes.data) setProfAssignments(paRes.data);
    setProfLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    fetchProfAssignments();
  }, [fetchRequests, fetchStudents, fetchProfAssignments]);

  async function updateRequest(id: string, status: RequestStatus) {
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("calendar_requests")
      .update({
        status,
        admin_note: adminNote || null,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      const label =
        status === "approved"
          ? "approved"
          : status === "rejected"
          ? "rejected"
          : "sent back for clarification";
      toast.success(`Request ${label}`);
    }

    setUpdating(false);
    setSelectedRequest(null);
    setAdminNote("");
    fetchRequests();
    setCalendarKey((k) => k + 1);
  }

  const filterByStatus = (status: string) =>
    status === "all"
      ? requests
      : requests.filter((r) => r.status === status);

  const allTerms = [...new Set(enrollments.map((e) => e.term))].sort();
  const allSubjects = [...new Set(enrollments.map((e) => e.subject))].sort();

  const filteredEmailsSet: Set<string> | null = (() => {
    if (filterTerm === "all" && filterSubject === "all") return null;
    return new Set(
      enrollments
        .filter((e) => {
          if (filterTerm !== "all" && e.term !== filterTerm) return false;
          if (filterSubject !== "all" && e.subject !== filterSubject) return false;
          return true;
        })
        .map((e) => e.email)
    );
  })();

  const signedUpEmails = new Set(students.map((s) => s.email));

  // Build a unified roster: all unique emails from enrollments + any signed-up students not in enrollments
  const rosterMap = new Map<string, { name: string; email: string; subjects: string[]; signedUp: boolean }>();
  for (const e of enrollments) {
    const existing = rosterMap.get(e.email);
    if (existing) {
      if (!existing.subjects.includes(e.subject)) existing.subjects.push(e.subject);
    } else {
      rosterMap.set(e.email, {
        name: e.student_name,
        email: e.email,
        subjects: [e.subject],
        signedUp: signedUpEmails.has(e.email),
      });
    }
  }
  // Add signed-up students who are NOT in enrollment CSV
  for (const s of students) {
    if (!rosterMap.has(s.email)) {
      rosterMap.set(s.email, {
        name: s.full_name || s.email,
        email: s.email,
        subjects: s.student_group ? [s.student_group] : [],
        signedUp: true,
      });
    }
  }

  const fullRoster = [...rosterMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const filteredRoster = filteredEmailsSet
    ? fullRoster.filter((r) => filteredEmailsSet.has(r.email))
    : fullRoster;

  const signedUpCount = fullRoster.filter((r) => r.signedUp).length;
  const notSignedUpCount = fullRoster.filter((r) => !r.signedUp).length;

  // Professor roster
  const profTerms = [...new Set(profAssignments.map((a) => a.term))].sort();
  const profSubjects = [...new Set(profAssignments.map((a) => a.subject))].sort();

  const signedUpProfEmails = new Set(
    students.length > 0 ? [] : [] // we'll get professors from a separate query
  );

  const profRosterMap = new Map<string, { name: string; email: string; subjects: string[]; terms: string[]; totalCredits: number; signedUp: boolean }>();
  for (const a of profAssignments) {
    const existing = profRosterMap.get(a.email);
    if (existing) {
      if (!existing.subjects.includes(a.subject)) existing.subjects.push(a.subject);
      if (!existing.terms.includes(a.term)) existing.terms.push(a.term);
      existing.totalCredits += a.credits;
    } else {
      profRosterMap.set(a.email, {
        name: a.professor_name,
        email: a.email,
        subjects: [a.subject],
        terms: [a.term],
        totalCredits: a.credits,
        signedUp: false,
      });
    }
  }

  const filteredProfEmailsSet: Set<string> | null = (() => {
    if (profFilterTerm === "all" && profFilterSubject === "all") return null;
    return new Set(
      profAssignments
        .filter((a) => {
          if (profFilterTerm !== "all" && a.term !== profFilterTerm) return false;
          if (profFilterSubject !== "all" && a.subject !== profFilterSubject) return false;
          return true;
        })
        .map((a) => a.email)
    );
  })();

  const fullProfRoster = [...profRosterMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const filteredProfRoster = filteredProfEmailsSet
    ? fullProfRoster.filter((r) => filteredProfEmailsSet.has(r.email))
    : fullProfRoster;

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
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {profile.full_name}. Review requests and manage students.
        </p>
      </div>

      {/* Top-level tabs: Requests vs Students */}
      <Tabs
        defaultValue="requests"
        onValueChange={(tab) => {
          if (tab === "booked-schedule") setCalendarKey((k) => k + 1);
          if (tab === "requests") fetchRequests();
          if (tab === "professors" || tab === "prof-assignments") fetchProfAssignments();
        }}
      >
        <TabsList>
          <TabsTrigger value="requests" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar Requests
          </TabsTrigger>
          <TabsTrigger value="booked-schedule" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Classroom Availability
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Enrollments
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Manage Students
            {notSignedUpCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white font-bold">
                {notSignedUpCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="prof-assignments" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Professor Assignments
          </TabsTrigger>
          <TabsTrigger value="professors" className="gap-1.5">
            <Users className="h-4 w-4" />
            Manage Professors
          </TabsTrigger>
          <TabsTrigger value="timetable" className="gap-1.5">
            <Wand2 className="h-4 w-4" />
            Timetable
          </TabsTrigger>
        </TabsList>

        {/* ========== REQUESTS TAB ========== */}
        <TabsContent value="requests" className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                label: "Pending",
                count: filterByStatus("pending").length,
                color: "text-yellow-600",
              },
              {
                label: "Approved",
                count: filterByStatus("approved").length,
                color: "text-green-600",
              },
              {
                label: "Rejected",
                count: filterByStatus("rejected").length,
                color: "text-red-600",
              },
              {
                label: "Needs Clarification",
                count: filterByStatus("clarification_needed").length,
                color: "text-blue-600",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>
                    {stat.count}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending ({filterByStatus("pending").length})
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="clarification_needed">
                Clarification
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            {[
              "pending",
              "approved",
              "rejected",
              "clarification_needed",
              "all",
            ].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                {filterByStatus(tab).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No requests here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filterByStatus(tab).map((req) => (
                      <Card
                        key={req.id}
                        className="cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
                        onClick={() => {
                          setSelectedRequest(req);
                          setAdminNote(req.admin_note ?? "");
                        }}
                      >
                        <div
                          className={`absolute top-0 left-0 right-0 h-1 ${
                            req.status === "approved"
                              ? "bg-green-500"
                              : req.status === "rejected"
                              ? "bg-red-500"
                              : req.status === "clarification_needed"
                              ? "bg-blue-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg">
                              {req.title}
                            </CardTitle>
                            <Badge
                              className={statusColors[req.status]}
                              variant="outline"
                            >
                              {req.status === "clarification_needed"
                                ? "Clarification"
                                : req.status.charAt(0).toUpperCase() +
                                  req.status.slice(1)}
                            </Badge>
                          </div>
                          {req.description && (
                            <CardDescription>{req.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>
                              {req.professor?.full_name ?? req.professor_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            <span>
                              {format(
                                new Date(req.event_date),
                                "MMM d, yyyy"
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              {req.start_time.slice(0, 5)} -{" "}
                              {req.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>
                              {req.student_groups && req.student_groups.length > 0
                                ? req.student_groups.map((sg) => sg.name).join(", ")
                                : req.student_group?.name ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{req.classroom?.name ?? "—"}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ========== BOOKED SCHEDULE TAB ========== */}
        <TabsContent value="booked-schedule" className="mt-6">
          <BookedSchedule
            showAllStatuses
            refreshKey={calendarKey}
            onEventClick={(event) => {
              setSelectedRequest(event);
              setAdminNote(event.admin_note ?? "");
            }}
          />
        </TabsContent>

        {/* ========== ENROLLMENTS TAB ========== */}
        <TabsContent value="enrollments" className="mt-6">
          <CsvUpload />
        </TabsContent>

        {/* ========== STUDENTS TAB ========== */}
        <TabsContent value="students" className="mt-6 space-y-6">
          {studentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-pulse text-muted-foreground">
                Loading students...
              </div>
            </div>
          ) : fullRoster.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No students found. Upload an enrollment CSV in the Enrollments tab to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Total in Roster
                    </p>
                    <p className="text-3xl font-bold">{fullRoster.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Signed Up</p>
                    <p className="text-3xl font-bold text-green-600">
                      {signedUpCount}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Not Signed Up</p>
                    <p className="text-3xl font-bold text-amber-600">
                      {notSignedUpCount}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              {enrollments.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground font-medium">Term:</label>
                    <select
                      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                    >
                      <option value="all">All Terms</option>
                      {allTerms.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground font-medium">Subject:</label>
                    <select
                      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                    >
                      <option value="all">All Subjects</option>
                      {allSubjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {(filterTerm !== "all" || filterSubject !== "all") && (
                    <button
                      onClick={() => { setFilterTerm("all"); setFilterSubject("all"); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                  {filteredEmailsSet && (
                    <span className="text-xs text-muted-foreground">
                      Showing {filteredRoster.length} of {fullRoster.length} students
                    </span>
                  )}
                </div>
              )}

              {/* Student roster list */}
              <div className="rounded-lg border bg-white">
                <div className="grid grid-cols-[1fr_1.2fr_1.5fr_100px] gap-4 px-4 py-3 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Subjects / Groups</span>
                  <span className="text-center">Status</span>
                </div>
                {filteredRoster.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No students match the selected filters.
                  </div>
                ) : (
                  filteredRoster.map((entry) => (
                    <div
                      key={entry.email}
                      className="grid grid-cols-[1fr_1.2fr_1.5fr_100px] gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {entry.email}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.subjects.length > 0 ? (
                          entry.subjects.map((subj) => (
                            <span
                              key={subj}
                              className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                            >
                              {subj}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No groups</span>
                        )}
                      </div>
                      <div className="flex justify-center">
                        {entry.signedUp ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                            <Check className="h-3 w-3" />
                            Signed up
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 px-2.5 py-0.5 text-xs font-medium">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </TabsContent>
        {/* ========== PROFESSOR ASSIGNMENTS TAB ========== */}
        <TabsContent value="prof-assignments" className="mt-6">
          <ProfessorCsvUpload />
        </TabsContent>

        {/* ========== MANAGE PROFESSORS TAB ========== */}
        <TabsContent value="professors" className="mt-6 space-y-6">
          {profLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading professors...</div>
            </div>
          ) : fullProfRoster.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No professor assignments found. Upload a CSV in the Professor Assignments tab to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Professors</p>
                    <p className="text-3xl font-bold">{fullProfRoster.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Subjects</p>
                    <p className="text-3xl font-bold text-purple-600">{profSubjects.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Terms</p>
                    <p className="text-3xl font-bold text-blue-600">{profTerms.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground font-medium">Term:</label>
                  <select
                    className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={profFilterTerm}
                    onChange={(e) => setProfFilterTerm(e.target.value)}
                  >
                    <option value="all">All Terms</option>
                    {profTerms.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground font-medium">Subject:</label>
                  <select
                    className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={profFilterSubject}
                    onChange={(e) => setProfFilterSubject(e.target.value)}
                  >
                    <option value="all">All Subjects</option>
                    {profSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(profFilterTerm !== "all" || profFilterSubject !== "all") && (
                  <button
                    onClick={() => { setProfFilterTerm("all"); setProfFilterSubject("all"); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
                {filteredProfEmailsSet && (
                  <span className="text-xs text-muted-foreground">
                    Showing {filteredProfRoster.length} of {fullProfRoster.length} professors
                  </span>
                )}
              </div>

              {/* Professor roster list */}
              <div className="rounded-lg border bg-white">
                <div className="grid grid-cols-[1fr_1.2fr_1.5fr_0.5fr] gap-4 px-4 py-3 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Subjects</span>
                  <span className="text-right">Total Credits</span>
                </div>
                {filteredProfRoster.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No professors match the selected filters.
                  </div>
                ) : (
                  filteredProfRoster.map((entry) => (
                    <div
                      key={entry.email}
                      className="grid grid-cols-[1fr_1.2fr_1.5fr_0.5fr] gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">{entry.email}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.subjects.map((subj) => (
                          <span
                            key={subj}
                            className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium"
                          >
                            {subj}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-medium text-right">{entry.totalCredits}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ========== TIMETABLE TAB ========== */}
        <TabsContent value="timetable" className="mt-6">
          <TimetableGenerator profile={profile} />
        </TabsContent>
      </Tabs>

      {/* Review dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setAdminNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRequest.title}</DialogTitle>
                <DialogDescription>
                  Submitted by{" "}
                  <strong>
                    {selectedRequest.professor?.full_name ??
                      selectedRequest.professor_id}
                  </strong>{" "}
                  on{" "}
                  {format(
                    new Date(selectedRequest.created_at),
                    "MMM d, yyyy"
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                {selectedRequest.description && (
                  <div className="border-b pb-3">
                    <p className="font-medium mb-1">Description</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.description}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-medium">Date</p>
                    <p className="text-muted-foreground">
                      {format(
                        new Date(selectedRequest.event_date),
                        "EEEE, MMM d, yyyy"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Time</p>
                    <p className="text-muted-foreground">
                      {selectedRequest.start_time.slice(0, 5)} -{" "}
                      {selectedRequest.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Student Group(s)</p>
                    <p className="text-muted-foreground">
                      {selectedRequest.student_groups && selectedRequest.student_groups.length > 0
                        ? selectedRequest.student_groups.map((sg) => sg.name).join(", ")
                        : selectedRequest.student_group?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Classroom</p>
                    <p className="text-muted-foreground">
                      {selectedRequest.classroom?.name ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Admin Note (optional)</Label>
                  <Textarea
                    placeholder="Add a note for the professor..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() =>
                    updateRequest(selectedRequest.id, "approved")
                  }
                  disabled={updating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  onClick={() =>
                    updateRequest(selectedRequest.id, "rejected")
                  }
                  disabled={updating}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() =>
                    updateRequest(
                      selectedRequest.id,
                      "clarification_needed"
                    )
                  }
                  disabled={updating}
                  variant="outline"
                  className="flex-1"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Clarify
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

