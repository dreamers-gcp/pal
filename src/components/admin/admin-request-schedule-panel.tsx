"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AppointmentProviderCode,
  Classroom,
  FacilityBookingType,
  GuestHouseBooking,
  GuestHouseCode,
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
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResourceAvailabilityCalendar,
  type ResourceAvailabilitySpec,
} from "@/components/resource-availability-calendar";
import { formatUiLabel } from "@/lib/utils";
import {
  APPOINTMENT_PROVIDER_LABELS,
  FACILITY_TYPE_LABELS,
  facilityVenueLabel,
  providersForService,
  venuesForFacilityType,
} from "@/lib/campus-use-cases";
import {
  SPORT_LABELS,
  SPORTS_VENUE_LABELS,
  SPORT_TYPES_ORDER,
  venuesForSport,
} from "@/lib/sports-booking";
import { createClient } from "@/lib/supabase/client";
import {
  allocatedRoomsForBooking,
  GUEST_HOUSE_CODES,
  GUEST_HOUSE_LABELS,
  guestRoomKey,
  roomOptionsForGuestHouse,
  roomsByFloorForGuestHouse,
  TOTAL_GUEST_HOUSE_ROOM_COUNT,
} from "@/lib/guest-house";

function bookingTooltipText(bookings: GuestHouseBooking[]): string {
  if (!bookings.length) return "";
  return bookings
    .map(
      (b) =>
        `${b.guest_name}: ${b.check_in_date} to ${b.check_out_date} (${b.requester?.full_name ?? b.requester_email ?? "Unknown"})`
    )
    .join("\n");
}

type GuestHouseScope = GuestHouseCode | "all";

function GuestHouseDateRangeAvailability({
  startDate,
  endDate,
  guestHouseScope,
}: {
  startDate: string;
  endDate: string;
  guestHouseScope: GuestHouseScope;
}) {
  const [rows, setRows] = useState<GuestHouseBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const houses: GuestHouseCode[] =
    guestHouseScope === "all" ? GUEST_HOUSE_CODES : [guestHouseScope];

  useEffect(() => {
    setFocusKey(null);
  }, [startDate, endDate, guestHouseScope]);

  useEffect(() => {
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (start > end) {
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from("guest_house_bookings")
        .select(
          "id, check_in_date, check_out_date, guest_name, room_number, guest_house, allocated_rooms, requester_email, requester:profiles!guest_house_bookings_requester_id_fkey(full_name)"
        )
        .eq("status", "approved")
        .lte("check_in_date", end)
        .gte("check_out_date", start);
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as GuestHouseBooking[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const roomBookingMap = useMemo(() => {
    const map = new Map<string, GuestHouseBooking[]>();
    const start = startDate.trim();
    const end = endDate.trim();
    if (!start || !end || start > end) return map;
    for (const b of rows) {
      if (!(start <= b.check_out_date && b.check_in_date <= end)) continue;
      for (const a of allocatedRoomsForBooking(b)) {
        const key = guestRoomKey(a.guest_house, a.room_number);
        const arr = map.get(key) ?? [];
        arr.push(b);
        map.set(key, arr);
      }
    }
    return map;
  }, [rows, startDate, endDate]);

  const { totalRooms, bookedRooms, availableRooms } = useMemo(() => {
    const totalRooms =
      guestHouseScope === "all"
        ? TOTAL_GUEST_HOUSE_ROOM_COUNT
        : roomOptionsForGuestHouse(guestHouseScope).length;
    let booked = 0;
    for (const key of roomBookingMap.keys()) {
      const house = key.split(":")[0] as GuestHouseCode;
      if (houses.includes(house)) booked += 1;
    }
    return {
      totalRooms,
      bookedRooms: booked,
      availableRooms: Math.max(totalRooms - booked, 0),
    };
  }, [roomBookingMap, guestHouseScope, houses]);

  const focusBookings = focusKey ? (roomBookingMap.get(focusKey) ?? []) : [];

  const start = startDate.trim();
  const end = endDate.trim();

  if (!start || !end) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a start date and end date to load room availability.
      </p>
    );
  }

  if (start > end) {
    return (
      <p className="text-sm text-destructive">
        End date must be on or after start date.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-emerald-500/10 px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground">Available</p>
            <p className="text-sm font-semibold text-emerald-700">{availableRooms}</p>
          </div>
          <div className="rounded-md border bg-amber-500/10 px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground">Booked</p>
            <p className="text-sm font-semibold text-amber-700">{bookedRooms}</p>
          </div>
          <div className="rounded-md border bg-muted px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground">Rooms in view</p>
            <p className="text-sm font-semibold">{totalRooms}</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-lg" />
      ) : (
        <div className="rounded-lg border p-3 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-600/80" />
              Booked
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-600/70" />
              Free
            </span>
          </div>
          {houses.map((house) => (
            <div key={house} className="space-y-2">
              <p className="text-xs font-semibold">{GUEST_HOUSE_LABELS[house]}</p>
              {roomsByFloorForGuestHouse(house).map((section) => (
                <div key={`${house}-${section.floor}`} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Floor {section.floor}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {section.rooms.map((room) => {
                      const key = guestRoomKey(house, room);
                      const roomBookings = roomBookingMap.get(key) ?? [];
                      const blocked = roomBookings.length > 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          onMouseEnter={() =>
                            blocked ? setFocusKey(key) : undefined
                          }
                          onFocus={() => (blocked ? setFocusKey(key) : undefined)}
                          onClick={() => {
                            if (blocked) setFocusKey(key);
                            else setFocusKey(null);
                          }}
                          title={blocked ? bookingTooltipText(roomBookings) : undefined}
                          className={`rounded border px-1 py-1 text-[11px] font-medium transition-colors ${
                            blocked
                              ? "border-amber-600/45 bg-amber-500/15 text-amber-900 line-through dark:text-amber-100"
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
      )}

      {focusKey && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold">
            Bookings for {focusKey.replace(":", " · ")}
          </p>
          {focusBookings.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookings for this room.</p>
          ) : (
            <div className="space-y-1.5">
              {focusBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-md border bg-background px-2 py-1.5 text-xs"
                >
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
  );
}

export type AdminRequestScheduleMode =
  | "event"
  | "guest_house"
  | "sports"
  | "leave"
  | "facility"
  | "mess"
  | "health";

const FACILITY_TYPES = Object.keys(FACILITY_TYPE_LABELS) as FacilityBookingType[];

/**
 * Week calendar of approved bookings for admin (matches student request-time availability).
 */
export function AdminRequestSchedulePanel({
  mode,
  classrooms = [],
  className,
}: {
  mode: AdminRequestScheduleMode;
  classrooms?: Classroom[];
  className?: string;
}) {
  const [classroomId, setClassroomId] = useState("");

  useEffect(() => {
    if (classrooms.length === 0) {
      setClassroomId("");
      return;
    }
    setClassroomId((prev) =>
      prev && classrooms.some((c) => c.id === prev) ? prev : classrooms[0].id
    );
  }, [classrooms]);

  const [sport, setSport] = useState<SportType>("cricket");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>(() =>
    venuesForSport("cricket")[0]!
  );
  useEffect(() => {
    const v = venuesForSport(sport)[0];
    if (v) setSportVenue(v);
  }, [sport]);

  const [guestHouseScope, setGuestHouseScope] = useState<GuestHouseScope>("all");
  const [guestAvailStart, setGuestAvailStart] = useState("");
  const [guestAvailEnd, setGuestAvailEnd] = useState("");

  const [facType, setFacType] = useState<FacilityBookingType>("auditorium");
  const [facVenue, setFacVenue] = useState("");
  useEffect(() => {
    const opts = venuesForFacilityType(facType);
    const first = opts[0]?.code ?? "";
    setFacVenue((prev) => (opts.some((o) => o.code === prev) ? prev : first));
  }, [facType]);

  const [svc, setSvc] = useState<"counsellor" | "doctor">("counsellor");
  const [prov, setProv] = useState<AppointmentProviderCode>("counsellor_1");
  useEffect(() => {
    const opts = providersForService(svc);
    setProv(opts[0]!);
  }, [svc]);

  const resource = useMemo((): ResourceAvailabilitySpec | null => {
    switch (mode) {
      case "event":
        if (!classroomId) return null;
        return {
          kind: "classroom",
          classroomId,
          label: formatUiLabel(
            classrooms.find((c) => c.id === classroomId)?.name ?? "Classroom"
          ),
        };
      case "sports":
        return {
          kind: "sports",
          sport,
          venueCode: sportVenue,
          label: SPORTS_VENUE_LABELS[sportVenue],
        };
      case "guest_house":
        return null;
      case "leave":
        return { kind: "leave" };
      case "mess":
        return { kind: "mess" };
      case "facility":
        if (!facVenue) return null;
        return {
          kind: "facility",
          facilityType: facType,
          venueCode: facVenue,
          label: `${FACILITY_TYPE_LABELS[facType]} · ${facilityVenueLabel(facType, facVenue)}`,
        };
      case "health":
        return {
          kind: "appointment",
          providerCode: prov,
          label: APPOINTMENT_PROVIDER_LABELS[prov],
        };
      default:
        return null;
    }
  }, [
    mode,
    classroomId,
    classrooms,
    sport,
    sportVenue,
    facType,
    facVenue,
    prov,
  ]);

  const headline =
    mode === "event"
      ? "Classroom schedule"
      : mode === "sports"
        ? "Sports venue schedule"
        : mode === "guest_house"
          ? "Guest house availability"
          : mode === "leave"
            ? "Approved leave (all students)"
            : mode === "mess"
              ? "Mess extra guests"
              : mode === "facility"
                ? "Facility schedule"
                : "Provider schedule";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{headline}</CardTitle>
        <CardDescription>
          {mode === "guest_house" ? (
            <>
              Choose a stay window and which building(s) to inspect. Room tiles match
              the guest request sidebar: booked rooms are shaded; free rooms are green.
            </>
          ) : (
            <>
              Week view matches request forms: shaded blocks are approved; empty slots are
              free.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "event" && (
          <div className="space-y-2">
            <Label>Classroom</Label>
            {classrooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classrooms configured.</p>
            ) : (
              <Select
                value={classroomId}
                onValueChange={(v) => setClassroomId(v ?? "")}
              >
                <SelectTrigger className="max-w-md rounded-lg">
                  <SelectValue placeholder="Choose classroom">
                    {classroomId
                      ? formatUiLabel(
                          classrooms.find((c) => c.id === classroomId)?.name ??
                            classroomId
                        )
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {formatUiLabel(c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {mode === "sports" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select
                value={sport}
                onValueChange={(v) => v && setSport(v as SportType)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>{SPORT_LABELS[sport]}</SelectValue>
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
              <Label>Venue</Label>
              <Select
                value={sportVenue}
                onValueChange={(v) => v && setSportVenue(v as SportsVenueCode)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>{SPORTS_VENUE_LABELS[sportVenue]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {venuesForSport(sport).map((v) => (
                    <SelectItem key={v} value={v}>
                      {SPORTS_VENUE_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode === "guest_house" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Guest house</Label>
              <Select
                value={guestHouseScope}
                onValueChange={(v) =>
                  v && setGuestHouseScope(v as GuestHouseScope)
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>
                    {guestHouseScope === "all"
                      ? "All guest houses"
                      : GUEST_HOUSE_LABELS[guestHouseScope]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All guest houses</SelectItem>
                  {(Object.keys(GUEST_HOUSE_LABELS) as GuestHouseCode[]).map((gh) => (
                    <SelectItem key={gh} value={gh}>
                      {GUEST_HOUSE_LABELS[gh]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <DatePicker
                value={guestAvailStart}
                onChange={setGuestAvailStart}
                placeholder="Pick date"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <DatePicker
                value={guestAvailEnd}
                onChange={setGuestAvailEnd}
                min={guestAvailStart || undefined}
                placeholder="Pick date"
                className="rounded-lg"
              />
            </div>
          </div>
        )}

        {mode === "facility" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Facility type</Label>
              <Select
                value={facType}
                onValueChange={(v) => v && setFacType(v as FacilityBookingType)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>{FACILITY_TYPE_LABELS[facType]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {FACILITY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room / hall</Label>
              <Select
                value={facVenue}
                onValueChange={(v) => setFacVenue(v ?? "")}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Venue">
                    {facVenue
                      ? facilityVenueLabel(facType, facVenue)
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {venuesForFacilityType(facType).map((v) => (
                    <SelectItem key={v.code} value={v.code}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode === "health" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={svc}
                onValueChange={(v) => v && setSvc(v as "counsellor" | "doctor")}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>
                    {svc === "counsellor" ? "Counsellor" : "Doctor"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counsellor">Counsellor</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={prov}
                onValueChange={(v) => v && setProv(v as AppointmentProviderCode)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>{APPOINTMENT_PROVIDER_LABELS[prov]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {providersForService(svc).map((p) => (
                    <SelectItem key={p} value={p}>
                      {APPOINTMENT_PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode === "guest_house" ? (
          <GuestHouseDateRangeAvailability
            startDate={guestAvailStart}
            endDate={guestAvailEnd}
            guestHouseScope={guestHouseScope}
          />
        ) : (
          <ResourceAvailabilityCalendar resource={resource} adminView />
        )}
      </CardContent>
    </Card>
  );
}
