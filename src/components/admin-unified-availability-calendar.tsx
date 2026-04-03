"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type Event as RBCEvent,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  eachDayOfInterval,
  parseISO,
  isValid,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./student-calendar.css";
import type {
  AppointmentBooking,
  CalendarRequest,
  Classroom,
  FacilityBooking,
  GuestHouseBooking,
  RequestStatus,
  SportsBooking,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { BigCalendarSkeleton } from "@/components/ui/loading-skeletons";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toTitleCase } from "@/lib/utils";
import { GUEST_HOUSE_LABELS } from "@/lib/guest-house";
import { SPORT_LABELS, SPORTS_VENUE_LABELS } from "@/lib/sports-booking";
import {
  APPOINTMENT_PROVIDER_LABELS,
  FACILITY_TYPE_LABELS,
  facilityVenueLabel,
} from "@/lib/campus-use-cases";
import {
  Building2,
  CalendarDays,
  Clock,
  GraduationCap,
  HeartPulse,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
  Trophy,
  User,
  X,
} from "lucide-react";

const VIEWS: View[] = ["month", "week", "day"];

const COLORS = {
  class: "#2563eb",
  exam: "#4338ca",
  guest: "#a855f7",
  sports: "#ea580c",
  facility: "#0d9488",
  health: "#db2777",
} as const;

type LayerKey =
  | "classes"
  | "guestHouse"
  | "sports"
  | "facilities"
  | "health";

type UnifiedMeta =
  | {
      kind: "class";
      request: CalendarRequest;
      variant: "class" | "exam";
    }
  | {
      kind: "guest";
      booking: GuestHouseBooking;
      day: string;
    }
  | { kind: "sports"; booking: SportsBooking }
  | { kind: "facility"; booking: FacilityBooking }
  | { kind: "health"; booking: AppointmentBooking };

type UnifiedCalEvent = RBCEvent & { meta: UnifiedMeta };

function dateStringsInclusive(fromStr: string, toStr: string): string[] {
  const a = parseISO(fromStr.split("T")[0]);
  const b = parseISO(toStr.split("T")[0]);
  if (!isValid(a) || !isValid(b) || a > b) return [];
  return eachDayOfInterval({ start: a, end: b }).map((d) =>
    format(d, "yyyy-MM-dd")
  );
}

function dayAllDayRange(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end };
}

function passesStatusFilter(
  status: RequestStatus,
  approvedOnly: boolean
): boolean {
  if (approvedOnly) return status === "approved";
  return status !== "rejected";
}

function colorForMeta(meta: UnifiedMeta): string {
  switch (meta.kind) {
    case "class":
      return meta.variant === "exam" ? COLORS.exam : COLORS.class;
    case "guest":
      return COLORS.guest;
    case "sports":
      return COLORS.sports;
    case "facility":
      return COLORS.facility;
    case "health":
      return COLORS.health;
  }
}

function UnifiedEventLabel({ event, title }: { event: RBCEvent; title: string }) {
  const u = event as UnifiedCalEvent;
  const icon = (() => {
    switch (u.meta.kind) {
      case "class":
        return <GraduationCap className="h-3 w-3 shrink-0 opacity-95" aria-hidden />;
      case "guest":
        return <Home className="h-3 w-3 shrink-0 opacity-95" aria-hidden />;
      case "sports":
        return <Trophy className="h-3 w-3 shrink-0 opacity-95" aria-hidden />;
      case "facility":
        return <Building2 className="h-3 w-3 shrink-0 opacity-95" aria-hidden />;
      case "health":
        return <HeartPulse className="h-3 w-3 shrink-0 opacity-95" aria-hidden />;
    }
  })();
  return (
    <span className="flex items-center gap-1 min-w-0 w-full">
      {icon}
      <span className="truncate font-medium">{title}</span>
    </span>
  );
}

export interface AdminUnifiedAvailabilityCalendarProps {
  calendarRequests: CalendarRequest[];
  guestHouseBookings: GuestHouseBooking[];
  sportsBookings: SportsBooking[];
  facilityBookings: FacilityBooking[];
  appointmentBookings: AppointmentBooking[];
  classrooms: Classroom[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function AdminUnifiedAvailabilityCalendar({
  calendarRequests,
  guestHouseBookings,
  sportsBookings,
  facilityBookings,
  appointmentBookings,
  classrooms,
  loading = false,
  onRefresh,
}: AdminUnifiedAvailabilityCalendarProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<UnifiedMeta | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [classroomId, setClassroomId] = useState<string>("");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    classes: true,
    guestHouse: true,
    sports: true,
    facilities: true,
    health: true,
  });

  const { min, max } = useMemo(() => {
    const base = new Date();
    base.setSeconds(0, 0);
    const minD = new Date(base);
    minD.setHours(8, 0, 0, 0);
    const maxD = new Date(base);
    maxD.setHours(23, 0, 0, 0);
    return { min: minD, max: maxD };
  }, []);

  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
    getDay,
    locales: {},
  });

  const events: UnifiedCalEvent[] = useMemo(() => {
    const out: UnifiedCalEvent[] = [];

    if (layers.classes) {
      for (const r of calendarRequests) {
        if (!passesStatusFilter(r.status, approvedOnly)) continue;
        if (classroomId && r.classroom_id !== classroomId) continue;
        const variant = r.request_kind === "exam" ? "exam" : "class";
        const room = r.classroom?.name ?? "—";
        const tag = variant === "exam" ? "Exam" : "Class";
        out.push({
          title: `${tag}: ${r.title}`,
          start: new Date(`${r.event_date}T${r.start_time}`),
          end: new Date(`${r.event_date}T${r.end_time}`),
          allDay: false,
          meta: { kind: "class", request: r, variant },
        });
      }
    }

    if (layers.guestHouse) {
      for (const b of guestHouseBookings) {
        if (!passesStatusFilter(b.status, approvedOnly)) continue;
        const room = b.room_number ?? "—";
        for (const day of dateStringsInclusive(b.check_in_date, b.check_out_date)) {
          const { start, end } = dayAllDayRange(day);
          out.push({
            title: `Guest: ${room} · ${b.guest_name}`,
            start,
            end,
            allDay: true,
            meta: { kind: "guest", booking: b, day },
          });
        }
      }
    }

    if (layers.sports) {
      for (const b of sportsBookings) {
        if (!passesStatusFilter(b.status, approvedOnly)) continue;
        const sport = SPORT_LABELS[b.sport];
        const venue = SPORTS_VENUE_LABELS[b.venue_code] ?? b.venue_code;
        out.push({
          title: `Sports: ${sport} · ${venue}`,
          start: new Date(`${b.booking_date}T${b.start_time}`),
          end: new Date(`${b.booking_date}T${b.end_time}`),
          allDay: false,
          meta: { kind: "sports", booking: b },
        });
      }
    }

    if (layers.facilities) {
      for (const b of facilityBookings) {
        if (!passesStatusFilter(b.status, approvedOnly)) continue;
        const typeLabel = FACILITY_TYPE_LABELS[b.facility_type];
        const venue = facilityVenueLabel(b.facility_type, b.venue_code);
        out.push({
          title: `Facility: ${typeLabel} · ${venue}`,
          start: new Date(`${b.booking_date}T${b.start_time}`),
          end: new Date(`${b.booking_date}T${b.end_time}`),
          allDay: false,
          meta: { kind: "facility", booking: b },
        });
      }
    }

    if (layers.health) {
      for (const b of appointmentBookings) {
        if (!passesStatusFilter(b.status, approvedOnly)) continue;
        const prov =
          APPOINTMENT_PROVIDER_LABELS[b.provider_code] ?? b.provider_code;
        const student = b.student?.full_name ?? "Student";
        out.push({
          title: `Health: ${prov} · ${student}`,
          start: new Date(`${b.booking_date}T${b.start_time}`),
          end: new Date(`${b.booking_date}T${b.end_time}`),
          allDay: false,
          meta: { kind: "health", booking: b },
        });
      }
    }

    return out;
  }, [
    calendarRequests,
    guestHouseBookings,
    sportsBookings,
    facilityBookings,
    appointmentBookings,
    layers,
    approvedOnly,
    classroomId,
  ]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <span className="sr-only">Loading availability</span>
        <BigCalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Approved bookings across classrooms, guest house, sports venues,
          campus facilities, and health appointments. Empty slots on the grid are
          free for timed resources; use the dedicated tabs for room-level guest
          house grids if you need them.
        </p>
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-3 py-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
            className="rounded border-input"
          />
          Approved only
        </label>
        <div className="h-4 w-px bg-border hidden sm:block" aria-hidden />
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["classes", "Classes & exams"],
              ["guestHouse", "Guest house"],
              ["sports", "Sports"],
              ["facilities", "Facilities"],
              ["health", "Counsellor / doctor"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggleLayer(key)}
                className="rounded border-input"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Classroom filter</Label>
          <Select
            value={classroomId || "all"}
            onValueChange={(v) => setClassroomId(!v || v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[220px] rounded-lg">
              <span className="truncate">
                {!classroomId
                  ? "All classrooms"
                  : toTitleCase(
                      classrooms.find((c) => c.id === classroomId)?.name ?? ""
                    ) || "Classroom"}
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
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.class }} />
          Class
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.exam }} />
          Exam
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.guest }} />
          Guest house
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.sports }} />
          Sports
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.facility }} />
          Facility
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.health }} />
          Health
        </span>
        {!approvedOnly && (
          <span className="text-amber-700 dark:text-amber-400">
            Dashed = pending or needs clarification
          </span>
        )}
      </div>

      <div className="rounded-lg border bg-background overflow-hidden p-2">
        <div className="h-[720px]">
          <BigCalendar
            localizer={localizer}
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            views={VIEWS}
            step={60}
            timeslots={1}
            min={min}
            max={max}
            dayLayoutAlgorithm="no-overlap"
            startAccessor="start"
            endAccessor="end"
            selectable={false}
            onSelectEvent={(e) => setSelected((e as UnifiedCalEvent).meta)}
            components={{
              event: UnifiedEventLabel,
            }}
            eventPropGetter={(event: RBCEvent) => {
              const cal = event as UnifiedCalEvent;
              const color = colorForMeta(cal.meta);
              const st =
                cal.meta.kind === "class"
                  ? cal.meta.request.status
                  : cal.meta.kind === "guest"
                    ? cal.meta.booking.status
                    : cal.meta.kind === "sports"
                      ? cal.meta.booking.status
                      : cal.meta.kind === "facility"
                        ? cal.meta.booking.status
                        : cal.meta.booking.status;
              const dashed =
                !approvedOnly &&
                (st === "pending" || st === "clarification_needed");
              return {
                className: dashed ? "rbc-calendar-event-task" : undefined,
                style: {
                  backgroundColor: color,
                  borderColor: color,
                  color: "white",
                  borderStyle: dashed ? "dashed" : "solid",
                  borderWidth: dashed ? 2 : 1,
                  opacity: dashed ? 0.92 : 1,
                },
              };
            }}
          />
        </div>
      </div>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setSelected(null)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-label="Booking details"
          >
            <div className="flex items-center justify-end p-2 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 text-sm">
              {selected.kind === "class" && (
                <>
                  <div className="flex items-start gap-3">
                    <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {selected.variant === "exam" ? "Exam" : "Class"} request
                      </p>
                      <h2 className="text-lg font-semibold">{selected.request.title}</h2>
                      <p className="text-muted-foreground mt-1">
                        {format(
                          new Date(`${selected.request.event_date}T12:00:00`),
                          "EEEE, MMMM d, yyyy"
                        )}
                        {" · "}
                        {selected.request.start_time.slice(0, 5)}–
                        {selected.request.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selected.request.classroom?.name ?? "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selected.request.professor?.full_name ??
                      selected.request.professor_email ??
                      "—"}
                  </div>
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground">{selected.request.status}</span>
                  </div>
                </>
              )}
              {selected.kind === "guest" && (
                <>
                  <div className="flex items-start gap-3">
                    <Home className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Guest house (night on calendar day)
                      </p>
                      <h2 className="text-lg font-semibold">{selected.booking.guest_name}</h2>
                      <p className="text-muted-foreground mt-1">
                        {GUEST_HOUSE_LABELS[selected.booking.guest_house]} · Room{" "}
                        {selected.booking.room_number ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p>
                    Calendar day:{" "}
                    <strong>
                      {format(parseISO(selected.day), "EEEE, MMMM d, yyyy")}
                    </strong>
                  </p>
                  <p className="text-muted-foreground">
                    Stay: {selected.booking.check_in_date} →{" "}
                    {selected.booking.check_out_date}
                  </p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.requester?.full_name ??
                      selected.booking.requester_email ??
                      "—"}
                  </div>
                  <div className="text-muted-foreground">
                    Status:{" "}
                    <span className="text-foreground">{selected.booking.status}</span>
                  </div>
                </>
              )}
              {selected.kind === "sports" && (
                <>
                  <div className="flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Sports booking
                      </p>
                      <h2 className="text-lg font-semibold">
                        {SPORT_LABELS[selected.booking.sport]}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {SPORTS_VENUE_LABELS[selected.booking.venue_code] ??
                      selected.booking.venue_code}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.booking_date} ·{" "}
                    {selected.booking.start_time.slice(0, 5)}–
                    {selected.booking.end_time.slice(0, 5)}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.requester?.full_name ??
                      selected.booking.requester_email ??
                      "—"}
                  </div>
                  <div className="text-muted-foreground">
                    Status:{" "}
                    <span className="text-foreground">{selected.booking.status}</span>
                  </div>
                </>
              )}
              {selected.kind === "facility" && (
                <>
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Facility booking
                      </p>
                      <h2 className="text-lg font-semibold">
                        {FACILITY_TYPE_LABELS[selected.booking.facility_type]}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {facilityVenueLabel(
                      selected.booking.facility_type,
                      selected.booking.venue_code
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.booking_date} ·{" "}
                    {selected.booking.start_time.slice(0, 5)}–
                    {selected.booking.end_time.slice(0, 5)}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.requester?.full_name ??
                      selected.booking.requester_email ??
                      "—"}
                  </div>
                  {selected.booking.purpose && (
                    <p className="text-muted-foreground">{selected.booking.purpose}</p>
                  )}
                  <div className="text-muted-foreground">
                    Status:{" "}
                    <span className="text-foreground">{selected.booking.status}</span>
                  </div>
                </>
              )}
              {selected.kind === "health" && (
                <>
                  <div className="flex items-start gap-3">
                    <HeartPulse className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Health appointment
                      </p>
                      <h2 className="text-lg font-semibold">
                        {APPOINTMENT_PROVIDER_LABELS[selected.booking.provider_code] ??
                          selected.booking.provider_code}
                      </h2>
                    </div>
                  </div>
                  <p className="text-muted-foreground capitalize">
                    {selected.booking.service_type.replace("_", " ")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.booking_date} ·{" "}
                    {selected.booking.start_time.slice(0, 5)}–
                    {selected.booking.end_time.slice(0, 5)}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selected.booking.student?.full_name ?? "Student"}
                  </div>
                  {selected.booking.notes && (
                    <p className="text-muted-foreground">{selected.booking.notes}</p>
                  )}
                  <div className="text-muted-foreground">
                    Status:{" "}
                    <span className="text-foreground">{selected.booking.status}</span>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
