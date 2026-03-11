"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  RequestStatus,
  StudentGroup,
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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  clarification_needed: "bg-blue-100 text-blue-800",
};

export function AdminDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<CalendarRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  // Student management
  const [students, setStudents] = useState<Profile[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
  }, []);

  async function fetchRequests() {
    const { data } = await supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
      )
      .order("created_at", { ascending: false });

    if (data) setRequests(data);
    setLoading(false);
  }

  async function fetchStudents() {
    const [studRes, groupRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .order("full_name"),
      supabase.from("student_groups").select("*").order("name"),
    ]);

    if (studRes.data) setStudents(studRes.data);
    if (groupRes.data) setStudentGroups(groupRes.data);
    setStudentsLoading(false);
  }

  async function assignGroup(studentId: string, groupName: string) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        student_group: groupName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId)
      .select();

    if (error) {
      toast.error("Failed to assign group: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      toast.error(
        "Update blocked — please run the admin policy SQL in Supabase. " +
          "See supabase/add-admin-update-profiles-policy.sql"
      );
      return;
    }

    toast.success(
      groupName
        ? `Student assigned to ${groupName}`
        : "Student removed from group"
    );
    fetchStudents();
  }

  async function updateRequest(id: string, status: RequestStatus) {
    setUpdating(true);

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
  }

  const filterByStatus = (status: string) =>
    status === "all"
      ? requests
      : requests.filter((r) => r.status === status);

  const unassignedStudents = students.filter((s) => !s.student_group);
  const assignedStudents = students.filter((s) => s.student_group);

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
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar Requests
          </TabsTrigger>
          <TabsTrigger value="booked-schedule" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Classroom Availability
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            Manage Students
            {unassignedStudents.length > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                {unassignedStudents.length}
              </span>
            )}
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
                            <span>{req.student_group?.name ?? "—"}</span>
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
          <BookedSchedule />
        </TabsContent>

        {/* ========== STUDENTS TAB ========== */}
        <TabsContent value="students" className="mt-6 space-y-6">
          {studentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-pulse text-muted-foreground">
                Loading students...
              </div>
            </div>
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No students have signed up yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Unassigned students alert */}
              {unassignedStudents.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="flex items-start gap-3 pt-6">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">
                        {unassignedStudents.length} student
                        {unassignedStudents.length > 1 ? "s" : ""} not assigned
                        to any group
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        These students won&apos;t see any events until you
                        assign them to a student group below.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Student list */}
              <div className="rounded-lg border bg-white">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Student Group</span>
                  <span className="w-20" />
                </div>
                {students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    groups={studentGroups}
                    onAssign={assignGroup}
                  />
                ))}
              </div>

              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Total Students
                    </p>
                    <p className="text-3xl font-bold">{students.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Assigned</p>
                    <p className="text-3xl font-bold text-green-600">
                      {assignedStudents.length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                    <p className="text-3xl font-bold text-amber-600">
                      {unassignedStudents.length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
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
                  <p className="text-muted-foreground">
                    {selectedRequest.description}
                  </p>
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
                    <p className="font-medium">Student Group</p>
                    <p className="text-muted-foreground">
                      {selectedRequest.student_group?.name ?? "—"}
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

// ─── Student Row Component ───────────────────────────────────────────

function StudentRow({
  student,
  groups,
  onAssign,
}: {
  student: Profile;
  groups: StudentGroup[];
  onAssign: (studentId: string, groupName: string) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState(
    student.student_group ?? ""
  );
  const [saving, setSaving] = useState(false);

  const hasChanged = selectedGroup !== (student.student_group ?? "");

  async function handleSave() {
    setSaving(true);
    await onAssign(student.id, selectedGroup);
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">
          {student.full_name || "—"}
        </span>
        {!student.student_group && (
          <span className="inline-flex h-2 w-2 rounded-full bg-amber-400 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">
          {student.email}
        </span>
      </div>
      <div>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          <option value="">— No group —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-20">
        {hasChanged && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? "..." : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
