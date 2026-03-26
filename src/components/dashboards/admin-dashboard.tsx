"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  RequestStatus,
  StudentGroup,
  StudentEnrollment,
  Classroom,
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ClipboardList,
  CalendarDays,
  Check,
  Clock,
  HelpCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { RequestCalendar } from "@/components/request-calendar";
import { RequestCard } from "@/components/request-card";
import { CsvUpload } from "@/components/csv-upload";
import { toTitleCase } from "@/lib/utils";
import { ProfessorCsvUpload } from "@/components/professor-csv-upload";
import { TimetableGenerator } from "@/components/timetable-generator";
import { FileSpreadsheet, Filter, BookOpen, Wand2 } from "lucide-react";
import type { ProfessorAssignment } from "@/lib/types";
import { coerceCredits, formatCreditsDisplay } from "@/lib/credits-parse";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-accent/15 text-accent-foreground",
  rejected: "bg-destructive/10 text-destructive",
  clarification_needed: "bg-primary/10 text-primary",
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

  const [profAssignments, setProfAssignments] = useState<ProfessorAssignment[]>([]);
  const [profLoading, setProfLoading] = useState(true);

  const [filterTerm, setFilterTerm] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [profFilterTerm, setProfFilterTerm] = useState("all");
  const [profFilterSubject, setProfFilterSubject] = useState("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "clarification_needed" | "all"
  >("pending");

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [calendarClassroomFilter, setCalendarClassroomFilter] = useState<string>("");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);

  useEffect(() => {
    function handleOpenTabMenu() {
      setTabMenuOpen(true);
    }
    window.addEventListener("pal:open-tab-menu", handleOpenTabMenu);
    return () => window.removeEventListener("pal:open-tab-menu", handleOpenTabMenu);
  }, []);

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
    if (paRes.data) {
      setProfAssignments(
        paRes.data.map((a) => ({
          ...a,
          credits: coerceCredits(a.credits),
        }))
      );
    }
    setProfLoading(false);
  }, []);

  const fetchClassrooms = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("classrooms").select("*").order("name");
    if (data) setClassrooms(data);
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    fetchProfAssignments();
    fetchClassrooms();
  }, [fetchRequests, fetchStudents, fetchProfAssignments, fetchClassrooms]);

  async function updateRequest(
    id: string,
    status: RequestStatus,
    adminNoteOverride?: string
  ) {
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("calendar_requests")
      .update({
        status,
        admin_note: (adminNoteOverride ?? adminNote) || null,
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
  }

  function CalendarEventActions({
    request,
    closeSidebar,
  }: {
    request: CalendarRequest;
    closeSidebar: () => void;
  }) {
    const [sidebarNote, setSidebarNote] = useState(request.admin_note ?? "");

    const submitFromSidebar = async (status: RequestStatus) => {
      await updateRequest(request.id, status, sidebarNote);
      closeSidebar();
    };

    return (
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Review request
        </p>
        <div className="space-y-2">
          <Label
            htmlFor={`calendar-admin-note-${request.id}`}
            className="text-sm font-medium text-foreground"
          >
            Admin note (optional)
          </Label>
          <Textarea
            id={`calendar-admin-note-${request.id}`}
            placeholder="Add a note for the professor..."
            value={sidebarNote}
            onChange={(e) => setSidebarNote(e.target.value)}
            rows={3}
            className="resize-none rounded-lg border-muted-foreground/30 bg-muted/30 focus-visible:ring-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => submitFromSidebar("approved")}
            disabled={updating}
            variant="outline"
            size="sm"
            className="flex-1 min-w-[100px] rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:border-emerald-500 dark:text-emerald-400 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25"
          >
            <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Approve
          </Button>
          <Button
            onClick={() => submitFromSidebar("rejected")}
            disabled={updating}
            variant="outline"
            size="sm"
            className="flex-1 min-w-[100px] rounded-full border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive"
          >
            <X className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Reject
          </Button>
          <Button
            onClick={() => submitFromSidebar("clarification_needed")}
            disabled={updating}
            variant="outline"
            size="sm"
            className="flex-1 min-w-[100px] rounded-full border-muted-foreground/40 bg-muted/30 text-muted-foreground hover:bg-muted/50"
          >
            <HelpCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Clarify
          </Button>
        </div>
      </div>
    );
  }

  const filterByStatus = (status: string) =>
    status === "all"
      ? requests
      : requests.filter((r) => r.status === status);

  const calendarBookings = useMemo(() => {
    if (!calendarClassroomFilter) return requests;
    return requests.filter((r) => r.classroom_id === calendarClassroomFilter);
  }, [requests, calendarClassroomFilter]);

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
        name: a.professor,
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
          if (tab === "requests") fetchRequests();
          if (tab === "professors" || tab === "prof-assignments") fetchProfAssignments();
        }}
      >
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
                <TabsTrigger value="requests" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <ClipboardList className="h-4 w-4" />
                  Calendar Requests
                </TabsTrigger>
                <TabsTrigger value="calendar" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="enrollments" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Enrollments
                </TabsTrigger>
                <TabsTrigger value="students" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <GraduationCap className="h-4 w-4" />
                  Manage Students
                  {notSignedUpCount > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white font-bold">
                      {notSignedUpCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="prof-assignments" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <BookOpen className="h-4 w-4" />
                  Professor Assignments
                </TabsTrigger>
                <TabsTrigger value="professors" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <Users className="h-4 w-4" />
                  Manage Professors
                </TabsTrigger>
                <TabsTrigger value="timetable" className="w-full justify-start gap-1.5" onClick={() => setTabMenuOpen(false)}>
                  <Wand2 className="h-4 w-4" />
                  Timetable
                </TabsTrigger>
              </TabsList>
            </aside>
          </>
        )}
        <TabsList className="hidden">
          <TabsTrigger value="requests" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Calendar Requests
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Enrollments
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Manage Students
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
          {/* Compact request stats + filter chips */}
          <div className="rounded-xl border bg-muted/25 p-2.5">
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  label: "Pending",
                  count: filterByStatus("pending").length,
                  color: "text-yellow-700",
                  chip: "bg-yellow-100",
                },
                {
                  label: "Approved",
                  count: filterByStatus("approved").length,
                  color: "text-accent-foreground",
                  chip: "bg-accent/20",
                },
                {
                  label: "Rejected",
                  count: filterByStatus("rejected").length,
                  color: "text-destructive",
                  chip: "bg-destructive/10",
                },
                {
                  label: "Clarification",
                  count: filterByStatus("clarification_needed").length,
                  color: "text-primary",
                  chip: "bg-primary/10",
                  value: "clarification_needed",
                },
              ].map((stat) => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={() =>
                    setRequestStatusFilter(
                      (stat.value ??
                        stat.label.toLowerCase()) as
                        | "pending"
                        | "approved"
                        | "rejected"
                        | "clarification_needed"
                        | "all"
                    )
                  }
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                    requestStatusFilter ===
                    ((stat.value ??
                      stat.label.toLowerCase()) as
                      | "pending"
                      | "approved"
                      | "rejected"
                      | "clarification_needed"
                      | "all")
                      ? "border-primary/50 bg-primary/5"
                      : "bg-background hover:bg-muted/40"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span
                    className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}
                  >
                    {stat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {filterByStatus(requestStatusFilter).length === 0 ? (
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
              {filterByStatus(requestStatusFilter).map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  showProfessor
                  onClick={() => {
                    setSelectedRequest(req);
                    setAdminNote(req.admin_note ?? "");
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== CALENDAR TAB ========== */}
        <TabsContent value="calendar" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Classroom:</span>
            <Select
              value={calendarClassroomFilter || "all"}
              onValueChange={(v) => setCalendarClassroomFilter(v === "all" || !v ? "" : v)}
            >
              <SelectTrigger className="w-full sm:max-w-[220px] rounded-lg">
                <span className="truncate">
                  {!calendarClassroomFilter
                    ? "All classrooms"
                    : toTitleCase(
                        classrooms.find((c) => c.id === calendarClassroomFilter)?.name ?? ""
                      ) || "Select classroom"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classrooms</SelectItem>
                {classrooms.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {toTitleCase(c.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RequestCalendar
            bookings={calendarBookings}
            loading={loading}
            colorBy="status"
            alwaysShowCalendar
            emptyMessage={
              calendarClassroomFilter
                ? "No requests for this classroom."
                : "No calendar requests yet."
            }
            eventDetailActions={(request, closeSidebar) => (
              <CalendarEventActions
                key={request.id}
                request={request}
                closeSidebar={closeSidebar}
              />
            )}
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
              {/* Compact summary strip */}
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Total in Roster",
                      count: fullRoster.length,
                      color: "text-foreground",
                      chip: "bg-muted",
                    },
                    {
                      label: "Signed Up",
                      count: signedUpCount,
                      color: "text-accent-foreground",
                      chip: "bg-accent/20",
                    },
                    {
                      label: "Not Signed Up",
                      count: notSignedUpCount,
                      color: "text-amber-700",
                      chip: "bg-amber-100",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span
                        className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}
                      >
                        {stat.count}
                      </span>
                    </div>
                  ))}
                </div>
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent-foreground px-2.5 py-0.5 text-xs font-medium">
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
              {/* Compact summary strip */}
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Total Professors",
                      count: fullProfRoster.length,
                      color: "text-foreground",
                      chip: "bg-muted",
                    },
                    {
                      label: "Subjects",
                      count: profSubjects.length,
                      color: "text-purple-700",
                      chip: "bg-purple-100",
                    },
                    {
                      label: "Terms",
                      count: profTerms.length,
                      color: "text-primary",
                      chip: "bg-primary/10",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span
                        className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}
                      >
                        {stat.count}
                      </span>
                    </div>
                  ))}
                </div>
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
                      <div className="text-sm font-medium text-right">
                        {formatCreditsDisplay(entry.totalCredits)}
                      </div>
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

      {/* Review sidebar (from request card click) */}
      {selectedRequest && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => {
              setSelectedRequest(null);
              setAdminNote("");
            }}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label="Review request"
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedRequest(null);
                  setAdminNote("");
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        selectedRequest.status === "approved"
                          ? "#22c55e"
                          : selectedRequest.status === "rejected"
                            ? "#ef4444"
                            : selectedRequest.status === "clarification_needed"
                              ? "#3b82f6"
                              : "#eab308",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold leading-tight text-foreground">
                      {selectedRequest.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedRequest.event_date), "EEEE, MMMM d")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{selectedRequest.classroom?.name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    {selectedRequest.professor?.full_name ??
                      selectedRequest.professor_id}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    {selectedRequest.student_groups && selectedRequest.student_groups.length > 0
                      ? selectedRequest.student_groups.map((sg) => sg.name).join(", ")
                      : selectedRequest.student_group?.name ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    {selectedRequest.start_time.slice(0, 5)} –{" "}
                    {selectedRequest.end_time.slice(0, 5)}
                  </span>
                </div>
                {selectedRequest.description && (
                  <div className="flex items-start gap-3 text-sm pt-1 border-t">
                    <span className="text-muted-foreground">{selectedRequest.description}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t p-4 bg-background space-y-4">
              <div className="space-y-2">
                <Label>Admin note (optional)</Label>
                <Textarea
                  placeholder="Add a note for the professor..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => updateRequest(selectedRequest.id, "approved")}
                  disabled={updating}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[100px] rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Approve
                </Button>
                <Button
                  onClick={() => updateRequest(selectedRequest.id, "rejected")}
                  disabled={updating}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[100px] rounded-full border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive"
                >
                  <X className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Reject
                </Button>
                <Button
                  onClick={() =>
                    updateRequest(selectedRequest.id, "clarification_needed")
                  }
                  disabled={updating}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[100px] rounded-full border-muted-foreground/40 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                >
                  <HelpCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Clarify
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

