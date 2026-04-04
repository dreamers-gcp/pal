"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  CalendarRequest,
  GuestHouseBooking,
  SportsBooking,
  SportType,
  SportsVenueCode,
} from "@/lib/types";
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
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  GraduationCap,
  ListTodo,
  MapPin,
  ScanFace,
  User,
  Building2,
  Trophy,
  Landmark,
} from "lucide-react";
import { format } from "date-fns";
import { TaskTracker } from "@/components/task-tracker";
import { StudentCalendar } from "@/components/student-calendar";
import { AttendanceMarker } from "@/components/attendance-marker";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeRangeSelect } from "@/components/ui/time-range-select";
import { toast } from "sonner";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";
import { roomsNeededForGuestCount } from "@/lib/guest-house";
import { GuestHouseAllocationReadout } from "@/components/guest-house-allocation-readout";
import {
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  SPORT_TYPES_ORDER,
  venuesForSport,
  isTimeOverlap,
} from "@/lib/sports-booking";
import { StudentCampusTab } from "@/components/campus/student-campus-tab";
import { DashboardShellSkeleton, BookingCardsSkeleton } from "@/components/ui/loading-skeletons";
import { cn } from "@/lib/utils";

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

function formatGuestStatusLabel(status: GuestHouseBooking["status"]): string {
  if (status === "clarification_needed") return "Clarification";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

export function StudentDashboard({ profile }: { profile: Profile }) {
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentGroupIds, setStudentGroupIds] = useState<string[]>([]);
  const [studentGroupNames, setStudentGroupNames] = useState<string[]>([]);
  const [groupIdToName, setGroupIdToName] = useState<Record<string, string>>({});
  const [filterSubject, setFilterSubject] = useState("all");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  /** Desktop: fixed rail under header; hamburger opens, back arrow collapses (mobile uses overlay). */
  const [sectionNavExpanded, setSectionNavExpanded] = useState(true);
  const [guestBookings, setGuestBookings] = useState<GuestHouseBooking[]>([]);
  const [guestLoading, setGuestLoading] = useState(true);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPurpose, setGuestPurpose] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [guestRoomCount, setGuestRoomCount] = useState(1);
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");
  const [sportsBookings, setSportsBookings] = useState<SportsBooking[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsSubmitting, setSportsSubmitting] = useState(false);
  const [sportType, setSportType] = useState<SportType>("cricket");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>("cricket_ground");
  const [sportDate, setSportDate] = useState("");
  const [sportStartTime, setSportStartTime] = useState("17:00");
  const [sportEndTime, setSportEndTime] = useState("18:00");
  const [sportPurpose, setSportPurpose] = useState("");
  const [unavailableSportsVenues, setUnavailableSportsVenues] = useState<Set<SportsVenueCode>>(new Set());
  /** Tick so "Upcoming" → "Ongoing" updates without navigating away. */
  const [now, setNow] = useState(() => new Date());

  const guestRoomMin = useMemo(
    () => roomsNeededForGuestCount(Math.max(1, Math.floor(Number(guestCount) || 1))),
    [guestCount]
  );
  const prevGuestCountRef = useRef(guestCount);
  const prevGuestRoomMinRef = useRef(guestRoomMin);
  useEffect(() => {
    const newMin = guestRoomMin;
    const oldMin = prevGuestRoomMinRef.current;
    const prevGuests = prevGuestCountRef.current;

    setGuestRoomCount((prev) => {
      if (guestCount !== prevGuests) {
        if (guestCount < prevGuests && prev <= oldMin) {
          return newMin;
        }
        return Math.max(newMin, prev);
      }
      return Math.max(newMin, prev);
    });

    prevGuestCountRef.current = guestCount;
    prevGuestRoomMinRef.current = newMin;
  }, [guestRoomMin, guestCount]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    function onToggleSectionNav() {
      setSectionNavExpanded((prev) => !prev);
    }
    window.addEventListener("pal:toggle-section-nav", onToggleSectionNav);
    return () =>
      window.removeEventListener("pal:toggle-section-nav", onToggleSectionNav);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pal:section-nav-expanded", {
        detail: { wide: sectionNavExpanded },
      })
    );
  }, [sectionNavExpanded]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      try {
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
        } else {
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
        }

      } catch (error) {
        console.error("Failed to load student dashboard data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [profile.id, profile.email, profile.student_group]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchGuestBookings() {
      setGuestLoading(true);
      try {
        const { data } = await supabase
          .from("guest_house_bookings")
          .select("*")
          .or(`requester_id.eq.${profile.id},requester_email.eq.${profile.email}`)
          .order("created_at", { ascending: false });
        setGuestBookings((data as GuestHouseBooking[]) ?? []);
      } catch (error) {
        console.error("Failed to load guest house bookings", error);
      } finally {
        setGuestLoading(false);
      }
    }

    fetchGuestBookings();
  }, [profile.id, profile.email]);

  useEffect(() => {
    const supabase = createClient();
    async function fetchSportsBookings() {
      setSportsLoading(true);
      try {
        const { data } = await supabase
          .from("sports_bookings")
          .select("*")
          .eq("requester_id", profile.id)
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
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("sports_bookings")
      .select("venue_code, start_time, end_time")
      .eq("sport", sportType)
      .eq("booking_date", sportDate)
      .eq("status", "approved")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Sports availability check failed", error);
          setUnavailableSportsVenues(new Set());
          return;
        }
        const blocked = new Set<SportsVenueCode>();
        for (const row of data ?? []) {
          if (
            isTimeOverlap(
              sportStartTime,
              sportEndTime,
              String(row.start_time ?? ""),
              String(row.end_time ?? "")
            )
          ) {
            blocked.add(row.venue_code as SportsVenueCode);
          }
        }
        setUnavailableSportsVenues(blocked);
      });
    return () => {
      cancelled = true;
    };
  }, [sportType, sportDate, sportStartTime, sportEndTime]);

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

  const sportsSlotBlocked = useMemo(
    () => unavailableSportsVenues.has(sportVenue),
    [unavailableSportsVenues, sportVenue]
  );

  /** Only this user’s requests (defense in depth if the query ever mis-filters). */
  const mySportsBookings = useMemo(
    () =>
      sportsBookings.filter(
        (b) =>
          b.requester_id === profile.id ||
          (Boolean(b.requester_email) && b.requester_email === profile.email)
      ),
    [sportsBookings, profile.id, profile.email]
  );

  async function submitGuestBooking() {
    if (!guestName.trim() || !guestCheckIn || !guestCheckOut) {
      toast.error("Please fill guest name and stay dates.");
      return;
    }
    const count = Math.max(1, Math.floor(Number(guestCount) || 1));
    if (count > 200) {
      toast.error("Guest count must be 200 or fewer.");
      return;
    }
    const minRooms = roomsNeededForGuestCount(count);
    const roomsRequested = Math.max(
      minRooms,
      Math.floor(Number(guestRoomCount) || minRooms)
    );
    if (roomsRequested < minRooms) {
      toast.error(
        `Request at least ${minRooms} room(s) for ${count} guest(s) (max 4 guests per room).`
      );
      return;
    }
    if (roomsRequested > 200) {
      toast.error("Room count must be 200 or fewer.");
      return;
    }
    if (guestCheckOut < guestCheckIn) {
      toast.error("Check-out cannot be earlier than check-in.");
      return;
    }

    setGuestSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from("guest_house_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      guest_name: guestName.trim(),
      purpose: guestPurpose.trim() || null,
      guest_count: count,
      requested_room_count: roomsRequested,
      guest_house: null,
      room_number: null,
      allocated_rooms: null,
      check_in_date: guestCheckIn,
      check_out_date: guestCheckOut,
    });

    if (error) {
      toast.error("Failed to submit guest house booking: " + error.message);
      setGuestSubmitting(false);
      return;
    }

    toast.success("Guest house request submitted. An admin will assign guest houses and rooms.");
    setGuestName("");
    setGuestPurpose("");
    setGuestCount(1);
    setGuestRoomCount(1);
    setGuestCheckIn("");
    setGuestCheckOut("");
    setGuestSubmitting(false);

    const { data: myGuestBookings } = await supabase
      .from("guest_house_bookings")
      .select("*")
      .or(`requester_id.eq.${profile.id},requester_email.eq.${profile.email}`)
      .order("created_at", { ascending: false });
    setGuestBookings((myGuestBookings as GuestHouseBooking[]) ?? []);
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
      toast.error("Slot is already booked");
      return;
    }

    setSportsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("sports_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      requester_role: "student",
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
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false });
    setSportsBookings((data as SportsBooking[]) ?? []);
  }

  if (loading) {
    return <DashboardShellSkeleton variant="member" />;
  }

  return (
    <Tabs defaultValue="events" className="gap-1">
        {/* Desktop: left rail — wide (icons+labels) or narrow (icons only), like a classic app sidebar */}
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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
              <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 rounded-lg border-0 bg-transparent p-0">
                <TabsTrigger
                  value="events"
                  title="Events"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Events</span>
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
                  value="tasks"
                  title="Task Tracker"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Task Tracker</span>
                </TabsTrigger>
                <TabsTrigger
                  value="guest-house"
                  title="Guest House Requests"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Guest House Requests
                  </span>
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
                  title="Campus services"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Campus services</span>
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
                    <TabsTrigger
                      value="guest-house"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <Building2 className="h-4 w-4" />
                      Guest House Requests
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
                      <Landmark className="h-4 w-4" />
                      Campus services
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
          <TabsTrigger value="guest-house" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Guest House Requests
          </TabsTrigger>
          <TabsTrigger value="sports" className="gap-1.5">
            <Trophy className="h-4 w-4" />
            Sports Requests
          </TabsTrigger>
          <TabsTrigger value="campus" className="gap-1.5">
            <Landmark className="h-4 w-4" />
            Campus services
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
              Upcoming &amp; Ongoing ({upcoming.length})
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
                  No class groups assigned yet — the calendar still shows approved campus bookings for
                  everyone; subject filters and group-linked features unlock once your roster is set.
                  Your Task Tracker tasks appear on the same calendar.
                </p>
              </CardContent>
            </Card>
          )}
          <StudentCalendar studentId={profile.id} />
        </TabsContent>

        <TabsContent value="guest-house" className="mt-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Guest House Booking</CardTitle>
              <CardDescription>
                An admin assigns specific guest houses and rooms after approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 space-y-4 max-w-2xl">
                <p className="text-sm font-semibold">Booking details</p>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 min-w-0">
                      <label className="text-sm font-medium">Guest name</label>
                      <Input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Guest full name"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-sm font-medium">Number of guests</label>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={guestCount}
                        className="tabular-nums"
                        onChange={(e) =>
                          setGuestCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                      />
                      <p className="text-xs text-muted-foreground leading-snug">
                        Max 4 guests per room.
                      </p>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-sm font-medium">Number of rooms</label>
                      <Input
                        type="number"
                        min={guestRoomMin}
                        max={200}
                        value={guestRoomCount}
                        className="tabular-nums w-full"
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isFinite(v)) return;
                          setGuestRoomCount(Math.max(guestRoomMin, Math.min(200, v)));
                        }}
                      />
                      <p className="text-xs text-muted-foreground leading-snug text-pretty">
                        At least {guestRoomMin} room{guestRoomMin === 1 ? "" : "s"} for your guests.
                        You may request additional rooms if you need them.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 min-w-0">
                      <label className="text-sm font-medium">Check-in</label>
                      <DatePicker
                        value={guestCheckIn}
                        onChange={setGuestCheckIn}
                        min={new Date().toISOString().split("T")[0]}
                        placeholder="Pick date"
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-sm font-medium">Check-out</label>
                      <DatePicker
                        value={guestCheckOut}
                        onChange={setGuestCheckOut}
                        min={guestCheckIn || new Date().toISOString().split("T")[0]}
                        placeholder="Pick date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Purpose (optional)</label>
                    <Textarea
                      rows={2}
                      value={guestPurpose}
                      onChange={(e) => setGuestPurpose(e.target.value)}
                      placeholder="Visit purpose/details"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    className="w-full sm:w-auto sm:min-w-[200px]"
                    onClick={submitGuestBooking}
                    disabled={guestSubmitting}
                  >
                    {guestSubmitting ? "Submitting..." : "Submit booking request"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {guestLoading ? (
            <div className="py-4">
              <BookingCardsSkeleton count={3} />
            </div>
          ) : guestBookings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No guest house booking requests yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {guestBookings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{b.guest_name}</p>
                      <Badge
                        className={
                          b.status === "approved"
                            ? "bg-accent/15 text-accent-foreground"
                            : b.status === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : b.status === "clarification_needed"
                                ? "bg-primary/10 text-primary"
                                : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {formatGuestStatusLabel(b.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {b.guest_count ?? 1} guest{(b.guest_count ?? 1) === 1 ? "" : "s"}
                      {" "}
                      ·{" "}
                      {b.requested_room_count ??
                        roomsNeededForGuestCount(b.guest_count ?? 1)}{" "}
                      room
                      {(b.requested_room_count ??
                        roomsNeededForGuestCount(b.guest_count ?? 1)) === 1
                        ? ""
                        : "s"}{" "}
                      requested
                    </p>
                    {b.status === "approved" ? (
                      <GuestHouseAllocationReadout booking={b} />
                    ) : b.status === "pending" ? (
                      <p className="text-xs text-muted-foreground">
                        Awaiting guest house & room assignment from admin.
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {b.check_in_date} to {b.check_out_date}
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

        <TabsContent value="sports" className="mt-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Sports Booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-xl border p-4 space-y-4">
                  <p className="text-sm font-semibold">Booking Details</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sport</label>
                      <Select value={sportType} onValueChange={(v) => setSportType(v as SportType)}>
                        <SelectTrigger>
                          <SelectValue>{SPORT_LABELS[sportType]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SPORT_TYPES_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SPORT_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date</label>
                      <DatePicker
                        value={sportDate}
                        onChange={setSportDate}
                        min={new Date().toISOString().split("T")[0]}
                        placeholder="Pick date"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <TimeRangeSelect
                        startValue={sportStartTime}
                        endValue={sportEndTime}
                        onStartChange={setSportStartTime}
                        onEndChange={setSportEndTime}
                        startLabel={<label className="text-sm font-medium">Start Time</label>}
                        endLabel={<label className="text-sm font-medium">End Time</label>}
                        stepMinutes={60}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Purpose (optional)</label>
                      <Textarea
                        rows={2}
                        value={sportPurpose}
                        onChange={(e) => setSportPurpose(e.target.value)}
                        placeholder="Practice session / match details"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Venue
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {SPORTS_VENUE_LABELS[sportVenue]}
                    </span>
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
                </div>
              </div>
              <ResourceAvailabilityCalendar resource={sportsAvailabilityResource} />
              {sportsSlotBlocked && (
                <p className="text-sm text-destructive">Slot is already booked</p>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={submitSportsBooking}
                  disabled={sportsSubmitting || sportsSlotBlocked}
                >
                  {sportsSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold">Your Past Requests</p>
            {sportsLoading ? (
            <div className="py-4">
              <BookingCardsSkeleton count={3} />
            </div>
          ) : mySportsBookings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No sports booking requests yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mySportsBookings.map((b) => (
                  <Card key={b.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{SPORT_LABELS[b.sport]}</p>
                        <Badge
                          className={
                            b.status === "approved"
                              ? "bg-accent/15 text-accent-foreground"
                              : b.status === "rejected"
                                ? "bg-destructive/10 text-destructive"
                                : b.status === "clarification_needed"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {formatGuestStatusLabel(b.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {SPORTS_VENUE_LABELS[b.venue_code]}
                      </p>
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
          </div>
        </TabsContent>

        <TabsContent value="campus" className="mt-3">
          <StudentCampusTab profile={profile} />
        </TabsContent>
        </div>
    </Tabs>
  );
}
