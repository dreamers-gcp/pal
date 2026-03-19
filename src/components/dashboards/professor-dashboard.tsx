"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  Classroom,
  StudentGroup,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, CalendarDays, MapPin, Users, ScanFace } from "lucide-react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { CalendarSlotInfo } from "@/components/request-calendar";
import { BookingForm, type BookingFormPrefill } from "@/components/booking-form";
import { AttendanceView } from "@/components/attendance-view";
import { RequestCalendar } from "@/components/request-calendar";
import { RequestCard } from "@/components/request-card";
import { toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProfessorDashboard({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingFormPrefill | undefined>();
  const [formKey, setFormKey] = useState(0);

  /** "all-rooms" = see all events + book; "my-schedule" = see only my requests */
  const [calendarViewMode, setCalendarViewMode] = useState<"all-rooms" | "my-schedule">("all-rooms");
  /** When in all-rooms: which room to book (empty = just viewing). When in my-schedule: unused. */
  const [calendarRoomFilter, setCalendarRoomFilter] = useState<string>("");
  /** All approved requests across all rooms (for all-rooms view) */
  const [allApprovedBookings, setAllApprovedBookings] = useState<CalendarRequest[]>([]);
  const [allApprovedLoading, setAllApprovedLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [byIdRes, byEmailRes, classRes, groupRes] = await Promise.all([
      supabase
        .from("calendar_requests")
        .select("*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)")
        .eq("professor_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("calendar_requests")
        .select("*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), student_groups:calendar_request_groups(student_group:student_groups(*)), classroom:classrooms(*)")
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

  useEffect(() => {
    if (calendarViewMode !== "all-rooms") return;

    const supabase = createClient();
    setAllApprovedLoading(true);
    const from = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(new Date(), 5)), "yyyy-MM-dd");

    supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
      )
      .eq("status", "approved")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setAllApprovedBookings([]);
        } else if (data) {
          const transformed = data.map((req: any) => ({
            ...req,
            student_groups: req.student_groups?.map((sg: any) => sg.student_group) || [],
          }));
          setAllApprovedBookings(transformed);
        }
        setAllApprovedLoading(false);
      });
  }, [calendarViewMode]);

  const calendarBookings = useMemo(() => {
    if (calendarViewMode === "my-schedule") return requests;

    const approvedIds = new Set(allApprovedBookings.map((r) => r.id));
    const mineNotInAll = requests.filter((r) => !approvedIds.has(r.id));
    const byId = new Map<string, CalendarRequest>();
    allApprovedBookings.forEach((r) => byId.set(r.id, r));
    mineNotInAll.forEach((r) => byId.set(r.id, r));
    return Array.from(byId.values()).sort((a, b) => {
      const d = a.event_date.localeCompare(b.event_date);
      if (d !== 0) return d;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [calendarViewMode, requests, allApprovedBookings]);

  function openNewRequest() {
    setPrefill(undefined);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleCalendarSlotSelect(slot: CalendarSlotInfo) {
    const classroomId =
      calendarViewMode === "all-rooms" && calendarRoomFilter
        ? calendarRoomFilter
        : slot.resourceId != null && slot.resourceId !== ""
          ? String(slot.resourceId)
          : undefined;
    setPrefill({
      classroomId,
      eventDate: format(slot.start, "yyyy-MM-dd"),
      startTime: format(slot.start, "HH:mm"),
      endTime: format(slot.end, "HH:mm"),
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
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5">
            <ScanFace className="h-4 w-4" />
            Attendance
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
                <RequestCard
                  key={req.id}
                  request={req}
                  showAdminNote
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== CALENDAR TAB (schedule + availability + new requests) ========== */}
        <TabsContent value="calendar" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalendarViewMode("all-rooms")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  calendarViewMode === "all-rooms"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All rooms
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode("my-schedule")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  calendarViewMode === "my-schedule"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                My schedule
              </button>
            </div>
            <button
              type="button"
              onClick={openNewRequest}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-9 gap-1.5 px-3 transition-all hover:bg-primary/80 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="h-4 w-4" />
              New request
            </button>
          </div>

          {calendarViewMode === "all-rooms" && (
            <div className="flex flex-col gap-2 sm:max-w-md">
              <Label htmlFor="calendar-classroom-filter">Book a room</Label>
              <Select
                value={calendarRoomFilter || "none"}
                onValueChange={(v) => setCalendarRoomFilter(v === "none" || !v ? "" : v)}
              >
                <SelectTrigger id="calendar-classroom-filter" className="w-full sm:max-w-md">
                  <span className="flex flex-1 items-center truncate">
                    {!calendarRoomFilter
                      ? "Select room to book a slot"
                      : toTitleCase(
                          classrooms.find((c) => c.id === calendarRoomFilter)?.name ?? ""
                        ) || "Select room"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select room to book a slot</SelectItem>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {toTitleCase(c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <RequestCalendar
            bookings={calendarBookings}
            classrooms={classrooms}
            loading={calendarViewMode === "my-schedule" ? false : allApprovedLoading}
            colorBy="classroom"
            bookingClassroomId={
              calendarViewMode === "all-rooms" && calendarRoomFilter ? calendarRoomFilter : null
            }
            onSelectSlot={handleCalendarSlotSelect}
            emptyMessage={
              calendarViewMode === "my-schedule"
                ? "No requests yet. Use New request or switch to All rooms to book."
                : "No events in this range. Select a room above to book a slot, or use New request."
            }
          />
        </TabsContent>

        {/* ========== ATTENDANCE TAB ========== */}
        <TabsContent value="attendance" className="mt-6">
          <AttendanceView profile={profile} />
        </TabsContent>
      </Tabs>

      {/* Booking dialog — New request + availability slot clicks */}
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
