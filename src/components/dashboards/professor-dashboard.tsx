"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  Classroom,
  StudentGroup,
} from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, CalendarDays, MapPin, Users, LayoutList } from "lucide-react";
import { format } from "date-fns";
import { BookedSchedule, type SlotClickInfo } from "@/components/booked-schedule";
import { BookingForm, type BookingFormPrefill } from "@/components/booking-form";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  clarification_needed: "bg-blue-100 text-blue-800",
};

export function ProfessorDashboard({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingFormPrefill | undefined>();
  const [formKey, setFormKey] = useState(0);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [byIdRes, byEmailRes, classRes, groupRes] = await Promise.all([
      supabase
        .from("calendar_requests")
        .select("*, student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)")
        .eq("professor_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("calendar_requests")
        .select("*, student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)")
        .eq("professor_email", profile.email)
        .is("professor_id", null)
        .order("created_at", { ascending: false }),
      supabase.from("classrooms").select("*").order("name"),
      supabase.from("student_groups").select("*").order("name"),
    ]);

    const transformData = (data: any[]) =>
      data.map((req: any) => ({
        ...req,
        student_groups: req.student_groups?.map((sg: any) => sg.student_group) || [],
      }));

    const byId = transformData(byIdRes.data ?? []);
    const byEmail = transformData(byEmailRes.data ?? []);
    const seenIds = new Set(byId.map((r) => r.id));
    const merged = [...byId, ...byEmail.filter((r) => !seenIds.has(r.id))];
    setRequests(merged);

    if (classRes.data) setClassrooms(classRes.data);
    if (groupRes.data) setStudentGroups(groupRes.data);
    setLoading(false);
  }, [profile.id, profile.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openNewRequest() {
    setPrefill(undefined);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleSlotClick(info: SlotClickInfo) {
    setPrefill({
      classroomId: info.classroomId,
      eventDate: info.date,
      startTime: info.startTime,
      endTime: info.endTime,
    });
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  }

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
        <h1 className="text-3xl font-bold">Professor Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {profile.full_name}. Manage your calendar block requests.
        </p>
      </div>

      <Tabs defaultValue="my-requests">
        <TabsList>
          <TabsTrigger value="my-requests" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            My Requests
          </TabsTrigger>
          <TabsTrigger value="booked-schedule" className="gap-1.5">
            <LayoutList className="h-4 w-4" />
            Classroom Availability
          </TabsTrigger>
        </TabsList>

        {/* ========== MY REQUESTS TAB ========== */}
        <TabsContent value="my-requests" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <button
              onClick={openNewRequest}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-8 gap-1.5 px-2.5 transition-all hover:bg-primary/80 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </button>
          </div>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No requests yet. Create your first one!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests.map((req) => (
                <Card key={req.id} className="relative overflow-hidden">
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
                      <CardTitle className="text-lg">{req.title}</CardTitle>
                      <Badge className={statusColors[req.status]} variant="outline">
                        {req.status === "clarification_needed"
                          ? "Needs Clarification"
                          : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </div>
                    {req.description && (
                      <CardDescription>{req.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{format(new Date(req.event_date), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {req.start_time.slice(0, 5)} - {req.end_time.slice(0, 5)}
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
                    {req.admin_note && (
                      <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                        <p className="font-medium text-foreground">Admin Note:</p>
                        <p className="text-muted-foreground">{req.admin_note}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== CLASSROOM AVAILABILITY TAB ========== */}
        <TabsContent value="booked-schedule" className="mt-6">
          <BookedSchedule onSlotClick={handleSlotClick} />
        </TabsContent>
      </Tabs>

      {/* Shared booking dialog — works from both tabs */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <BookingForm
          key={formKey}
          profileId={profile.id}
          classrooms={classrooms}
          studentGroups={studentGroups}
          prefill={prefill}
          onSuccess={fetchData}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
}
