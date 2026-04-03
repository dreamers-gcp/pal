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
  GuestHouseBooking,
  SportsBooking,
  SportType,
  SportsVenueCode,
  FacilityBooking,
  AppointmentBooking,
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
  ChevronLeft,
  ChevronRight,
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
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeRangeSelect } from "@/components/ui/time-range-select";
import { DatePicker } from "@/components/ui/date-picker";
import { RequestCalendar } from "@/components/request-calendar";
import { AdminUnifiedAvailabilityCalendar } from "@/components/admin-unified-availability-calendar";
import { RequestCard } from "@/components/request-card";
import { CsvUpload } from "@/components/csv-upload";
import { toTitleCase, cn } from "@/lib/utils";
import { ProfessorCsvUpload } from "@/components/professor-csv-upload";
import { TimetableGenerator } from "@/components/timetable-generator";
import {
  FileSpreadsheet,
  Filter,
  BookOpen,
  Wand2,
  Download,
} from "lucide-react";
import type { ProfessorAssignment } from "@/lib/types";
import { coerceCredits, formatCreditsDisplay } from "@/lib/credits-parse";
import {
  GUEST_HOUSE_LABELS,
  roomsByFloorForGuestHouse,
} from "@/lib/guest-house";
import {
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  venuesForSport,
  isTimeOverlap,
} from "@/lib/sports-booking";
import { AdminCampusTab } from "@/components/campus/admin-campus-tab";
import {
  downloadProfessorRosterXlsx,
  downloadStudentRosterXlsx,
} from "@/lib/export-admin-roster";
import {
  DashboardShellSkeleton,
  BookingCardsSkeleton,
  RosterTableSkeleton,
} from "@/components/ui/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-accent/15 text-accent-foreground",
  rejected: "bg-destructive/10 text-destructive",
  clarification_needed: "bg-primary/10 text-primary",
};

function formatGuestStatusLabel(status: GuestHouseBooking["status"]): string {
  if (status === "clarification_needed") return "Clarification";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function bookingTooltipText(bookings: GuestHouseBooking[]): string {
  if (!bookings.length) return "";
  return bookings
    .map(
      (b) =>
        `${b.guest_name}: ${b.check_in_date} to ${b.check_out_date} (${b.requester?.full_name ?? b.requester_email ?? "Unknown"})`
    )
    .join("\n");
}

function formatSportsStatusLabel(status: SportsBooking["status"]): string {
  if (status === "clarification_needed") return "Clarification";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

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
  const [sectionNavExpanded, setSectionNavExpanded] = useState(true);
  const [guestHouseBookings, setGuestHouseBookings] = useState<GuestHouseBooking[]>([]);
  const [guestHouseLoading, setGuestHouseLoading] = useState(true);
  const [selectedGuestBooking, setSelectedGuestBooking] = useState<GuestHouseBooking | null>(null);
  const [guestAdminNote, setGuestAdminNote] = useState("");
  const [guestSelectedRoom, setGuestSelectedRoom] = useState("");
  const [guestUpdating, setGuestUpdating] = useState(false);
  const [guestStatusFilter, setGuestStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "clarification_needed" | "all"
  >("pending");
  const [availabilityGuestHouse, setAvailabilityGuestHouse] =
    useState<GuestHouseBooking["guest_house"]>("international_centre");
  const [availabilityStartDate, setAvailabilityStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [availabilityEndDate, setAvailabilityEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [availabilityFocusedRoom, setAvailabilityFocusedRoom] = useState<string | null>(null);
  const [selectedGuestFocusedRoom, setSelectedGuestFocusedRoom] = useState<string | null>(null);
  const [sportsBookings, setSportsBookings] = useState<SportsBooking[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [facilityBookings, setFacilityBookings] = useState<FacilityBooking[]>([]);
  const [appointmentBookings, setAppointmentBookings] = useState<AppointmentBooking[]>(
    []
  );
  const [facilityApptLoading, setFacilityApptLoading] = useState(true);
  const [sportsUpdatingId, setSportsUpdatingId] = useState<string | null>(null);
  const [sportsStatusFilter, setSportsStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "clarification_needed" | "all"
  >("pending");
  const [sportsAvailabilitySport, setSportsAvailabilitySport] = useState<SportType>("badminton");
  const [sportsAvailabilityDate, setSportsAvailabilityDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [sportsAvailabilityStart, setSportsAvailabilityStart] = useState("17:00");
  const [sportsAvailabilityEnd, setSportsAvailabilityEnd] = useState("18:00");

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

  const fetchGuestHouseBookings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("guest_house_bookings")
      .select("*, requester:profiles!guest_house_bookings_requester_id_fkey(*)")
      .order("created_at", { ascending: false });
    if (data) setGuestHouseBookings(data as unknown as GuestHouseBooking[]);
    setGuestHouseLoading(false);
  }, []);

  const fetchSportsBookings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sports_bookings")
      .select("*, requester:profiles!sports_bookings_requester_id_fkey(*)")
      .order("created_at", { ascending: false });
    if (data) setSportsBookings(data as unknown as SportsBooking[]);
    setSportsLoading(false);
  }, []);

  const fetchFacilityAndAppointments = useCallback(async () => {
    const supabase = createClient();
    const [facRes, aptRes] = await Promise.all([
      supabase
        .from("facility_bookings")
        .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("appointment_bookings")
        .select("*, student:profiles!appointment_bookings_student_id_fkey(*)")
        .order("created_at", { ascending: false }),
    ]);
    if (facRes.data) setFacilityBookings(facRes.data as unknown as FacilityBooking[]);
    if (aptRes.data)
      setAppointmentBookings(aptRes.data as unknown as AppointmentBooking[]);
    setFacilityApptLoading(false);
  }, []);

  const refreshUnifiedAvailability = useCallback(async () => {
    await Promise.all([
      fetchRequests(),
      fetchGuestHouseBookings(),
      fetchSportsBookings(),
      fetchFacilityAndAppointments(),
    ]);
  }, [
    fetchRequests,
    fetchGuestHouseBookings,
    fetchSportsBookings,
    fetchFacilityAndAppointments,
  ]);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    fetchProfAssignments();
    fetchClassrooms();
    fetchGuestHouseBookings();
    fetchSportsBookings();
    fetchFacilityAndAppointments();
  }, [
    fetchRequests,
    fetchStudents,
    fetchProfAssignments,
    fetchClassrooms,
    fetchGuestHouseBookings,
    fetchSportsBookings,
    fetchFacilityAndAppointments,
  ]);

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

  async function updateGuestBooking(
    booking: GuestHouseBooking,
    status: RequestStatus,
    adminNoteOverride?: string
  ) {
    setGuestUpdating(true);
    const supabase = createClient();
    const roomToSave =
      status === "approved" ? guestSelectedRoom : booking.room_number;

    if (status === "approved" && !roomToSave) {
      toast.error("Pick a room before approving.");
      setGuestUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("guest_house_bookings")
      .update({
        status,
        room_number: roomToSave ?? null,
        admin_note: (adminNoteOverride ?? guestAdminNote) || null,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      toast.error("Failed to update booking: " + error.message);
    } else {
      toast.success(
        status === "approved"
          ? "Guest house booking approved"
          : status === "rejected"
            ? "Guest house booking rejected"
            : "Guest house booking sent for clarification"
      );
      setSelectedGuestBooking(null);
      setGuestAdminNote("");
      setGuestSelectedRoom("");
      fetchGuestHouseBookings();
    }
    setGuestUpdating(false);
  }

  async function updateSportsBooking(
    booking: SportsBooking,
    status: RequestStatus
  ) {
    setSportsUpdatingId(booking.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("sports_bookings")
      .update({
        status,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
    if (error) {
      toast.error("Failed to update sports booking: " + error.message);
    } else {
      toast.success(`Sports booking ${status}.`);
      fetchSportsBookings();
    }
    setSportsUpdatingId(null);
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

  const filterGuestByStatus = (status: string) =>
    status === "all"
      ? guestHouseBookings
      : guestHouseBookings.filter((b) => b.status === status);

  const filterSportsByStatus = (status: string) =>
    status === "all"
      ? sportsBookings
      : sportsBookings.filter((b) => b.status === status);

  const unavailableRoomsForSelectedBooking = useMemo(() => {
    if (!selectedGuestBooking) return new Set<string>();
    const selected = selectedGuestBooking;
    const checkIn = new Date(selected.check_in_date).getTime();
    const checkOut = new Date(selected.check_out_date).getTime();
    const blocked = new Set(
      guestHouseBookings
        .filter((b) => b.id !== selected.id)
        .filter((b) => b.guest_house === selected.guest_house)
        .filter((b) => b.status === "approved")
        .filter((b) => !!b.room_number)
        .filter((b) => {
          const inMs = new Date(b.check_in_date).getTime();
          const outMs = new Date(b.check_out_date).getTime();
          return checkIn <= outMs && inMs <= checkOut;
        })
        .map((b) => b.room_number as string)
    );
    // For already approved requests, treat its own assigned room as booked too.
    if (selected.status === "approved" && selected.room_number) {
      blocked.add(selected.room_number);
    }
    return blocked;
  }, [guestHouseBookings, selectedGuestBooking]);

  const unavailableRoomsForAvailability = useMemo(() => {
    if (!availabilityStartDate || !availabilityEndDate) return new Set<string>();
    const checkIn = parseDateOnly(availabilityStartDate).getTime();
    const checkOut = parseDateOnly(availabilityEndDate).getTime();
    return new Set(
      guestHouseBookings
        .filter((b) => b.guest_house === availabilityGuestHouse)
        .filter((b) => b.status === "approved")
        .filter((b) => !!b.room_number)
        .filter((b) => {
          const inMs = parseDateOnly(b.check_in_date).getTime();
          const outMs = parseDateOnly(b.check_out_date).getTime();
          return checkIn <= outMs && inMs <= checkOut;
        })
        .map((b) => b.room_number as string)
    );
  }, [guestHouseBookings, availabilityGuestHouse, availabilityStartDate, availabilityEndDate]);

  const availabilitySummary = useMemo(() => {
    const totalRooms = roomsByFloorForGuestHouse(availabilityGuestHouse).flatMap((f) => f.rooms)
      .length;
    const bookedRooms = unavailableRoomsForAvailability.size;
    const availableRooms = Math.max(totalRooms - bookedRooms, 0);
    return { totalRooms, bookedRooms, availableRooms };
  }, [
    availabilityGuestHouse,
    unavailableRoomsForAvailability,
  ]);

  const selectedGuestAvailability = useMemo(() => {
    if (!selectedGuestBooking) {
      return {
        totalRooms: 0,
        bookedRooms: 0,
        availableRooms: 0,
      };
    }

    const allRooms = roomsByFloorForGuestHouse(selectedGuestBooking.guest_house)
      .flatMap((floor) => floor.rooms);
    const totalRooms = allRooms.length;
    const bookedRooms = unavailableRoomsForSelectedBooking.size;
    const availableRooms = Math.max(totalRooms - bookedRooms, 0);

    const overlappingApproved = guestHouseBookings
      .filter((b) => b.id !== selectedGuestBooking.id)
      .filter((b) => b.guest_house === selectedGuestBooking.guest_house)
      .filter((b) => b.status === "approved")
      .filter((b) => !!b.room_number);

    return { totalRooms, bookedRooms, availableRooms };
  }, [guestHouseBookings, selectedGuestBooking, unavailableRoomsForSelectedBooking]);

  const availabilityRoomBookings = useMemo(() => {
    if (!availabilityFocusedRoom) return [];
    const from = availabilityStartDate;
    const to =
      availabilityEndDate >= availabilityStartDate
        ? availabilityEndDate
        : availabilityStartDate;
    return guestHouseBookings
      .filter((b) => b.guest_house === availabilityGuestHouse)
      .filter((b) => b.status === "approved")
      .filter((b) => b.room_number === availabilityFocusedRoom)
      .filter((b) => from <= b.check_out_date && b.check_in_date <= to)
      .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
  }, [
    guestHouseBookings,
    availabilityFocusedRoom,
    availabilityGuestHouse,
    availabilityStartDate,
    availabilityEndDate,
  ]);

  const availabilityRoomBookingMap = useMemo(() => {
    const from = availabilityStartDate;
    const to =
      availabilityEndDate >= availabilityStartDate
        ? availabilityEndDate
        : availabilityStartDate;
    const map = new Map<string, GuestHouseBooking[]>();
    for (const b of guestHouseBookings) {
      if (b.guest_house !== availabilityGuestHouse) continue;
      if (b.status !== "approved" || !b.room_number) continue;
      if (!(from <= b.check_out_date && b.check_in_date <= to)) continue;
      const key = b.room_number;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [
    guestHouseBookings,
    availabilityGuestHouse,
    availabilityStartDate,
    availabilityEndDate,
  ]);

  const selectedGuestRoomBookings = useMemo(() => {
    if (!selectedGuestBooking || !selectedGuestFocusedRoom) return [];
    return guestHouseBookings
      .filter((b) => b.guest_house === selectedGuestBooking.guest_house)
      .filter((b) => b.status === "approved")
      .filter((b) => b.room_number === selectedGuestFocusedRoom)
      .filter(
        (b) =>
          selectedGuestBooking.check_in_date <= b.check_out_date &&
          b.check_in_date <= selectedGuestBooking.check_out_date
      )
      .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
  }, [guestHouseBookings, selectedGuestBooking, selectedGuestFocusedRoom]);

  const selectedGuestRoomBookingMap = useMemo(() => {
    const map = new Map<string, GuestHouseBooking[]>();
    if (!selectedGuestBooking) return map;
    for (const b of guestHouseBookings) {
      if (b.guest_house !== selectedGuestBooking.guest_house) continue;
      if (b.status !== "approved" || !b.room_number) continue;
      if (
        !(
          selectedGuestBooking.check_in_date <= b.check_out_date &&
          b.check_in_date <= selectedGuestBooking.check_out_date
        )
      ) {
        continue;
      }
      const key = b.room_number;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [guestHouseBookings, selectedGuestBooking]);

  const sportsAvailabilityBlockedMap = useMemo(() => {
    const map = new Map<SportsVenueCode, SportsBooking[]>();
    for (const b of sportsBookings) {
      if (b.status !== "approved") continue;
      if (b.sport !== sportsAvailabilitySport) continue;
      if (b.booking_date !== sportsAvailabilityDate) continue;
      if (
        !isTimeOverlap(
          sportsAvailabilityStart,
          sportsAvailabilityEnd,
          b.start_time.slice(0, 5),
          b.end_time.slice(0, 5)
        )
      ) {
        continue;
      }
      const key = b.venue_code;
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [
    sportsBookings,
    sportsAvailabilitySport,
    sportsAvailabilityDate,
    sportsAvailabilityStart,
    sportsAvailabilityEnd,
  ]);

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

  function exportStudentRoster() {
    if (filteredRoster.length === 0) {
      toast.error("No students to export for the current view.");
      return;
    }
    downloadStudentRosterXlsx(filteredRoster);
    toast.success(
      `Exported ${filteredRoster.length} student row(s) to Excel.`
    );
  }

  function exportProfessorRoster() {
    if (filteredProfRoster.length === 0) {
      toast.error("No professors to export for the current view.");
      return;
    }
    downloadProfessorRosterXlsx(filteredProfRoster);
    toast.success(
      `Exported ${filteredProfRoster.length} professor row(s) to Excel.`
    );
  }

  if (loading) {
    return <DashboardShellSkeleton variant="admin" />;
  }

  return (
    <>
    <Tabs
        defaultValue="requests"
        onValueChange={(tab) => {
          if (tab === "requests") fetchRequests();
          if (tab === "guest-house") fetchGuestHouseBookings();
          if (tab === "sports-bookings") fetchSportsBookings();
          if (tab === "professors" || tab === "prof-assignments") fetchProfAssignments();
        }}
      >
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
                  value="requests"
                  title="Requests"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Requests</span>
                </TabsTrigger>
                <TabsTrigger
                  value="enrollments"
                  title="Enrollments"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Enrollments</span>
                </TabsTrigger>
                <TabsTrigger
                  value="students"
                  title="Manage Students"
                  className={cn(
                    "relative h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Manage Students
                  </span>
                  {notSignedUpCount > 0 && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full bg-destructive font-bold text-white",
                        sectionNavExpanded
                          ? "ml-1 inline-flex h-5 min-w-5 items-center justify-center px-1 text-[10px]"
                          : "absolute right-0.5 top-1 h-2 w-2 min-w-2 p-0 text-[0px]"
                      )}
                      aria-hidden={!sectionNavExpanded}
                    >
                      {sectionNavExpanded ? notSignedUpCount : ""}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="prof-assignments"
                  title="Professor Assignments"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Professor Assignments
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="professors"
                  title="Manage Professors"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Manage Professors
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="timetable"
                  title="Timetable"
                  className={cn(
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>Timetable</span>
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
                Admin Dashboard
              </h1>
              <p className="mt-1 text-muted-foreground">
                Welcome, {profile.full_name}. Review requests and manage students.
              </p>
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
                      value="requests"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Requests
                    </TabsTrigger>
                    <TabsTrigger
                      value="enrollments"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Enrollments
                    </TabsTrigger>
                    <TabsTrigger
                      value="students"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Manage Students
                      {notSignedUpCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white font-bold">
                          {notSignedUpCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="prof-assignments"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <BookOpen className="h-4 w-4" />
                      Professor Assignments
                    </TabsTrigger>
                    <TabsTrigger
                      value="professors"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
                      <Users className="h-4 w-4" />
                      Manage Professors
                    </TabsTrigger>
                    <TabsTrigger
                      value="timetable"
                      className="w-full justify-start gap-1.5"
                      onClick={() => setTabMenuOpen(false)}
                    >
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
                Requests
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
          <Tabs defaultValue="unified-availability" className="gap-3">
            <TabsList className="flex w-full flex-wrap gap-1.5">
              <TabsTrigger
                value="unified-availability"
                className="h-auto min-h-10 min-w-[10.5rem] flex-1 basis-[min(100%,12rem)] whitespace-normal px-3 py-2 text-center text-sm leading-snug data-[active]:text-inherit"
              >
                All availability
              </TabsTrigger>
              <TabsTrigger
                value="event-requests"
                className="h-auto min-h-10 min-w-[10.5rem] flex-1 basis-[min(100%,12rem)] whitespace-normal px-3 py-2 text-center text-sm leading-snug data-[active]:text-inherit"
              >
                Event Requests
              </TabsTrigger>
              <TabsTrigger
                value="guest-house-requests"
                className="h-auto min-h-10 min-w-[10.5rem] flex-1 basis-[min(100%,12rem)] whitespace-normal px-3 py-2 text-center text-sm leading-snug data-[active]:text-inherit"
              >
                Guest House Requests
              </TabsTrigger>
              <TabsTrigger
                value="sports-requests"
                className="h-auto min-h-10 min-w-[10.5rem] flex-1 basis-[min(100%,12rem)] whitespace-normal px-3 py-2 text-center text-sm leading-snug data-[active]:text-inherit"
              >
                Sports Requests
              </TabsTrigger>
              <TabsTrigger
                value="campus-requests"
                className="h-auto min-h-10 min-w-[10.5rem] flex-1 basis-[min(100%,12rem)] whitespace-normal px-3 py-2 text-center text-sm leading-snug data-[active]:text-inherit"
              >
                Campus &amp; leave
              </TabsTrigger>
            </TabsList>
            <TabsContent value="unified-availability" className="space-y-4">
              <AdminUnifiedAvailabilityCalendar
                calendarRequests={requests}
                guestHouseBookings={guestHouseBookings}
                sportsBookings={sportsBookings}
                facilityBookings={facilityBookings}
                appointmentBookings={appointmentBookings}
                classrooms={classrooms}
                loading={
                  loading ||
                  guestHouseLoading ||
                  sportsLoading ||
                  facilityApptLoading
                }
                onRefresh={refreshUnifiedAvailability}
              />
            </TabsContent>
            <TabsContent value="event-requests" className="space-y-6">
          <Tabs defaultValue="approvals" className="gap-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
            </TabsList>

            <TabsContent value="approvals" className="space-y-6">
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

            <TabsContent value="availability" className="space-y-4">
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
                    : "No event requests yet."
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
          </Tabs>
            </TabsContent>

        {/* ========== GUEST HOUSE TAB ========== */}
        <TabsContent value="guest-house-requests" className="space-y-6">
          <Tabs defaultValue="approvals" className="gap-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approvals">Approval Status</TabsTrigger>
              <TabsTrigger value="availability">Room Availability</TabsTrigger>
            </TabsList>

            <TabsContent value="approvals" className="space-y-6">
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Pending", value: "pending", color: "text-yellow-700", chip: "bg-yellow-100" },
                    { label: "Approved", value: "approved", color: "text-accent-foreground", chip: "bg-accent/20" },
                    { label: "Rejected", value: "rejected", color: "text-destructive", chip: "bg-destructive/10" },
                    { label: "Clarification", value: "clarification_needed", color: "text-primary", chip: "bg-primary/10" },
                  ].map((stat) => (
                    <button
                      key={stat.value}
                      type="button"
                      onClick={() => setGuestStatusFilter(stat.value as typeof guestStatusFilter)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                        guestStatusFilter === stat.value
                          ? "border-primary/50 bg-primary/5"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}>
                        {filterGuestByStatus(stat.value).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {guestHouseLoading ? (
                <div className="py-6">
                  <BookingCardsSkeleton count={4} />
                </div>
              ) : filterGuestByStatus(guestStatusFilter).length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No guest house bookings in this status.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterGuestByStatus(guestStatusFilter).map((b) => (
                    <Card
                      key={b.id}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => {
                        setSelectedGuestBooking(b);
                        setGuestAdminNote(b.admin_note ?? "");
                        setGuestSelectedRoom(b.room_number ?? "");
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{b.guest_name}</CardTitle>
                          <Badge className={statusColors[b.status] ?? "bg-muted text-foreground"}>
                            {formatGuestStatusLabel(b.status)}
                          </Badge>
                        </div>
                        <CardDescription>
                          {GUEST_HOUSE_LABELS[b.guest_house]}
                          {b.room_number ? ` • Room ${b.room_number}` : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          {b.check_in_date} to {b.check_out_date}
                        </p>
                        <p>{b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}</p>
                        {b.purpose && <p className="line-clamp-2">{b.purpose}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="availability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Room Availability</CardTitle>
                  <CardDescription>
                    Pick guest house and date range to inspect blocked vs available rooms.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-xl border p-4 space-y-4">
                      <p className="text-sm font-semibold">Availability Details</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-3">
                          <Label>Guest House</Label>
                          <Select
                            value={availabilityGuestHouse}
                            onValueChange={(v) =>
                              setAvailabilityGuestHouse(v as GuestHouseBooking["guest_house"])
                            }
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {GUEST_HOUSE_LABELS[availabilityGuestHouse]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="international_centre">International Centre</SelectItem>
                              <SelectItem value="mdp_building">MDP Building</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>From</Label>
                              <DatePicker
                                value={availabilityStartDate}
                                onChange={setAvailabilityStartDate}
                                placeholder="Pick date"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>To</Label>
                              <DatePicker
                                value={availabilityEndDate}
                                onChange={setAvailabilityEndDate}
                                min={availabilityStartDate}
                                placeholder="Pick date"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border bg-emerald-500/10 px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">Available</p>
                          <p className="text-sm font-semibold text-emerald-700">
                            {availabilitySummary.availableRooms}
                          </p>
                        </div>
                        <div className="rounded-md border bg-amber-500/10 px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">Booked</p>
                          <p className="text-sm font-semibold text-amber-700">
                            {availabilitySummary.bookedRooms}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">Total Rooms</p>
                          <p className="text-sm font-semibold">{availabilitySummary.totalRooms}</p>
                        </div>
                      </div>

                      {availabilityFocusedRoom && (
                        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                          <p className="text-xs font-semibold">
                            Bookings for Room {availabilityFocusedRoom}
                          </p>
                          {availabilityRoomBookings.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No approved bookings overlap the selected dates.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {availabilityRoomBookings.map((b) => (
                                <div key={b.id} className="rounded-md border bg-background px-2 py-1.5 text-xs">
                                  <p className="font-medium">{b.guest_name}</p>
                                  <p className="text-muted-foreground">
                                    {b.check_in_date} to {b.check_out_date}
                                    {" • "}
                                    {b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Room Selection</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                          Booked
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-600/70" />
                          Available
                        </span>
                      </div>
                      <div className="rounded-lg border p-3 space-y-3">
                        {roomsByFloorForGuestHouse(availabilityGuestHouse).map((section) => (
                          <div key={section.floor} className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Floor {section.floor}
                            </p>
                            <div className="grid grid-cols-8 gap-1">
                              {section.rooms.map((room) => {
                                const blocked = unavailableRoomsForAvailability.has(room);
                                const roomBookings = availabilityRoomBookingMap.get(room) ?? [];
                                return (
                                  <button
                                    key={room}
                                    type="button"
                                    onMouseEnter={() =>
                                      blocked ? setAvailabilityFocusedRoom(room) : undefined
                                    }
                                    onFocus={() =>
                                      blocked ? setAvailabilityFocusedRoom(room) : undefined
                                    }
                                    onClick={() =>
                                      blocked ? setAvailabilityFocusedRoom(room) : undefined
                                    }
                                    title={blocked ? bookingTooltipText(roomBookings) : undefined}
                                    className={`rounded border px-1 py-1 text-center text-[11px] font-medium ${
                                      blocked
                                        ? "border-muted bg-muted/40 text-muted-foreground line-through"
                                        : "border-emerald-700/40 bg-emerald-600/10 text-emerald-800"
                                    }`}
                                  >
                                    {room}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="sports-requests" className="space-y-6">
          <Tabs defaultValue="approvals" className="gap-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approvals">Approval Status</TabsTrigger>
              <TabsTrigger value="availability">Venue Availability</TabsTrigger>
            </TabsList>

            <TabsContent value="approvals" className="space-y-4">
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Pending", value: "pending", color: "text-yellow-700", chip: "bg-yellow-100" },
                    { label: "Approved", value: "approved", color: "text-accent-foreground", chip: "bg-accent/20" },
                    { label: "Rejected", value: "rejected", color: "text-destructive", chip: "bg-destructive/10" },
                    { label: "Clarification", value: "clarification_needed", color: "text-primary", chip: "bg-primary/10" },
                  ].map((stat) => (
                    <button
                      key={stat.value}
                      type="button"
                      onClick={() => setSportsStatusFilter(stat.value as typeof sportsStatusFilter)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                        sportsStatusFilter === stat.value
                          ? "border-primary/50 bg-primary/5"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}>
                        {filterSportsByStatus(stat.value).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {sportsLoading ? (
                <div className="py-6">
                  <BookingCardsSkeleton count={4} />
                </div>
              ) : filterSportsByStatus(sportsStatusFilter).length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No sports bookings in this status.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterSportsByStatus(sportsStatusFilter).map((b) => (
                    <Card key={b.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{SPORT_LABELS[b.sport]}</CardTitle>
                          <Badge className={statusColors[b.status] ?? "bg-muted text-foreground"}>
                            {formatSportsStatusLabel(b.status)}
                          </Badge>
                        </div>
                        <CardDescription>
                          {SPORTS_VENUE_LABELS[b.venue_code]} • {b.booking_date}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                        </p>
                        <p>{b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}</p>
                        {b.purpose && <p className="text-foreground">{b.purpose}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sportsUpdatingId === b.id}
                            onClick={() => updateSportsBooking(b, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sportsUpdatingId === b.id}
                            onClick={() => updateSportsBooking(b, "rejected")}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sportsUpdatingId === b.id}
                            onClick={() => updateSportsBooking(b, "clarification_needed")}
                          >
                            Clarify
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="availability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Venue Availability</CardTitle>
                  <CardDescription>
                    Select sport, date and time to see booked vs available courts/ground.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-xl border p-4 space-y-4">
                      <p className="text-sm font-semibold">Availability Details</p>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label>Sport</Label>
                          <Select
                            value={sportsAvailabilitySport}
                            onValueChange={(v) => setSportsAvailabilitySport(v as SportType)}
                          >
                            <SelectTrigger>
                              <SelectValue>{SPORT_LABELS[sportsAvailabilitySport]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="badminton">Badminton</SelectItem>
                              <SelectItem value="cricket">Cricket</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Date</Label>
                          <DatePicker
                            value={sportsAvailabilityDate}
                            onChange={setSportsAvailabilityDate}
                            placeholder="Pick date"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <TimeRangeSelect
                            startValue={sportsAvailabilityStart}
                            endValue={sportsAvailabilityEnd}
                            onStartChange={setSportsAvailabilityStart}
                            onEndChange={setSportsAvailabilityEnd}
                            startLabel={<Label>Start Time</Label>}
                            endLabel={<Label>End Time</Label>}
                            stepMinutes={60}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Venue Selection</p>
                        <span className="text-xs text-muted-foreground">
                          {SPORT_LABELS[sportsAvailabilitySport]}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {venuesForSport(sportsAvailabilitySport).map((venue) => {
                          const bookings = sportsAvailabilityBlockedMap.get(venue) ?? [];
                          const blocked = bookings.length > 0;
                          return (
                            <div
                              key={venue}
                              className={`rounded-lg border px-3 py-2 text-sm ${
                                blocked
                                  ? "border-muted bg-muted/40 text-muted-foreground"
                                  : "border-emerald-700/40 bg-emerald-600/10 text-emerald-800"
                              }`}
                              title={
                                blocked
                                  ? bookings
                                      .map(
                                        (b) =>
                                          `${b.requester?.full_name ?? b.requester_email ?? "Unknown"}: ${b.start_time.slice(0, 5)}-${b.end_time.slice(0, 5)}`
                                      )
                                      .join("\n")
                                  : ""
                              }
                            >
                              <p className="font-medium">{SPORTS_VENUE_LABELS[venue]}</p>
                              <p className="text-xs">{blocked ? "Booked" : "Available"}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="campus-requests" className="space-y-6">
          <AdminCampusTab profile={profile} />
        </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ========== ENROLLMENTS TAB ========== */}
        <TabsContent value="enrollments" className="mt-6">
          <CsvUpload />
        </TabsContent>

        {/* ========== STUDENTS TAB ========== */}
        <TabsContent value="students" className="mt-6 space-y-6">
          {studentsLoading ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
              <RosterTableSkeleton rows={10} />
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

              {/* Filters + export */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  {enrollments.length > 0 ? (
                    <>
                      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
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
                          type="button"
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
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No enrollment CSV loaded — roster lists signed-up students only. Export includes everyone shown below.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={filteredRoster.length === 0}
                  onClick={exportStudentRoster}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export Excel
                </Button>
              </div>

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
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
              <RosterTableSkeleton rows={10} />
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

              {/* Filters + export */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
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
                      type="button"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={filteredProfRoster.length === 0}
                  onClick={exportProfessorRoster}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export Excel
                </Button>
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
        </div>
    </Tabs>

      {/* Guest house review sidebar */}
      {selectedGuestBooking && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => {
              setSelectedGuestBooking(null);
              setGuestAdminNote("");
              setGuestSelectedRoom("");
            }}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label="Review guest house booking"
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedGuestBooking(null);
                  setGuestAdminNote("");
                  setGuestSelectedRoom("");
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-3">
              <div className="pt-2">
                <h2 className="text-lg font-semibold">{selectedGuestBooking.guest_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {GUEST_HOUSE_LABELS[selectedGuestBooking.guest_house]}
                </p>
              </div>
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="text-muted-foreground">Requested by:</span>{" "}
                  {selectedGuestBooking.requester?.full_name ??
                    selectedGuestBooking.requester_email ??
                    "Unknown"}
                </p>
                <p>
                  <span className="text-muted-foreground">Stay:</span>{" "}
                  {selectedGuestBooking.check_in_date} to{" "}
                  {selectedGuestBooking.check_out_date}
                </p>
                {selectedGuestBooking.purpose && (
                  <p>
                    <span className="text-muted-foreground">Purpose:</span>{" "}
                    {selectedGuestBooking.purpose}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Availability Overview</Label>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border bg-emerald-500/10 px-2 py-1.5">
                      <p className="text-[11px] text-muted-foreground">Available</p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {selectedGuestAvailability.availableRooms}
                      </p>
                    </div>
                    <div className="rounded-md border bg-amber-500/10 px-2 py-1.5">
                      <p className="text-[11px] text-muted-foreground">Booked</p>
                      <p className="text-sm font-semibold text-amber-700">
                        {selectedGuestAvailability.bookedRooms}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted px-2 py-1.5">
                      <p className="text-[11px] text-muted-foreground">Total rooms</p>
                      <p className="text-sm font-semibold">
                        {selectedGuestAvailability.totalRooms}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="space-y-2">
                <Label>Room (required for approval)</Label>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary/70" />
                      Selected
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                      Booked for This Stay
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-600/70" />
                      Available
                    </span>
                  </div>
                  {roomsByFloorForGuestHouse(selectedGuestBooking.guest_house).map((section) => (
                    <div key={section.floor} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Floor {section.floor}
                      </p>
                      <div className="grid grid-cols-8 gap-1">
                        {section.rooms.map((room) => {
                          const unavailable =
                            unavailableRoomsForSelectedBooking.has(room);
                          const roomBookings = selectedGuestRoomBookingMap.get(room) ?? [];
                          const selected =
                            selectedGuestBooking.status !== "approved" &&
                            guestSelectedRoom === room;
                          return (
                            <button
                              key={room}
                              type="button"
                              onMouseEnter={() =>
                                unavailable ? setSelectedGuestFocusedRoom(room) : undefined
                              }
                              onFocus={() =>
                                unavailable ? setSelectedGuestFocusedRoom(room) : undefined
                              }
                              onClick={() => {
                                if (unavailable) {
                                  setSelectedGuestFocusedRoom(room);
                                } else {
                                  setGuestSelectedRoom(room);
                                  setSelectedGuestFocusedRoom(null);
                                }
                              }}
                              title={unavailable ? bookingTooltipText(roomBookings) : undefined}
                              className={`rounded border px-1 py-1 text-[11px] font-medium transition-colors ${
                                unavailable
                                  ? "border-muted bg-muted/40 text-muted-foreground line-through"
                                  : selected
                                    ? "border-primary/70 bg-primary/10 text-primary"
                                    : "border-emerald-700/40 bg-emerald-600/10 text-emerald-800 hover:bg-emerald-600/20"
                              }`}
                            >
                              {room}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedGuestFocusedRoom && (
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-semibold">
                      Bookings for Room {selectedGuestFocusedRoom}
                    </p>
                    {selectedGuestRoomBookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No approved bookings overlap this request stay.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedGuestRoomBookings.map((b) => (
                          <div key={b.id} className="rounded-md border bg-background px-2 py-1.5 text-xs">
                            <p className="font-medium">{b.guest_name}</p>
                            <p className="text-muted-foreground">
                              {b.check_in_date} to {b.check_out_date}
                              {" • "}
                              {b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Admin note (optional)</Label>
                <Textarea
                  rows={3}
                  value={guestAdminNote}
                  onChange={(e) => setGuestAdminNote(e.target.value)}
                  placeholder="Add note for requester..."
                />
              </div>
            </div>
            <div className="shrink-0 border-t p-4 bg-background">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    updateGuestBooking(selectedGuestBooking, "approved")
                  }
                  disabled={guestUpdating}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[100px] rounded-full border-emerald-500/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Approve
                </Button>
                <Button
                  onClick={() =>
                    updateGuestBooking(selectedGuestBooking, "rejected")
                  }
                  disabled={guestUpdating}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[100px] rounded-full border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <X className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  Reject
                </Button>
                <Button
                  onClick={() =>
                    updateGuestBooking(selectedGuestBooking, "clarification_needed")
                  }
                  disabled={guestUpdating}
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
    </>
  );
}

