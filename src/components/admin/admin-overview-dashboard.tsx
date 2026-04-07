"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BedDouble,
  Trophy,
  GraduationCap,
  Loader2,
  DoorOpen,
  RefreshCcw,
  Search,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import {
  TOTAL_GUEST_HOUSE_ROOM_COUNT,
  GUEST_HOUSE_LABELS,
  INTERNATIONAL_CENTRE_ROOMS,
  MDP_BUILDING_ROOMS,
  allocatedRoomsForBooking,
} from "@/lib/guest-house";
import { SPORTS_VENUE_LABELS } from "@/lib/sports-booking";
import {
  APPOINTMENT_PROVIDER_LABELS,
  MEAL_PERIOD_LABELS,
  timeSlice,
} from "@/lib/campus-use-cases";
import type {
  AppointmentProviderCode,
  GuestHouseBooking,
  MessExtraRequest,
  RequestStatus,
  SportsBooking,
} from "@/lib/types";

/* ---------- interfaces ---------- */

interface GuestHouseAvail {
  totalRooms: number;
  occupied: number;
  byHouse: { label: string; occupied: number; total: number }[];
  /** Date (ISO) of the busiest day in the range; room lists refer to this day. */
  peakDayIso: string;
  /** Room numbers still available on the peak day, per building. */
  emptyRoomsByHouse: { label: string; rooms: string[] }[];
}

interface SportsAvail {
  totalVenues: number;
  bookedVenues: number;
  totalBookings: number;
  venueBreakdown: { label: string; bookings: number }[];
  freeVenueLabels: string[];
}

interface ClassroomAvail {
  totalRooms: number;
  bookedEvents: number;
  /** Distinct classrooms with ≥1 approved event in range. */
  classroomsWithEvents: number;
  /** Classrooms with no events in range. */
  emptyRoomNames: string[];
  /** Classrooms with events, sorted by event count desc. */
  scheduledRooms: { name: string; events: number }[];
}

interface PeopleStats {
  studentsOnCampus: number;
  studentsTotal: number;
}

interface HealthOverviewItem {
  id: string;
  booking_date: string;
  start_time: string;
  providerLabel: string;
  serviceType: string;
  status: RequestStatus;
  studentName: string;
}

interface MessOverviewItem {
  id: string;
  meal_date: string;
  mealPeriodLabel: string;
  extra_guest_count: number;
  status: RequestStatus;
  studentName: string;
}

interface HealthOverview {
  totalInRange: number;
  items: HealthOverviewItem[];
}

interface MessOverview {
  totalInRange: number;
  items: MessOverviewItem[];
}

interface OverviewData {
  guestHouse: GuestHouseAvail;
  sports: SportsAvail;
  classrooms: ClassroomAvail;
  people: PeopleStats;
  health: HealthOverview;
  mess: MessOverview;
}

/* ---------- helpers ---------- */

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

/** Display as `vacant/total`; `—` if total is 0. */
function frac(vacant: number, total: number): string {
  if (total <= 0) return "—";
  return `${vacant}/${total}`;
}

function minStudentsOnCampusInRange(
  totalStudents: number,
  leaves: { student_id: string; start_date: string; end_date: string }[],
  from: string,
  to: string
): number {
  if (totalStudents <= 0) return 0;
  const days = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  });
  let maxLeaveAnyDay = 0;
  for (const day of days) {
    const dayStr = format(day, "yyyy-MM-dd");
    const onLeave = new Set<string>();
    for (const l of leaves) {
      if (l.start_date <= dayStr && l.end_date >= dayStr) {
        onLeave.add(l.student_id);
      }
    }
    maxLeaveAnyDay = Math.max(maxLeaveAnyDay, onLeave.size);
  }
  return Math.max(0, totalStudents - maxLeaveAnyDay);
}

function profileNameFromJoin(
  student:
    | { full_name?: string | null }
    | { full_name?: string | null }[]
    | null
    | undefined
): string {
  if (student == null) return "—";
  if (Array.isArray(student)) {
    const n = student[0]?.full_name?.trim();
    return n || "—";
  }
  const n = student.full_name?.trim();
  return n || "—";
}

function statusLabel(s: RequestStatus): string {
  if (s === "clarification_needed") return "Clarification";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * For a date range, find peak room occupancy across all days.
 * For a single day query both dates are equal.
 */
function computeGuestHouseAvail(
  bookings: GuestHouseBooking[],
  from: string,
  to: string
): GuestHouseAvail {
  const days = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  });

  let peakOccupied = 0;
  let peakByHouse: Record<string, number> = {};
  let peakDayIso = from;
  let peakOccupiedKeys = new Set<string>();

  for (const day of days) {
    const dayStr = format(day, "yyyy-MM-dd");
    const roomKeys = new Set<string>();
    const byHouse: Record<string, number> = {};

    for (const bk of bookings) {
      if (bk.check_in_date > dayStr || bk.check_out_date < dayStr) continue;
      const alloc = allocatedRoomsForBooking(bk);
      for (const a of alloc) {
        const key = `${a.guest_house}:${a.room_number}`;
        if (!roomKeys.has(key)) {
          roomKeys.add(key);
          byHouse[a.guest_house] = (byHouse[a.guest_house] ?? 0) + 1;
        }
      }
    }

    if (roomKeys.size > peakOccupied) {
      peakOccupied = roomKeys.size;
      peakByHouse = { ...byHouse };
      peakDayIso = dayStr;
      peakOccupiedKeys = new Set(roomKeys);
    }
  }

  const emptyIc = INTERNATIONAL_CENTRE_ROOMS.filter(
    (r) => !peakOccupiedKeys.has(`international_centre:${r}`)
  );
  const emptyMdp = MDP_BUILDING_ROOMS.filter(
    (r) => !peakOccupiedKeys.has(`mdp_building:${r}`)
  );

  return {
    totalRooms: TOTAL_GUEST_HOUSE_ROOM_COUNT,
    occupied: peakOccupied,
    byHouse: [
      {
        label: GUEST_HOUSE_LABELS.international_centre,
        occupied: peakByHouse["international_centre"] ?? 0,
        total: INTERNATIONAL_CENTRE_ROOMS.length,
      },
      {
        label: GUEST_HOUSE_LABELS.mdp_building,
        occupied: peakByHouse["mdp_building"] ?? 0,
        total: MDP_BUILDING_ROOMS.length,
      },
    ],
    peakDayIso,
    emptyRoomsByHouse: [
      { label: GUEST_HOUSE_LABELS.international_centre, rooms: emptyIc },
      { label: GUEST_HOUSE_LABELS.mdp_building, rooms: emptyMdp },
    ],
  };
}

/* ---------- component ---------- */

export function AdminOverviewDashboard() {
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestSearch, setGuestSearch] = useState("");
  const [sportsSearch, setSportsSearch] = useState("");
  const [classroomSearch, setClassroomSearch] = useState("");
  const [healthSearch, setHealthSearch] = useState("");
  const [messSearch, setMessSearch] = useState("");

  const isSingleDay = fromDate === toDate;

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      const supabase = createClient();

      const [
        guestHouseRes,
        sportsRes,
        classroomsListRes,
        classroomEventsRes,
        studentsRes,
        leaveRes,
        appointmentRes,
        messExtraRes,
      ] = await Promise.all([
        supabase
          .from("guest_house_bookings")
          .select(
            "guest_house, room_number, allocated_rooms, check_in_date, check_out_date"
          )
          .eq("status", "approved")
          .lte("check_in_date", to)
          .gte("check_out_date", from),
        supabase
          .from("sports_bookings")
          .select("venue_code, booking_date")
          .eq("status", "approved")
          .gte("booking_date", from)
          .lte("booking_date", to),
        supabase.from("classrooms").select("id, name").order("name"),
        supabase
          .from("calendar_requests")
          .select("classroom_id")
          .eq("status", "approved")
          .gte("event_date", from)
          .lte("event_date", to),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("student_leave_requests")
          .select("student_id, start_date, end_date")
          .eq("status", "approved")
          .lte("start_date", to)
          .gte("end_date", from),
        supabase
          .from("appointment_bookings")
          .select(
            "id, booking_date, start_time, status, provider_code, service_type, student:profiles!appointment_bookings_student_id_fkey(full_name)"
          )
          .gte("booking_date", from)
          .lte("booking_date", to)
          .order("booking_date", { ascending: false }),
        supabase
          .from("mess_extra_requests")
          .select(
            "id, meal_date, meal_period, extra_guest_count, status, student:profiles!mess_extra_requests_student_id_fkey(full_name)"
          )
          .gte("meal_date", from)
          .lte("meal_date", to)
          .order("meal_date", { ascending: false }),
      ]);

      // Guest house
      const guestHouse = computeGuestHouseAvail(
        (guestHouseRes.data ?? []) as GuestHouseBooking[],
        from,
        to
      );

      // Sports
      const venueCountMap: Record<string, number> = {};
      for (const row of (sportsRes.data ?? []) as Pick<
        SportsBooking,
        "venue_code"
      >[]) {
        venueCountMap[row.venue_code] =
          (venueCountMap[row.venue_code] ?? 0) + 1;
      }
      const bookedVenueCodes = new Set(
        (sportsRes.data ?? []).map(
          (r: Pick<SportsBooking, "venue_code">) => r.venue_code
        )
      );
      const totalVenues = Object.keys(SPORTS_VENUE_LABELS).length;
      const venueBreakdown = Object.entries(SPORTS_VENUE_LABELS).map(
        ([code, label]) => ({
          label,
          bookings: venueCountMap[code] ?? 0,
        })
      );
      const sports: SportsAvail = {
        totalVenues,
        bookedVenues: bookedVenueCodes.size,
        totalBookings: sportsRes.data?.length ?? 0,
        venueBreakdown,
        freeVenueLabels: venueBreakdown
          .filter((v) => v.bookings === 0)
          .map((v) => v.label),
      };

      // Classrooms: which rooms have no events vs scheduled in range
      const classroomRows =
        (classroomsListRes.data as { id: string; name: string }[]) ?? [];
      const eventRows =
        (classroomEventsRes.data as { classroom_id: string | null }[]) ?? [];
      const eventCountByClassroom = new Map<string, number>();
      for (const row of eventRows) {
        const cid = row.classroom_id;
        if (!cid) continue;
        eventCountByClassroom.set(
          cid,
          (eventCountByClassroom.get(cid) ?? 0) + 1
        );
      }
      const scheduledRooms = classroomRows
        .filter((c) => (eventCountByClassroom.get(c.id) ?? 0) > 0)
        .map((c) => ({
          name: c.name,
          events: eventCountByClassroom.get(c.id) ?? 0,
        }))
        .sort((a, b) => b.events - a.events);
      const emptyRoomNames = classroomRows
        .filter((c) => (eventCountByClassroom.get(c.id) ?? 0) === 0)
        .map((c) => c.name);
      const bookedEvents = eventRows.length;

      const classrooms: ClassroomAvail = {
        totalRooms: classroomRows.length,
        bookedEvents,
        classroomsWithEvents: scheduledRooms.length,
        emptyRoomNames,
        scheduledRooms,
      };

      const apptRaw = (appointmentRes.data ?? []) as unknown as Array<{
        id: string;
        booking_date: string;
        start_time: string;
        status: RequestStatus;
        provider_code: string;
        service_type: string;
        student?:
          | { full_name?: string | null }
          | { full_name?: string | null }[]
          | null;
      }>;
      const healthItems: HealthOverviewItem[] = apptRaw.map((r) => ({
        id: r.id,
        booking_date: r.booking_date,
        start_time: r.start_time,
        providerLabel:
          APPOINTMENT_PROVIDER_LABELS[r.provider_code as AppointmentProviderCode] ??
          r.provider_code,
        serviceType: r.service_type === "doctor" ? "Doctor" : "Counsellor",
        status: r.status,
        studentName: profileNameFromJoin(r.student),
      }));
      const health: HealthOverview = {
        totalInRange: healthItems.length,
        items: healthItems,
      };

      const messRaw = (messExtraRes.data ?? []) as unknown as Array<{
        id: string;
        meal_date: string;
        meal_period: MessExtraRequest["meal_period"];
        extra_guest_count: number;
        status: RequestStatus;
        student?:
          | { full_name?: string | null }
          | { full_name?: string | null }[]
          | null;
      }>;
      const messItems: MessOverviewItem[] = messRaw.map((r) => ({
        id: r.id,
        meal_date: r.meal_date,
        mealPeriodLabel: MEAL_PERIOD_LABELS[r.meal_period],
        extra_guest_count: r.extra_guest_count,
        status: r.status,
        studentName: profileNameFromJoin(r.student),
      }));
      const mess: MessOverview = {
        totalInRange: messItems.length,
        items: messItems,
      };

      const studentsTotal = studentsRes.count ?? 0;
      const leaveRows =
        (leaveRes.data ?? []) as {
          student_id: string;
          start_date: string;
          end_date: string;
        }[];
      const studentsOnCampus = minStudentsOnCampusInRange(
        studentsTotal,
        leaveRows,
        from,
        to
      );

      setData({
        guestHouse,
        sports,
        classrooms,
        people: {
          studentsOnCampus,
          studentsTotal,
        },
        health,
        mess,
      });
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    load(fromDate, toDate);
  }, [load, fromDate, toDate]);

  const handleResetToday = useCallback(() => {
    const t = todayISO();
    setFromDate(t);
    setToDate(t);
  }, []);

  const isToday = fromDate === todayISO() && toDate === todayISO();

  const guestBlocksFiltered = useMemo(() => {
    if (!data) return [];
    const q = guestSearch.trim().toLowerCase();
    return data.guestHouse.emptyRoomsByHouse.map((block) => ({
      label: block.label,
      rooms: block.rooms.filter(
        (r) => !q || `${block.label} ${r}`.toLowerCase().includes(q)
      ),
    }));
  }, [data, guestSearch]);

  const sportsFreeFiltered = useMemo(() => {
    if (!data) return [];
    const q = sportsSearch.trim().toLowerCase();
    return data.sports.freeVenueLabels.filter(
      (l) => !q || l.toLowerCase().includes(q)
    );
  }, [data, sportsSearch]);

  const sportsBookedFiltered = useMemo(() => {
    if (!data) return [];
    const q = sportsSearch.trim().toLowerCase();
    return data.sports.venueBreakdown.filter(
      (v) =>
        v.bookings > 0 &&
        (!q || v.label.toLowerCase().includes(q))
    );
  }, [data, sportsSearch]);

  const classroomEmptyFiltered = useMemo(() => {
    if (!data) return [];
    const q = classroomSearch.trim().toLowerCase();
    return data.classrooms.emptyRoomNames.filter(
      (n) => !q || n.toLowerCase().includes(q)
    );
  }, [data, classroomSearch]);

  const classroomScheduledFiltered = useMemo(() => {
    if (!data) return [];
    const q = classroomSearch.trim().toLowerCase();
    return data.classrooms.scheduledRooms.filter(
      (row) => !q || row.name.toLowerCase().includes(q)
    );
  }, [data, classroomSearch]);

  const healthItemsFiltered = useMemo(() => {
    if (!data) return [];
    const q = healthSearch.trim().toLowerCase();
    if (!q) return data.health.items;
    return data.health.items.filter(
      (row) =>
        row.studentName.toLowerCase().includes(q) ||
        row.providerLabel.toLowerCase().includes(q) ||
        row.serviceType.toLowerCase().includes(q) ||
        row.booking_date.includes(q) ||
        statusLabel(row.status).toLowerCase().includes(q)
    );
  }, [data, healthSearch]);

  const messItemsFiltered = useMemo(() => {
    if (!data) return [];
    const q = messSearch.trim().toLowerCase();
    if (!q) return data.mess.items;
    return data.mess.items.filter(
      (row) =>
        row.studentName.toLowerCase().includes(q) ||
        row.mealPeriodLabel.toLowerCase().includes(q) ||
        row.meal_date.includes(q) ||
        String(row.extra_guest_count).includes(q) ||
        statusLabel(row.status).toLowerCase().includes(q)
    );
  }, [data, messSearch]);

  return (
    <div className="space-y-6">
      {/* ===== Date range filter ===== */}
      <div
        className={cn(
          "grid max-w-2xl gap-3 sm:items-end",
          isToday
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-[minmax(0,11.5rem)_minmax(0,11.5rem)_auto]"
        )}
      >
        <div className="grid w-full gap-1.5">
          <span className="text-xs font-medium leading-none text-muted-foreground">
            From
          </span>
          <DatePicker
            value={fromDate}
            onChange={(v) => {
              setFromDate(v);
              if (v > toDate) setToDate(v);
            }}
            className="h-10 w-full min-w-0 sm:w-[11.5rem]"
          />
        </div>
        <div className="grid w-full gap-1.5">
          <span className="text-xs font-medium leading-none text-muted-foreground">
            To
          </span>
          <DatePicker
            value={toDate}
            onChange={(v) => {
              setToDate(v);
              if (v < fromDate) setFromDate(v);
            }}
            min={fromDate}
            className="h-10 w-full min-w-0 sm:w-[11.5rem]"
          />
        </div>
        {!isToday && (
          <div className="flex items-end sm:pb-px">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleResetToday}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset to today
            </Button>
          </div>
        )}
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ===== Top stat cards (vacant/total or share/total) ===== */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard
              icon={BedDouble}
              iconBg="bg-violet-100"
              iconColor="text-violet-700"
              fraction={frac(
                data.guestHouse.totalRooms - data.guestHouse.occupied,
                data.guestHouse.totalRooms
              )}
              label={
                isSingleDay
                  ? "Vacant guest rooms"
                  : "Vacant guest rooms · peak day"
              }
              accent="border-violet-200/60 bg-violet-50/40"
              valueColor="text-violet-900"
            />
            <StatCard
              icon={DoorOpen}
              iconBg="bg-sky-100"
              iconColor="text-sky-700"
              fraction={frac(
                data.classrooms.emptyRoomNames.length,
                data.classrooms.totalRooms
              )}
              label="Vacant Classrooms"
              accent="border-sky-200/60 bg-sky-50/40"
              valueColor="text-sky-900"
            />
            <StatCard
              icon={Trophy}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-700"
              fraction={frac(
                data.sports.freeVenueLabels.length,
                data.sports.totalVenues
              )}
              label="Vacant sports venues"
              accent="border-emerald-200/60 bg-emerald-50/40"
              valueColor="text-emerald-900"
            />
            <StatCard
              icon={GraduationCap}
              iconBg="bg-sky-100"
              iconColor="text-sky-700"
              fraction={frac(
                data.people.studentsOnCampus,
                data.people.studentsTotal
              )}
              label="Students on campus"
            />
          </div>

          {/* ===== Availability detail cards ===== */}
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {/* Guest house rooms */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                  <BedDouble className="h-4.5 w-4.5 text-violet-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    Guest house rooms
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.guestHouse.occupied} of{" "}
                    {data.guestHouse.totalRooms} occupied
                    {!isSingleDay && " (peak in range)"}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <CardSearchInput
                  value={guestSearch}
                  onChange={setGuestSearch}
                  placeholder="Search building or room number…"
                />
                <ProgressBar
                  value={data.guestHouse.occupied}
                  max={data.guestHouse.totalRooms}
                  color="bg-violet-500"
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {data.guestHouse.byHouse.map((h) => (
                    <span key={h.label}>
                      {h.label}:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {h.occupied}
                      </span>
                      /{h.total}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-medium text-emerald-700 tabular-nums">
                  {data.guestHouse.totalRooms - data.guestHouse.occupied}{" "}
                  rooms available
                </p>
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-xs font-medium text-foreground">
                    Vacant room numbers
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      —{" "}
                      {isSingleDay
                        ? format(parseISO(fromDate), "MMM d, yyyy")
                        : `busiest day ${format(parseISO(data.guestHouse.peakDayIso), "MMM d, yyyy")}`}
                    </span>
                  </p>
                  {guestBlocksFiltered.map((block) => (
                    <div key={block.label} className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {block.label}
                        {guestSearch.trim() && (
                          <span className="ml-1 font-normal normal-case text-muted-foreground">
                            ({block.rooms.length} match
                            {block.rooms.length === 1 ? "" : "es"})
                          </span>
                        )}
                      </p>
                      {(() => {
                        const orig = data.guestHouse.emptyRoomsByHouse.find(
                          (b) => b.label === block.label
                        );
                        const wasAllFull = orig && orig.rooms.length === 0;
                        if (wasAllFull) {
                          return (
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              All rooms occupied on this day.
                            </p>
                          );
                        }
                        if (block.rooms.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground">
                              No vacant rooms match this search.
                            </p>
                          );
                        }
                        return <RoomNumberChips rooms={block.rooms} />;
                      })()}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Classrooms */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50">
                  <DoorOpen className="h-4.5 w-4.5 text-sky-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    Classrooms
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.classrooms.classroomsWithEvents} of{" "}
                    {data.classrooms.totalRooms} rooms in use ·{" "}
                    {data.classrooms.bookedEvents} event
                    {data.classrooms.bookedEvents === 1 ? "" : "s"}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <CardSearchInput
                  value={classroomSearch}
                  onChange={setClassroomSearch}
                  placeholder="Search classroom name…"
                />
                {data.classrooms.totalRooms > 0 && (
                  <ProgressBar
                    value={data.classrooms.classroomsWithEvents}
                    max={data.classrooms.totalRooms}
                    color="bg-sky-500"
                  />
                )}
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    No events scheduled ({data.classrooms.emptyRoomNames.length}{" "}
                    rooms)
                  </p>
                  {data.classrooms.emptyRoomNames.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Every classroom has at least one event in this period.
                    </p>
                  ) : classroomEmptyFiltered.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No rooms match this search.
                    </p>
                  ) : (
                    <OverviewScrollPanel maxHeightClass="max-h-[10rem]">
                      <ul className="divide-y divide-border/50 text-xs leading-snug text-foreground [&>li]:px-1 [&>li]:py-2 first:[&>li]:pt-1 last:[&>li]:pb-1">
                        {classroomEmptyFiltered.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </OverviewScrollPanel>
                  )}
                </div>
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Rooms with events
                  </p>
                  {data.classrooms.scheduledRooms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No approved class events in this period.
                    </p>
                  ) : classroomScheduledFiltered.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No rooms match this search.
                    </p>
                  ) : (
                    <OverviewScrollPanel maxHeightClass="max-h-[10rem]">
                      <ul className="divide-y divide-border/50 text-xs text-muted-foreground [&>li]:px-1 [&>li]:py-2 first:[&>li]:pt-1 last:[&>li]:pb-1">
                        {classroomScheduledFiltered.map((row) => (
                          <li key={row.name}>
                            <span className="text-foreground">{row.name}</span>
                            <span className="tabular-nums">
                              {" "}
                              — {row.events} event{row.events === 1 ? "" : "s"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </OverviewScrollPanel>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sports venues */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                  <Trophy className="h-4.5 w-4.5 text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    Sports venues
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.sports.bookedVenues} of {data.sports.totalVenues}{" "}
                    venues have bookings
                    {!isSingleDay &&
                      ` · ${data.sports.totalBookings} booking(s) total`}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <CardSearchInput
                  value={sportsSearch}
                  onChange={setSportsSearch}
                  placeholder="Search venue name…"
                />
                <ProgressBar
                  value={data.sports.bookedVenues}
                  max={data.sports.totalVenues}
                  color="bg-emerald-500"
                />
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Free for this period
                  </p>
                  {data.sports.freeVenueLabels.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Every venue has at least one booking.
                    </p>
                  ) : sportsFreeFiltered.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No free venues match this search.
                    </p>
                  ) : (
                    <OverviewScrollPanel maxHeightClass="max-h-[8.5rem]">
                      <ul className="divide-y divide-border/50 text-xs text-foreground [&>li]:px-1 [&>li]:py-2 first:[&>li]:pt-1 last:[&>li]:pb-1">
                        {sportsFreeFiltered.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </OverviewScrollPanel>
                  )}
                </div>
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Booked (sessions)
                  </p>
                  {data.sports.bookedVenues === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No bookings in this period.
                    </p>
                  ) : sportsBookedFiltered.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No booked venues match this search.
                    </p>
                  ) : (
                    <OverviewScrollPanel maxHeightClass="max-h-[8.5rem]">
                      <ul className="divide-y divide-border/50 text-xs text-muted-foreground [&>li]:px-1 [&>li]:py-2 first:[&>li]:pt-1 last:[&>li]:pb-1">
                        {sportsBookedFiltered.map((v) => (
                          <li key={v.label}>
                            <span className="text-foreground">{v.label}</span>
                            <span className="tabular-nums">
                              {" "}
                              — {v.bookings} booking
                              {v.bookings === 1 ? "" : "s"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </OverviewScrollPanel>
                  )}
                </div>
                <p className="text-xs font-medium text-emerald-700 tabular-nums">
                  {data.sports.freeVenueLabels.length} of {data.sports.totalVenues}{" "}
                  venues completely free
                </p>
              </CardContent>
            </Card>

            {/* Health — doctors & counsellors */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50">
                  <Stethoscope className="h-4.5 w-4.5 text-pink-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    Health & counselling
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.health.totalInRange} booking
                    {data.health.totalInRange === 1 ? "" : "s"} · selected dates
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <CardSearchInput
                  value={healthSearch}
                  onChange={setHealthSearch}
                  placeholder="Student, provider, role, date, status…"
                />
                {data.health.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No appointments in this period.
                  </p>
                ) : healthItemsFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No rows match this search.
                  </p>
                ) : (
                  <OverviewScrollPanel
                    maxHeightClass="max-h-[13rem]"
                    contentClassName="flex flex-col gap-2 p-2"
                  >
                    {healthItemsFiltered.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-md border border-border/60 bg-card/90 px-2.5 py-2 shadow-sm"
                      >
                        <p className="font-medium text-foreground">
                          {row.studentName}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {format(parseISO(row.booking_date), "MMM d")} ·{" "}
                          {timeSlice(row.start_time)} · {row.serviceType} ·{" "}
                          {row.providerLabel} · {statusLabel(row.status)}
                        </p>
                      </div>
                    ))}
                  </OverviewScrollPanel>
                )}
              </CardContent>
            </Card>

            {/* Mess — extra guests */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                  <UtensilsCrossed className="h-4.5 w-4.5 text-amber-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    Mess — extra guests
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.mess.totalInRange} extra-guest request
                    {data.mess.totalInRange === 1 ? "" : "s"} · meal dates
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <CardSearchInput
                  value={messSearch}
                  onChange={setMessSearch}
                  placeholder="Student, meal, date, guests, status…"
                />
                {data.mess.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No mess requests in this period.
                  </p>
                ) : messItemsFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No rows match this search.
                  </p>
                ) : (
                  <OverviewScrollPanel
                    maxHeightClass="max-h-[13rem]"
                    contentClassName="flex flex-col gap-2 p-2"
                  >
                    {messItemsFiltered.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-md border border-border/60 bg-card/90 px-2.5 py-2 shadow-sm"
                      >
                        <p className="font-medium text-foreground">
                          {row.studentName}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {format(parseISO(row.meal_date), "MMM d")} ·{" "}
                          {row.mealPeriodLabel} · +{row.extra_guest_count} guest
                          {row.extra_guest_count === 1 ? "" : "s"} ·{" "}
                          {statusLabel(row.status)}
                        </p>
                      </div>
                    ))}
                  </OverviewScrollPanel>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- small sub-components ---------- */

/** Inset scroll region: readable contrast, thin scrollbar, no harsh clip. */
function OverviewScrollPanel({
  maxHeightClass,
  className,
  contentClassName,
  children,
}: {
  maxHeightClass: string;
  className?: string;
  /** Padding around scrollable content */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        maxHeightClass,
        "min-h-0 overflow-y-auto overscroll-y-contain rounded-lg border border-border/80",
        "bg-muted/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:bg-muted/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "[scrollbar-width:thin]",
        "[scrollbar-color:var(--border)_transparent]",
        "[&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:my-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:min-h-[2.5rem] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:bg-border/90",
        "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/45",
        className
      )}
    >
      <div className={cn("p-1.5", contentClassName)}>{children}</div>
    </div>
  );
}

function CardSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full pl-8 text-xs"
        aria-label={placeholder}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  fraction,
  label,
  accent,
  valueColor,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  fraction: string;
  label: string;
  accent?: string;
  valueColor?: string;
}) {
  return (
    <Card className={accent}>
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums tracking-tight",
              valueColor
            )}
          >
            {fraction}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Guest house room labels (e.g. 101, M205) as compact chips in a scrollable area. */
function RoomNumberChips({ rooms }: { rooms: string[] }) {
  return (
    <OverviewScrollPanel
      maxHeightClass="max-h-[9.5rem]"
      contentClassName="p-2"
    >
      <div className="flex flex-wrap gap-1.5">
        {rooms.map((r) => (
          <span
            key={r}
            className="rounded-md border border-violet-200/70 bg-violet-50/90 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-violet-900 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100"
          >
            {r}
          </span>
        ))}
      </div>
    </OverviewScrollPanel>
  );
}
