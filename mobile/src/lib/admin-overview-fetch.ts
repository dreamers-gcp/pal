import type { SupabaseClient } from "@supabase/supabase-js";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { AppointmentProviderCode, GuestHouseBookingRow, MessMealPeriod, RequestStatus } from "../types";
import { APPOINTMENT_PROVIDER_LABELS, MEAL_PERIOD_LABELS } from "./campus-use-mobile";
import { SPORTS_VENUE_LABELS } from "./sports-booking";

const INTERNATIONAL_CENTRE_ROOMS: string[] = Array.from({ length: 6 }, (_, floorIdx) => {
  const floor = floorIdx + 1;
  return Array.from({ length: 16 }, (_, roomIdx) =>
    `${floor}${String(roomIdx + 1).padStart(2, "0")}`
  );
}).flat();

const MDP_BUILDING_ROOMS: string[] = Array.from({ length: 6 }, (_, floorIdx) => {
  const floor = floorIdx + 1;
  return Array.from({ length: 16 }, (_, roomIdx) => `M${floor}${String(roomIdx + 1).padStart(2, "0")}`);
}).flat();

const TOTAL_GUEST_ROOMS = INTERNATIONAL_CENTRE_ROOMS.length + MDP_BUILDING_ROOMS.length;

const GUEST_HOUSE_LABELS: Record<string, string> = {
  international_centre: "International Centre",
  mdp_building: "MDP Building",
};

type GuestAlloc = { guest_house: string; room_number: string };

function allocatedRoomsForBooking(b: GuestHouseBookingRow): GuestAlloc[] {
  const raw = b.allocated_rooms;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter(
        (x): x is GuestAlloc =>
          Boolean(x) && typeof x === "object" && "guest_house" in x && "room_number" in x
      )
      .map((x) => ({
        guest_house: String((x as GuestAlloc).guest_house),
        room_number: String((x as GuestAlloc).room_number),
      }));
  }
  if (b.guest_house && b.room_number) {
    return [{ guest_house: b.guest_house, room_number: String(b.room_number) }];
  }
  return [];
}

/** Same as web `computeGuestHouseAvail` — peak day, by-house, empty room lists. */
function computeGuestHouseAvail(
  bookings: GuestHouseBookingRow[],
  from: string,
  to: string
): GuestHouseAvail {
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
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
  const emptyMdp = MDP_BUILDING_ROOMS.filter((r) => !peakOccupiedKeys.has(`mdp_building:${r}`));

  return {
    totalRooms: TOTAL_GUEST_ROOMS,
    occupied: peakOccupied,
    byHouse: [
      {
        label: GUEST_HOUSE_LABELS.international_centre!,
        occupied: peakByHouse["international_centre"] ?? 0,
        total: INTERNATIONAL_CENTRE_ROOMS.length,
      },
      {
        label: GUEST_HOUSE_LABELS.mdp_building!,
        occupied: peakByHouse["mdp_building"] ?? 0,
        total: MDP_BUILDING_ROOMS.length,
      },
    ],
    peakDayIso,
    emptyRoomsByHouse: [
      { label: GUEST_HOUSE_LABELS.international_centre!, rooms: emptyIc },
      { label: GUEST_HOUSE_LABELS.mdp_building!, rooms: emptyMdp },
    ],
  };
}

function minStudentsOnCampusInRange(
  totalStudents: number,
  leaves: { student_id: string; start_date: string; end_date: string }[],
  from: string,
  to: string
): number {
  if (totalStudents <= 0) return 0;
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  let maxLeaveAnyDay = 0;
  for (const day of days) {
    const dayStr = format(day, "yyyy-MM-dd");
    const onLeave = new Set<string>();
    for (const l of leaves) {
      if (l.start_date <= dayStr && l.end_date >= dayStr) onLeave.add(l.student_id);
    }
    maxLeaveAnyDay = Math.max(maxLeaveAnyDay, onLeave.size);
  }
  return Math.max(0, totalStudents - maxLeaveAnyDay);
}

function profileNameFromJoin(
  student: { full_name?: string | null } | { full_name?: string | null }[] | null | undefined
): string {
  if (student == null) return "—";
  if (Array.isArray(student)) {
    const n = student[0]?.full_name?.trim();
    return n || "—";
  }
  const n = student.full_name?.trim();
  return n || "—";
}

export function overviewStatusLabel(s: RequestStatus): string {
  if (s === "clarification_needed") return "Clarification";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface GuestHouseAvail {
  totalRooms: number;
  occupied: number;
  byHouse: { label: string; occupied: number; total: number }[];
  peakDayIso: string;
  emptyRoomsByHouse: { label: string; rooms: string[] }[];
}

export interface SportsAvail {
  totalVenues: number;
  bookedVenues: number;
  totalBookings: number;
  venueBreakdown: { label: string; bookings: number }[];
  freeVenueLabels: string[];
}

export interface ClassroomAvail {
  totalRooms: number;
  bookedEvents: number;
  classroomsWithEvents: number;
  emptyRoomNames: string[];
  scheduledRooms: { name: string; events: number }[];
}

export interface PeopleStats {
  studentsOnCampus: number;
  studentsTotal: number;
}

export interface HealthOverviewItem {
  id: string;
  booking_date: string;
  start_time: string;
  providerLabel: string;
  serviceType: string;
  status: RequestStatus;
  studentName: string;
}

export interface MessOverviewItem {
  id: string;
  meal_date: string;
  mealPeriodLabel: string;
  extra_guest_count: number;
  status: RequestStatus;
  studentName: string;
}

export interface HealthOverview {
  totalInRange: number;
  items: HealthOverviewItem[];
}

export interface MessOverview {
  totalInRange: number;
  items: MessOverviewItem[];
}

export interface AdminOverviewDashboardData {
  guestHouse: GuestHouseAvail;
  sports: SportsAvail;
  classrooms: ClassroomAvail;
  people: PeopleStats;
  health: HealthOverview;
  mess: MessOverview;
}

/** Display as `vacant/total`; `—` if total is 0 (matches web). */
export function overviewFrac(vacant: number, total: number): string {
  if (total <= 0) return "—";
  return `${vacant}/${total}`;
}

/**
 * Full overview payload — same queries and shaping as web `AdminOverviewDashboard` `load()`.
 */
export async function fetchAdminOverviewDashboard(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<AdminOverviewDashboardData> {
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
      .select("guest_house, room_number, allocated_rooms, check_in_date, check_out_date")
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
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
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

  const guestHouse = computeGuestHouseAvail(
    (guestHouseRes.data ?? []) as GuestHouseBookingRow[],
    from,
    to
  );

  const venueCountMap: Record<string, number> = {};
  for (const row of (sportsRes.data ?? []) as { venue_code: string }[]) {
    venueCountMap[row.venue_code] = (venueCountMap[row.venue_code] ?? 0) + 1;
  }
  const bookedVenueCodes = new Set(
    ((sportsRes.data ?? []) as { venue_code: string }[]).map((r) => r.venue_code)
  );
  const totalVenues = Object.keys(SPORTS_VENUE_LABELS).length;
  const venueBreakdown = Object.entries(SPORTS_VENUE_LABELS).map(([code, label]) => ({
    label,
    bookings: venueCountMap[code] ?? 0,
  }));
  const sports: SportsAvail = {
    totalVenues,
    bookedVenues: bookedVenueCodes.size,
    totalBookings: sportsRes.data?.length ?? 0,
    venueBreakdown,
    freeVenueLabels: venueBreakdown.filter((v) => v.bookings === 0).map((v) => v.label),
  };

  const classroomRows = (classroomsListRes.data ?? []) as { id: string; name: string }[];
  const eventRows = (classroomEventsRes.data ?? []) as { classroom_id: string | null }[];
  const eventCountByClassroom = new Map<string, number>();
  for (const row of eventRows) {
    const cid = row.classroom_id;
    if (!cid) continue;
    eventCountByClassroom.set(cid, (eventCountByClassroom.get(cid) ?? 0) + 1);
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

  const classrooms: ClassroomAvail = {
    totalRooms: classroomRows.length,
    bookedEvents: eventRows.length,
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
    student?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }>;
  const healthItems: HealthOverviewItem[] = apptRaw.map((r) => ({
    id: r.id,
    booking_date: r.booking_date,
    start_time: r.start_time,
    providerLabel:
      APPOINTMENT_PROVIDER_LABELS[r.provider_code as AppointmentProviderCode] ?? r.provider_code,
    serviceType: r.service_type === "doctor" ? "Doctor" : "Counsellor",
    status: r.status,
    studentName: profileNameFromJoin(r.student),
  }));

  const messRaw = (messExtraRes.data ?? []) as unknown as Array<{
    id: string;
    meal_date: string;
    meal_period: MessMealPeriod;
    extra_guest_count: number;
    status: RequestStatus;
    student?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }>;
  const messItems: MessOverviewItem[] = messRaw.map((r) => ({
    id: r.id,
    meal_date: r.meal_date,
    mealPeriodLabel: MEAL_PERIOD_LABELS[r.meal_period],
    extra_guest_count: r.extra_guest_count,
    status: r.status,
    studentName: profileNameFromJoin(r.student),
  }));

  const studentsTotal = studentsRes.count ?? 0;
  const leaveRows = (leaveRes.data ?? []) as {
    student_id: string;
    start_date: string;
    end_date: string;
  }[];
  const studentsOnCampus = minStudentsOnCampusInRange(studentsTotal, leaveRows, from, to);

  return {
    guestHouse,
    sports,
    classrooms,
    people: { studentsOnCampus, studentsTotal },
    health: { totalInRange: healthItems.length, items: healthItems },
    mess: { totalInRange: messItems.length, items: messItems },
  };
}
