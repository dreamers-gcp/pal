"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  CalendarRequestKind,
  Classroom,
  StudentGroup,
  SportsBooking,
  SportType,
  SportsVenueCode,
  FacilityBooking,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  ClipboardList,
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ScanFace,
  X,
  Trophy,
} from "lucide-react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { CalendarSlotInfo } from "@/components/request-calendar";
import { BookingForm, type BookingFormPrefill } from "@/components/booking-form";
import { ProfessorCampusTab } from "@/components/campus/professor-campus-tab";
import { AttendanceView } from "@/components/attendance-view";
import { RequestCalendar } from "@/components/request-calendar";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TimeRangeSelect } from "@/components/ui/time-range-select";
import {
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  venuesForSport,
  isTimeOverlap,
} from "@/lib/sports-booking";
import { DashboardShellSkeleton, BookingCardsSkeleton } from "@/components/ui/loading-skeletons";
import { cn } from "@/lib/utils";

export function ProfessorDashboard({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [bookingSidebarOpen, setBookingSidebarOpen] = useState(false);
  const [prefill, setPrefill] = useState<BookingFormPrefill | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [bookingRequestKind, setBookingRequestKind] =
    useState<CalendarRequestKind>("class");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [sectionNavExpanded, setSectionNavExpanded] = useState(true);

  useEffect(() => {
    function handleOpenTabMenu() {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches
      ) {
        setSectionNavExpanded(true);
      } else {
        setTabMenuOpen(true);
      }
    }
    window.addEventListener("pal:open-tab-menu", handleOpenTabMenu);
    return () => window.removeEventListener("pal:open-tab-menu", handleOpenTabMenu);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pal:section-nav-expanded", {
        detail: { wide: sectionNavExpanded },
      })
    );
  }, [sectionNavExpanded]);

  /** "all-rooms" = see all events + book; "my-schedule" = see only my requests */
  const [calendarViewMode, setCalendarViewMode] = useState<"all-rooms" | "my-schedule">("all-rooms");
  /** When in all-rooms: which room to book (empty = just viewing). When in my-schedule: unused. */
  const [calendarRoomFilter, setCalendarRoomFilter] = useState<string>("");
  /** All approved requests across all rooms (for all-rooms view) */
  const [allApprovedBookings, setAllApprovedBookings] = useState<CalendarRequest[]>([]);
  const [allApprovedLoading, setAllApprovedLoading] = useState(false);
  const [approvedFacilityBookings, setApprovedFacilityBookings] = useState<
    FacilityBooking[]
  >([]);
  const [facilityBookingsLoading, setFacilityBookingsLoading] = useState(true);
  const [sportsBookings, setSportsBookings] = useState<SportsBooking[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsSubmitting, setSportsSubmitting] = useState(false);
  const [sportType, setSportType] = useState<SportType>("badminton");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>("badminton_court_1");
  const [sportDate, setSportDate] = useState("");
  const [sportStartTime, setSportStartTime] = useState("17:00");
  const [sportEndTime, setSportEndTime] = useState("18:00");
  const [sportPurpose, setSportPurpose] = useState("");
  const [unavailableSportsVenues, setUnavailableSportsVenues] = useState<Set<SportsVenueCode>>(new Set());

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
    const supabase = createClient();
    async function fetchSportsBookings() {
      setSportsLoading(true);
      try {
        const { data } = await supabase
          .from("sports_bookings")
          .select("*")
          .or(`requester_id.eq.${profile.id},requester_email.eq.${profile.email}`)
          .order("created_at", { ascending: false });
        setSportsBookings((data as SportsBooking[]) ?? []);
      } catch (error) {
        console.error("Failed to load sports bookings", error);
      } finally {
        setSportsLoading(false);
      }
    }
    fetchSportsBookings();
  }, [profile.id, profile.email]);

  useEffect(() => {
    setSportVenue(venuesForSport(sportType)[0]);
  }, [sportType]);

  useEffect(() => {
    if (!sportDate || !sportStartTime || !sportEndTime) {
      setUnavailableSportsVenues(new Set());
      return;
    }
    const supabase = createClient();
    supabase
      .from("sports_bookings")
      .select("venue_code, start_time, end_time")
      .eq("sport", sportType)
      .eq("booking_date", sportDate)
      .eq("status", "approved")
      .then(({ data }) => {
        const blocked = new Set<SportsVenueCode>();
        for (const row of data ?? []) {
          if (
            isTimeOverlap(
              sportStartTime,
              sportEndTime,
              row.start_time.slice(0, 5),
              row.end_time.slice(0, 5)
            )
          ) {
            blocked.add(row.venue_code as SportsVenueCode);
          }
        }
        setUnavailableSportsVenues(blocked);
      });
  }, [sportType, sportDate, sportStartTime, sportEndTime]);

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

  /** Approved facility bookings for the same window as the class calendar (read-only overlay). */
  useEffect(() => {
    const supabase = createClient();
    setFacilityBookingsLoading(true);
    const from = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(new Date(), 5)), "yyyy-MM-dd");

    supabase
      .from("facility_bookings")
      .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
      .eq("status", "approved")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setApprovedFacilityBookings([]);
        } else {
          setApprovedFacilityBookings((data as FacilityBooking[]) ?? []);
        }
        setFacilityBookingsLoading(false);
      });
  }, []);

  const calendarBookings = useMemo(() => {
    if (calendarViewMode === "my-schedule") return requests;

    const approvedIds = new Set(allApprovedBookings.map((r) => r.id));
    const mineNotInAll = requests.filter((r) => !approvedIds.has(r.id));
    const byId = new Map<string, CalendarRequest>();
    allApprovedBookings.forEach((r) => byId.set(r.id, r));
    mineNotInAll.forEach((r) => byId.set(r.id, r));
    const sorted = Array.from(byId.values()).sort((a, b) => {
      const d = a.event_date.localeCompare(b.event_date);
      if (d !== 0) return d;
      return a.start_time.localeCompare(b.start_time);
    });

    // When professor selects a specific classroom, render only events for that room.
    if (calendarRoomFilter) {
      return sorted.filter((r) => String(r.classroom_id ?? "") === calendarRoomFilter);
    }

    return sorted;
  }, [calendarViewMode, calendarRoomFilter, requests, allApprovedBookings]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
  }, []);

  const sportsAvailabilityResource = useMemo(
    () =>
      ({
        kind: "sports" as const,
        sport: sportType,
        venueCode: sportVenue,
        label: SPORTS_VENUE_LABELS[sportVenue],
      }),
    [sportType, sportVenue]
  );

  function openNewRequest(kind: CalendarRequestKind = "class") {
    setBookingRequestKind(kind);
    setPrefill(undefined);
    setFormKey((k) => k + 1);
    setBookingSidebarOpen(true);
  }

  function formatStatusLabel(status: SportsBooking["status"]): string {
    if (status === "clarification_needed") return "Clarification";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  async function submitSportsBooking() {
    if (!sportDate || !sportStartTime || !sportEndTime) {
      toast.error("Please select date and time.");
      return;
    }
    if (sportStartTime >= sportEndTime) {
      toast.error("End time must be later than start time.");
      return;
    }
    if (unavailableSportsVenues.has(sportVenue)) {
      toast.error("Selected venue is already booked for this time.");
      return;
    }
    setSportsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("sports_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      requester_role: "professor",
      sport: sportType,
      venue_code: sportVenue,
      booking_date: sportDate,
      start_time: `${sportStartTime}:00`,
      end_time: `${sportEndTime}:00`,
      purpose: sportPurpose.trim() || null,
    });
    if (error) {
      toast.error("Failed to submit sports booking: " + error.message);
      setSportsSubmitting(false);
      return;
    }
    toast.success("Sports booking request submitted.");
    setSportPurpose("");
    setSportsSubmitting(false);
    const { data } = await supabase
      .from("sports_bookings")
      .select("*")
      .or(`requester_id.eq.${profile.id},requester_email.eq.${profile.email}`)
      .order("created_at", { ascending: false });
    setSportsBookings((data as SportsBooking[]) ?? []);
  }

  function handleCalendarSlotSelect(slot: CalendarSlotInfo) {
    setBookingRequestKind("class");
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
    setBookingSidebarOpen(true);
  }

  if (loading) {
    return <DashboardShellSkeleton variant="member" />;
  }

  return (
    <>
    <Tabs defaultValue="my-requests">
        <aside
          className={cn(
            "fixed left-0 top-16 z-[45] hidden h-[calc(100dvh-4rem)] flex-col border-r border-[rgba(0,0,0,0.06)] bg-white transition-[width] duration-200 ease-out md:flex",
            sectionNavExpanded ? "w-56" : "w-14"
          )}
        >
          <div
            className={cn(
              "flex h-full flex-col",
              sectionNavExpanded ? "px-3" : "px-1"
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center border-b border-[rgba(0,0,0,0.06)] py-2",
                sectionNavExpanded ? "justify-end" : "justify-center"
              )}
            >
              {sectionNavExpanded ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSectionNavExpanded(false)}
                  aria-label="Collapse to icon bar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSectionNavExpanded(true)}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
              <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 rounded-lg border-0 bg-transparent p-0">
                <TabsTrigger
                  value="my-requests"
                  title="My Requests"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>My Requests</span>
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  title="Calendar"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Calendar</span>
                </TabsTrigger>
                <TabsTrigger
                  value="attendance"
                  title="Attendance"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <ScanFace className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Attendance</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sports"
                  title="Sports Requests"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Sports Requests</span>
                </TabsTrigger>
                <TabsTrigger
                  value="campus"
                  title="Campus facilities"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Campus facilities
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </aside>

        <div
          className={cn(
            "min-w-0 space-y-6 transition-[margin] duration-200 ease-out",
            sectionNavExpanded ? "md:ml-56" : "md:ml-14"
          )}
        >
            <div>
              <h1 className="font-display text-3xl font-normal tracking-tight text-foreground">
                {greeting}, {profile.full_name}!
              </h1>
            </div>

            {tabMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 md:hidden"
                  aria-hidden
                  onClick={() => setTabMenuOpen(false)}
                />
                <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r bg-background p-4 shadow-2xl animate-in slide-in-from-left duration-200 md:hidden">
                  <div className="mb-3 flex justify-end border-b border-border pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setTabMenuOpen(false)}
                      aria-label="Close menu"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <TabsList className="flex h-auto w-full flex-col items-stretch">
                    <TabsTrigger
                      value="my-requests"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <ClipboardList className="h-4 w-4" />
                      My Requests
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
                      value="sports"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <Trophy className="h-4 w-4" />
                      Sports Requests
                    </TabsTrigger>
                    <TabsTrigger
                      value="campus"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <Building2 className="h-4 w-4" />
                      Campus facilities
                    </TabsTrigger>
                  </TabsList>
                </aside>
              </>
            )}
            <TabsList className="hidden">
              <TabsTrigger value="my-requests" className="gap-1.5">
                <ClipboardList className="h-4 w-4" />
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
              <TabsTrigger value="sports" className="gap-1.5">
                <Trophy className="h-4 w-4" />
                Sports Requests
              </TabsTrigger>
              <TabsTrigger value="campus" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                Campus facilities
              </TabsTrigger>
            </TabsList>

        {/* ========== MY REQUESTS TAB ========== */}
        <TabsContent value="my-requests" className="mt-6 space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => openNewRequest("class")}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-8 gap-1.5 px-2.5 transition-all hover:bg-primary/80 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="h-4 w-4" />
              New class request
            </button>
            <button
              type="button"
              onClick={() => openNewRequest("exam")}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-background text-sm font-medium h-8 gap-1.5 px-2.5 transition-all hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="h-4 w-4" />
              Schedule exam
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
              onClick={() => openNewRequest("class")}
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
                <SelectTrigger id="calendar-classroom-filter" className="w-full sm:max-w-[220px]">
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

          <p className="text-xs text-muted-foreground">
            Colored blocks are classroom bookings;{" "}
            <span className="font-medium text-teal-700 dark:text-teal-400">
              teal
            </span>{" "}
            blocks are approved campus facility bookings (auditorium, halls, board rooms, etc.).
          </p>
          <RequestCalendar
            bookings={calendarBookings}
            classrooms={classrooms}
            facilityBookings={approvedFacilityBookings}
            loading={
              calendarViewMode === "my-schedule"
                ? false
                : allApprovedLoading || facilityBookingsLoading
            }
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

        <TabsContent value="sports" className="mt-6 space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-xl border p-4 space-y-4">
                  <p className="text-sm font-semibold">Booking Details</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sport</Label>
                      <Select value={sportType} onValueChange={(v) => setSportType(v as SportType)}>
                        <SelectTrigger>
                          <SelectValue>{SPORT_LABELS[sportType]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="badminton">Badminton</SelectItem>
                          <SelectItem value="cricket">Cricket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <DatePicker value={sportDate} onChange={setSportDate} placeholder="Pick date" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <TimeRangeSelect
                        startValue={sportStartTime}
                        endValue={sportEndTime}
                        onStartChange={setSportStartTime}
                        onEndChange={setSportEndTime}
                        startLabel={<Label>Start Time</Label>}
                        endLabel={<Label>End Time</Label>}
                        stepMinutes={60}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Purpose (optional)</Label>
                      <Textarea rows={2} value={sportPurpose} onChange={(e) => setSportPurpose(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {sportType === "badminton" ? "Court Selection" : "Ground Selection"}
                    </p>
                    <span className="text-xs text-muted-foreground">{SPORTS_VENUE_LABELS[sportVenue]}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {venuesForSport(sportType).map((v) => {
                      const blocked = unavailableSportsVenues.has(v);
                      const selected = sportVenue === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={blocked}
                          onClick={() => !blocked && setSportVenue(v)}
                          className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                            selected
                              ? "border-primary/70 bg-primary/10 text-primary"
                              : blocked
                                ? "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground line-through"
                                : "bg-background hover:bg-muted/40"
                          }`}
                        >
                          {SPORTS_VENUE_LABELS[v]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Blocked venues already have approved bookings for this date/time.
                  </p>
                </div>
              </div>
              <ResourceAvailabilityCalendar resource={sportsAvailabilityResource} />
              <div className="flex justify-end">
                <Button onClick={submitSportsBooking} disabled={sportsSubmitting}>
                  {sportsSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {sportsLoading ? (
            <div className="py-4">
              <BookingCardsSkeleton count={3} />
            </div>
          ) : sportsBookings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No sports booking requests yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sportsBookings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{SPORT_LABELS[b.sport]}</p>
                      <Badge className={b.status === "approved" ? "bg-accent/15 text-accent-foreground" : b.status === "rejected" ? "bg-destructive/10 text-destructive" : b.status === "clarification_needed" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800"}>
                        {formatStatusLabel(b.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{SPORTS_VENUE_LABELS[b.venue_code]}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.booking_date} • {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                    </p>
                    {b.purpose && <p className="text-sm">{b.purpose}</p>}
                    {b.admin_note && (
                      <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                        Admin note: {b.admin_note}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campus" className="mt-6">
          <ProfessorCampusTab profile={profile} />
        </TabsContent>
        </div>
    </Tabs>

      {/* Booking sidebar — New request + calendar slot selection (matches admin review panel) */}
      {bookingSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => setBookingSidebarOpen(false)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-xl bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label="New event request"
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBookingSidebarOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 pt-2">
              <BookingForm
                key={formKey}
                variant="panel"
                profileId={profile.id}
                classrooms={classrooms}
                studentGroups={studentGroups}
                prefill={prefill}
                defaultRequestKind={bookingRequestKind}
                onSuccess={fetchData}
                onClose={() => setBookingSidebarOpen(false)}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
