"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AppointmentProviderCode,
  Classroom,
  FacilityBookingType,
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
import { Label } from "@/components/ui/label";
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
  venuesForSport,
} from "@/lib/sports-booking";
import { GUEST_HOUSE_LABELS, roomOptionsForGuestHouse } from "@/lib/guest-house";

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

  const [sport, setSport] = useState<SportType>("badminton");
  const [sportVenue, setSportVenue] = useState<SportsVenueCode>(() =>
    venuesForSport("badminton")[0]!
  );
  useEffect(() => {
    const v = venuesForSport(sport)[0];
    if (v) setSportVenue(v);
  }, [sport]);

  const [guestHouse, setGuestHouse] = useState<GuestHouseCode>("international_centre");
  const [guestRoom, setGuestRoom] = useState("");
  useEffect(() => {
    const opts = roomOptionsForGuestHouse(guestHouse);
    const first = opts[0] ?? "";
    setGuestRoom((prev) => (opts.includes(prev) ? prev : first));
  }, [guestHouse]);

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
        if (!guestRoom) return null;
        return {
          kind: "guest_house",
          guestHouse,
          roomNumber: guestRoom,
          label: `${GUEST_HOUSE_LABELS[guestHouse]} · ${guestRoom}`,
        };
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
    guestHouse,
    guestRoom,
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
          ? "Guest house room schedule"
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
          Week view matches request forms: shaded blocks are approved; empty slots are
          free.
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
                  {(Object.keys(SPORT_LABELS) as SportType[]).map((s) => (
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
            <div className="space-y-2">
              <Label>Guest house</Label>
              <Select
                value={guestHouse}
                onValueChange={(v) => v && setGuestHouse(v as GuestHouseCode)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue>{GUEST_HOUSE_LABELS[guestHouse]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GUEST_HOUSE_LABELS) as GuestHouseCode[]).map((gh) => (
                    <SelectItem key={gh} value={gh}>
                      {GUEST_HOUSE_LABELS[gh]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={guestRoom}
                onValueChange={(v) => setGuestRoom(v ?? "")}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Room">
                    {guestRoom ? formatUiLabel(guestRoom) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roomOptionsForGuestHouse(guestHouse).map((r) => (
                    <SelectItem key={r} value={r}>
                      {formatUiLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <ResourceAvailabilityCalendar resource={resource} adminView />
      </CardContent>
    </Card>
  );
}
