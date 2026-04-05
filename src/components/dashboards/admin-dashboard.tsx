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
  GuestHouseCode,
  GuestHouseRoomAllocation,
  SportsBooking,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ChevronDown,
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
import { DatePicker } from "@/components/ui/date-picker";
import { RequestCard } from "@/components/request-card";
import { CsvUpload } from "@/components/csv-upload";
import { cn, formatSubmittedAt, sortByCreatedAtAsc, toTitleCase } from "@/lib/utils";
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
import { decodeCalendarRequestSubjects } from "@/lib/calendar-request-subject";
import {
  GUEST_HOUSE_LABELS,
  GUEST_HOUSE_CODES,
  roomsByFloorForGuestHouse,
  allocatedRoomsForBooking,
  guestRoomKey,
  roomsNeededForGuestCount,
  MAX_GUESTS_PER_ROOM,
  TOTAL_GUEST_HOUSE_ROOM_COUNT,
} from "@/lib/guest-house";
import { SPORT_LABELS, SPORTS_VENUE_LABELS } from "@/lib/sports-booking";
import { AdminCampusApprovalSection } from "@/components/campus/admin-campus-tab";
import { AdminRequestSchedulePanel } from "@/components/admin/admin-request-schedule-panel";
import { GuestHouseAllocationReadout } from "@/components/guest-house-allocation-readout";
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

const ADMIN_REQUEST_SUBTABS: { value: string; label: string }[] = [
  { value: "request-event-requests", label: "Event requests" },
  { value: "request-guest-house-requests", label: "Guest house" },
  { value: "request-sports-requests", label: "Sports" },
  { value: "request-campus-leave", label: "Student leave" },
  { value: "request-campus-facilities", label: "Campus facilities" },
  { value: "request-campus-mess", label: "Mess requests" },
  { value: "request-campus-health", label: "Health appointments" },
];

function isAdminRequestTab(tab: string) {
  return tab.startsWith("request-");
}

export function AdminDashboard({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<CalendarRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [assignedHall, setAssignedHall] = useState("");
  const [adminSpoc, setAdminSpoc] = useState("");
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
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [sectionNavExpanded, setSectionNavExpanded] = useState(true);
  const [adminMainTab, setAdminMainTab] = useState("request-event-requests");
  const [adminRequestsNavOpen, setAdminRequestsNavOpen] = useState(true);
  const [guestHouseBookings, setGuestHouseBookings] = useState<GuestHouseBooking[]>([]);
  const [guestHouseLoading, setGuestHouseLoading] = useState(true);
  const [selectedGuestBooking, setSelectedGuestBooking] = useState<GuestHouseBooking | null>(null);
  const [guestAdminNote, setGuestAdminNote] = useState("");
  const [guestSelectedAllocations, setGuestSelectedAllocations] = useState<
    GuestHouseRoomAllocation[]
  >([]);
  const [guestUpdating, setGuestUpdating] = useState(false);
  const [guestStatusFilter, setGuestStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "clarification_needed" | "all"
  >("pending");
  const [selectedGuestFocusKey, setSelectedGuestFocusKey] = useState<string | null>(
    null
  );
  const [sportsBookings, setSportsBookings] = useState<SportsBooking[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsUpdatingId, setSportsUpdatingId] = useState<string | null>(null);
  const [sportsStatusFilter, setSportsStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "clarification_needed" | "all"
  >("pending");

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

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    fetchProfAssignments();
    fetchClassrooms();
    fetchGuestHouseBookings();
    fetchSportsBookings();
  }, [
    fetchRequests,
    fetchStudents,
    fetchProfAssignments,
    fetchClassrooms,
    fetchGuestHouseBookings,
    fetchSportsBookings,
  ]);

  async function updateRequest(
    id: string,
    status: RequestStatus,
    opts?: {
      adminNoteOverride?: string;
      assignedHall?: string;
      adminSpoc?: string;
    }
  ) {
    const note = opts?.adminNoteOverride ?? adminNote;
    const hall = opts?.assignedHall?.trim() ?? "";
    const spoc = opts?.adminSpoc?.trim() ?? "";

    if (status === "approved") {
      if (!hall || !spoc) {
        toast.error("Assigned hall and Admin SPOC are required to approve.");
        return;
      }
    }

    setUpdating(true);
    const supabase = createClient();

    const patch: Record<string, unknown> = {
      status,
      admin_note: note || null,
      reviewed_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    if (status === "approved") {
      patch.assigned_hall = hall;
      patch.admin_spoc = spoc;
    }

    const { error } = await supabase
      .from("calendar_requests")
      .update(patch)
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
    setAssignedHall("");
    setAdminSpoc("");
    fetchRequests();
  }

  async function updateGuestBooking(
    booking: GuestHouseBooking,
    status: RequestStatus,
    adminNoteOverride?: string
  ) {
    setGuestUpdating(true);
    const supabase = createClient();
    const guestCount = booking.guest_count ?? 1;
    const minRooms = roomsNeededForGuestCount(guestCount);

    if (status === "approved") {
      if (guestSelectedAllocations.length < minRooms) {
        toast.error(
          `Select at least ${minRooms} room(s) for ${guestCount} guest(s) (max ${MAX_GUESTS_PER_ROOM} guests per room).`
        );
        setGuestUpdating(false);
        return;
      }
      const capacity = guestSelectedAllocations.length * MAX_GUESTS_PER_ROOM;
      if (capacity < guestCount) {
        toast.error(
          `Selected rooms fit at most ${capacity} guests; this request needs capacity for ${guestCount}.`
        );
        setGuestUpdating(false);
        return;
      }
    }

    const firstAlloc = guestSelectedAllocations[0];
    const { error } = await supabase
      .from("guest_house_bookings")
      .update({
        status,
        allocated_rooms:
          status === "approved" ? guestSelectedAllocations : null,
        guest_house:
          status === "approved" && firstAlloc ? firstAlloc.guest_house : null,
        room_number:
          status === "approved" && firstAlloc ? firstAlloc.room_number : null,
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
      setGuestSelectedAllocations([]);
      setSelectedGuestFocusKey(null);
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
    const blocked = new Set<string>();

    const overlapsStay = (b: GuestHouseBooking) =>
      selected.check_in_date <= b.check_out_date &&
      b.check_in_date <= selected.check_out_date;

    for (const b of guestHouseBookings) {
      if (b.id === selected.id) continue;
      if (b.status !== "approved") continue;
      if (!overlapsStay(b)) continue;
      for (const a of allocatedRoomsForBooking(b)) {
        blocked.add(guestRoomKey(a.guest_house, a.room_number));
      }
    }
    if (selected.status === "approved") {
      for (const a of allocatedRoomsForBooking(selected)) {
        blocked.add(guestRoomKey(a.guest_house, a.room_number));
      }
    }
    return blocked;
  }, [guestHouseBookings, selectedGuestBooking]);

  const selectedGuestAvailability = useMemo(() => {
    if (!selectedGuestBooking) {
      return {
        totalRooms: 0,
        bookedRooms: 0,
        availableRooms: 0,
      };
    }
    const totalRooms = TOTAL_GUEST_HOUSE_ROOM_COUNT;
    const bookedRooms = unavailableRoomsForSelectedBooking.size;
    const availableRooms = Math.max(totalRooms - bookedRooms, 0);

    return { totalRooms, bookedRooms, availableRooms };
  }, [selectedGuestBooking, unavailableRoomsForSelectedBooking]);

  const selectedGuestRoomBookingMap = useMemo(() => {
    const map = new Map<string, GuestHouseBooking[]>();
    if (!selectedGuestBooking) return map;
    for (const b of guestHouseBookings) {
      if (b.status !== "approved") continue;
      if (
        !(
          selectedGuestBooking.check_in_date <= b.check_out_date &&
          b.check_in_date <= selectedGuestBooking.check_out_date
        )
      ) {
        continue;
      }
      for (const a of allocatedRoomsForBooking(b)) {
        const key = guestRoomKey(a.guest_house, a.room_number);
        const arr = map.get(key) ?? [];
        arr.push(b);
        map.set(key, arr);
      }
    }
    return map;
  }, [guestHouseBookings, selectedGuestBooking]);

  const selectedGuestRoomBookings = useMemo(() => {
    if (!selectedGuestBooking || !selectedGuestFocusKey) return [];
    return selectedGuestRoomBookingMap.get(selectedGuestFocusKey) ?? [];
  }, [selectedGuestRoomBookingMap, selectedGuestBooking, selectedGuestFocusKey]);

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
        value={adminMainTab}
        onValueChange={(tab) => {
          setAdminMainTab(tab);
          if (isAdminRequestTab(tab)) {
            fetchRequests();
            if (tab === "request-guest-house-requests") fetchGuestHouseBookings();
            if (tab === "request-sports-requests") fetchSportsBookings();
          }
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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
              <div className="flex flex-col gap-0.5 rounded-lg">
                <div className="flex flex-col gap-0.5">
                  {sectionNavExpanded ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setAdminRequestsNavOpen((o) => !o)}
                        className={cn(
                          "inline-flex h-auto min-h-10 w-full items-center gap-2 rounded-md py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "justify-start px-2 text-left"
                        )}
                        aria-expanded={adminRequestsNavOpen}
                      >
                        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">Requests</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            adminRequestsNavOpen && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </button>
                      {adminRequestsNavOpen && (
                        <TabsList className="flex flex-col items-stretch gap-0.5 border-0 bg-transparent p-0 pl-1">
                          {ADMIN_REQUEST_SUBTABS.map((item) => (
                            <TabsTrigger
                              key={item.value}
                              value={item.value}
                              title={item.label}
                              className={cn(
                                "h-auto min-h-9 w-full rounded-md border-l-2 border-transparent py-2 text-[13px] font-medium data-[active]:shadow-none",
                                "justify-start whitespace-normal pl-4 pr-2 text-left data-[active]:border-primary/40"
                              )}
                            >
                              {item.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      title="Requests"
                      onClick={() => {
                        setSectionNavExpanded(true);
                        setAdminRequestsNavOpen(true);
                        if (!isAdminRequestTab(adminMainTab)) {
                          setAdminMainTab("request-event-requests");
                        }
                      }}
                      className={cn(
                        "inline-flex h-auto min-h-10 w-full items-center justify-center rounded-md py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isAdminRequestTab(adminMainTab) &&
                          "bg-primary/15 text-primary dark:bg-primary/20"
                      )}
                    >
                      <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="sr-only">Requests</span>
                    </button>
                  )}
                </div>
                <TabsList className="mt-0.5 flex h-auto w-full flex-col items-stretch gap-0.5 rounded-lg border-0 bg-transparent p-0">
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
                    "h-auto min-h-10 w-full rounded-md py-2.5",
                    sectionNavExpanded
                      ? "justify-start gap-2 whitespace-normal px-2 text-left"
                      : "justify-center px-0"
                  )}
                >
                  <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(!sectionNavExpanded && "sr-only")}>
                    Manage Students
                  </span>
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
          </div>
        </aside>

        <div
          className={cn(
            "min-w-0 space-y-6 transition-[margin] duration-200 ease-out",
            sectionNavExpanded ? "md:ml-56" : "md:ml-14"
          )}
        >
            <div>
              <h1 className="font-display text-2xl font-normal tracking-tight text-foreground break-words sm:text-3xl">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-muted-foreground">
                Welcome, {profile.full_name}. Review requests and manage students.
              </p>
            </div>

            {tabMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[45] bg-black/20 md:hidden"
                  aria-hidden
                  onClick={() => setTabMenuOpen(false)}
                />
                <aside
                  className="fixed left-0 top-16 bottom-0 z-[60] flex w-72 max-w-[80vw] flex-col border-r bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-left duration-200 md:hidden"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Section navigation"
                >
                  <div className="mb-3 flex shrink-0 justify-end border-b border-border pb-2">
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
                  <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      onClick={() => setAdminRequestsNavOpen((o) => !o)}
                      aria-expanded={adminRequestsNavOpen}
                    >
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-4 w-4 shrink-0" />
                        Requests
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          adminRequestsNavOpen && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                    {adminRequestsNavOpen && (
                      <TabsList className="flex flex-col items-stretch gap-0.5 border-0 bg-transparent p-0 pl-2">
                        {ADMIN_REQUEST_SUBTABS.map((item) => (
                          <TabsTrigger
                            key={item.value}
                            value={item.value}
                            className="w-full justify-start gap-1.5 py-2 pl-4 text-[13px]"
                            onClick={() => setTabMenuOpen(false)}
                          >
                            {item.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    )}
                    <TabsList className="flex h-auto w-full flex-col items-stretch gap-0.5 border-0 bg-transparent p-0">
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
                  </div>
                </aside>
              </>
            )}
            <TabsList className="hidden">
              {ADMIN_REQUEST_SUBTABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  {item.label}
                </TabsTrigger>
              ))}
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

        {/* Request sections — primary nav is the sidebar under Requests */}
        <TabsContent value="request-event-requests" className="mt-6 space-y-6">
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              {sortByCreatedAtAsc(filterByStatus(requestStatusFilter)).length === 0 ? (
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
                  {sortByCreatedAtAsc(filterByStatus(requestStatusFilter)).map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      showProfessor
                      onClick={() => {
                        setSelectedRequest(req);
                        setAdminNote(req.admin_note ?? "");
                        setAssignedHall(req.assigned_hall ?? "");
                        setAdminSpoc(req.admin_spoc ?? "");
                      }}
                    />
                  ))}
                </div>
              )}
              <AdminRequestSchedulePanel
                mode="event"
                classrooms={classrooms}
                className="mt-8 border-t border-border/80 pt-6"
              />
            </TabsContent>

        {/* ========== GUEST HOUSE TAB ========== */}
        <TabsContent value="request-guest-house-requests" className="mt-6 space-y-6">
          <Tabs defaultValue="guest-house-approvals" className="w-full min-w-0 max-w-full">
            <TabsList className="mb-6 flex h-auto w-full min-h-10 p-0">
              <TabsTrigger value="guest-house-approvals" className="flex-1 rounded-none py-2.5">
                Approvals
              </TabsTrigger>
              <TabsTrigger value="guest-house-availability" className="flex-1 rounded-none py-2.5">
                Availability
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guest-house-approvals" className="space-y-6">
                <div className="rounded-xl border bg-muted/25 p-2.5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                ) : sortByCreatedAtAsc(filterGuestByStatus(guestStatusFilter)).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No guest house bookings in this status.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sortByCreatedAtAsc(filterGuestByStatus(guestStatusFilter)).map((b) => (
                      <Card
                        key={b.id}
                        className="cursor-pointer transition-shadow hover:shadow-md"
                        onClick={() => {
                          setSelectedGuestBooking(b);
                          setGuestAdminNote(b.admin_note ?? "");
                          setGuestSelectedAllocations(
                            b.status === "approved" ? allocatedRoomsForBooking(b) : []
                          );
                          setSelectedGuestFocusKey(null);
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
                            {b.guest_count ?? 1} guest(s) ·{" "}
                            {b.requested_room_count ??
                              roomsNeededForGuestCount(b.guest_count ?? 1)}{" "}
                            room(s) requested (min{" "}
                            {roomsNeededForGuestCount(b.guest_count ?? 1)})
                            {b.status === "pending" ? " · Awaiting allocation" : ""}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                          {b.status === "approved" && (
                            <GuestHouseAllocationReadout booking={b} compact />
                          )}
                          <p>
                            {b.check_in_date} to {b.check_out_date}
                          </p>
                          <p>{b.requester?.full_name ?? b.requester_email ?? "Unknown requester"}</p>
                          {b.purpose && <p className="line-clamp-2">{b.purpose}</p>}
                          <p className="text-xs text-muted-foreground">
                            Submitted at {formatSubmittedAt(b.created_at)}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
            </TabsContent>

            <TabsContent value="guest-house-availability" className="space-y-6">
              <AdminRequestSchedulePanel mode="guest_house" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="request-sports-requests" className="mt-6 space-y-6">
          <div className="space-y-6">
              <div className="rounded-xl border bg-muted/25 p-2.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              ) : sortByCreatedAtAsc(filterSportsByStatus(sportsStatusFilter)).length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No sports bookings in this status.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortByCreatedAtAsc(filterSportsByStatus(sportsStatusFilter)).map((b) => (
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
                        <p className="text-xs text-muted-foreground">
                          Submitted at {formatSubmittedAt(b.created_at)}
                        </p>
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
          </div>
          <AdminRequestSchedulePanel
            mode="sports"
            className="mt-8 border-t border-border/80 pt-6"
          />
        </TabsContent>

        <TabsContent value="request-campus-leave" className="mt-6 space-y-6">
          <AdminCampusApprovalSection profile={profile} kind="leave" />
        </TabsContent>
        <TabsContent value="request-campus-facilities" className="mt-6 space-y-6">
          <AdminCampusApprovalSection profile={profile} kind="facilities" />
          <AdminRequestSchedulePanel
            mode="facility"
            className="mt-8 border-t border-border/80 pt-6"
          />
        </TabsContent>
        <TabsContent value="request-campus-mess" className="mt-6 space-y-6">
          <AdminCampusApprovalSection profile={profile} kind="mess" />
        </TabsContent>
        <TabsContent value="request-campus-health" className="mt-6 space-y-6">
          <AdminCampusApprovalSection profile={profile} kind="health" />
          <AdminRequestSchedulePanel mode="health" className="mt-8 border-t border-border/80 pt-6" />
        </TabsContent>

        {/* ========== ENROLLMENTS TAB ========== */}
        <TabsContent value="enrollments" className="mt-6">
          <CsvUpload />
        </TabsContent>

        {/* ========== STUDENTS TAB ========== */}
        <TabsContent value="students" className="mt-6 space-y-6">
          {studentsLoading ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

              {/* Student roster list — horizontal scroll on narrow screens */}
              <div className="rounded-lg border bg-white overflow-x-auto">
                <div className="min-w-[720px]">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

              {/* Professor roster list — horizontal scroll on narrow screens */}
              <div className="rounded-lg border bg-white overflow-x-auto">
                <div className="min-w-[720px]">
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
            className="fixed inset-0 z-[45] bg-black/20"
            aria-hidden
            onClick={() => {
              setSelectedGuestBooking(null);
              setGuestAdminNote("");
              setGuestSelectedAllocations([]);
              setSelectedGuestFocusKey(null);
            }}
          />
          <aside
            className="fixed top-16 bottom-0 right-0 z-[60] flex w-full max-w-md flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200"
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
                  setGuestSelectedAllocations([]);
                  setSelectedGuestFocusKey(null);
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
                  {selectedGuestBooking.guest_count ?? 1} guest(s) ·{" "}
                  {selectedGuestBooking.requested_room_count ??
                    roomsNeededForGuestCount(selectedGuestBooking.guest_count ?? 1)}{" "}
                  room(s) requested (min{" "}
                  {roomsNeededForGuestCount(selectedGuestBooking.guest_count ?? 1)}) · max{" "}
                  {MAX_GUESTS_PER_ROOM} guests per room
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
                {selectedGuestBooking.status === "approved" &&
                  allocatedRoomsForBooking(selectedGuestBooking).length > 0 && (
                    <GuestHouseAllocationReadout
                      booking={selectedGuestBooking}
                      compact
                      className="mt-1"
                    />
                  )}
              </div>

              <div className="space-y-2">
                <Label>Availability Overview</Label>
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                <Label>Allocate rooms (required for approval)</Label>
                <p className="text-xs text-muted-foreground">
                  Select rooms across both guest houses. Tap a blocked room to see overlapping
                  bookings.
                </p>
                <div className="rounded-lg border p-3 space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary/70" />
                      Selected
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-600/80" />
                      Unavailable
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-600/70" />
                      Free
                    </span>
                  </div>
                  {GUEST_HOUSE_CODES.map((house) => (
                    <div key={house} className="space-y-2">
                      <p className="text-xs font-semibold">{GUEST_HOUSE_LABELS[house]}</p>
                      {roomsByFloorForGuestHouse(house).map((section) => (
                        <div key={`${house}-${section.floor}`} className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Floor {section.floor}
                          </p>
                          <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
                            {section.rooms.map((room) => {
                              const key = guestRoomKey(house, room);
                              const roomBookings =
                                selectedGuestRoomBookingMap.get(key) ?? [];
                              const isSelected = guestSelectedAllocations.some(
                                (a) => guestRoomKey(a.guest_house, a.room_number) === key
                              );
                              const blocked =
                                unavailableRoomsForSelectedBooking.has(key) && !isSelected;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onMouseEnter={() =>
                                    blocked ? setSelectedGuestFocusKey(key) : undefined
                                  }
                                  onFocus={() =>
                                    blocked ? setSelectedGuestFocusKey(key) : undefined
                                  }
                                  onClick={() => {
                                    if (blocked) {
                                      setSelectedGuestFocusKey(key);
                                      return;
                                    }
                                    if (isSelected) {
                                      setGuestSelectedAllocations((prev) =>
                                        prev.filter(
                                          (a) =>
                                            guestRoomKey(a.guest_house, a.room_number) !== key
                                        )
                                      );
                                    } else {
                                      setGuestSelectedAllocations((prev) => [
                                        ...prev,
                                        { guest_house: house, room_number: room },
                                      ]);
                                    }
                                    setSelectedGuestFocusKey(null);
                                  }}
                                  title={blocked ? bookingTooltipText(roomBookings) : undefined}
                                  className={`rounded border px-1 py-1 text-[11px] font-medium transition-colors ${
                                    blocked
                                      ? "border-amber-600/45 bg-amber-500/15 text-amber-900 line-through dark:text-amber-100"
                                      : isSelected
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
                  ))}
                </div>
                {selectedGuestFocusKey && (
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-semibold">
                      Bookings for {selectedGuestFocusKey.replace(":", " · ")}
                    </p>
                    {selectedGuestRoomBookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No overlapping approved bookings for this stay window.
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
            className="fixed inset-0 z-[45] bg-black/20"
            aria-hidden
            onClick={() => {
              setSelectedRequest(null);
              setAdminNote("");
              setAssignedHall("");
              setAdminSpoc("");
            }}
          />
          <aside
            className="fixed top-16 bottom-0 right-0 z-[60] flex w-full max-w-md flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200"
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
                  setAssignedHall("");
                  setAdminSpoc("");
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
                {(() => {
                  const subs = decodeCalendarRequestSubjects(
                    selectedRequest.subject
                  );
                  if (subs.length === 0) return null;
                  return (
                    <div className="flex items-start gap-3 text-sm text-foreground">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="min-w-0 leading-snug">
                        {subs.join(", ")}
                      </span>
                    </div>
                  );
                })()}
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
                {selectedRequest.status === "approved" &&
                  (selectedRequest.assigned_hall || selectedRequest.admin_spoc) && (
                    <div className="rounded-lg border border-border/80 bg-muted/25 p-3 space-y-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Approval details
                      </p>
                      {selectedRequest.assigned_hall && (
                        <div>
                          <span className="text-muted-foreground">Assigned hall: </span>
                          <span className="font-medium text-foreground">
                            {selectedRequest.assigned_hall}
                          </span>
                        </div>
                      )}
                      {selectedRequest.admin_spoc && (
                        <div>
                          <span className="text-muted-foreground">Admin SPOC: </span>
                          <span className="font-medium text-foreground">
                            {selectedRequest.admin_spoc}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
            <div className="shrink-0 border-t p-4 bg-background space-y-4">
              {selectedRequest.status === "pending" ||
              selectedRequest.status === "clarification_needed" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ar-assigned-hall">
                      Assigned hall<span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ar-assigned-hall"
                      value={assignedHall}
                      onChange={(e) => setAssignedHall(e.target.value)}
                      placeholder="e.g. Main auditorium, Block B – 201"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ar-admin-spoc">
                      Admin SPOC<span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ar-admin-spoc"
                      value={adminSpoc}
                      onChange={(e) => setAdminSpoc(e.target.value)}
                      placeholder="Name, email, or extension"
                      autoComplete="off"
                    />
                  </div>
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
                      onClick={() =>
                        updateRequest(selectedRequest.id, "approved", {
                          assignedHall,
                          adminSpoc,
                        })
                      }
                      disabled={
                        updating ||
                        !assignedHall.trim() ||
                        !adminSpoc.trim()
                      }
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  This request is{" "}
                  {selectedRequest.status.replace(/_/g, " ")}. No further actions.
                </p>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

