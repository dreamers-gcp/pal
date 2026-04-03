"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FacilityBooking, FacilityBookingType, Profile } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeRangeSelect } from "@/components/ui/time-range-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FACILITY_TYPE_LABELS,
  facilityVenueLabel,
  normalizeTimeForDb,
  timeSlice,
  venuesForFacilityType,
} from "@/lib/campus-use-cases";
import { isTimeOverlap } from "@/lib/sports-booking";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";
import { Skeleton } from "@/components/ui/skeleton";

function statusBadgeClass(status: FacilityBooking["status"]): string {
  if (status === "approved") return "bg-accent/15 text-accent-foreground";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "clarification_needed") return "bg-primary/10 text-primary";
  return "bg-yellow-100 text-yellow-800";
}

function formatStatus(status: FacilityBooking["status"]): string {
  if (status === "clarification_needed") return "Clarification";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ProfessorCampusTab({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<FacilityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [facilityType, setFacilityType] = useState<FacilityBookingType>(
    "computer_hall"
  );
  const [venueCode, setVenueCode] = useState(
    () => venuesForFacilityType("computer_hall")[0]?.code ?? "computerhall1"
  );
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [purpose, setPurpose] = useState("");
  const [blocked, setBlocked] = useState(false);

  const venues = venuesForFacilityType(facilityType);

  const facilityAvailabilityResource = useMemo(() => {
    const vlist = venuesForFacilityType(facilityType);
    const vlabel = vlist.find((x) => x.code === venueCode)?.label ?? venueCode;
    return {
      kind: "facility" as const,
      facilityType,
      venueCode,
      label: `${FACILITY_TYPE_LABELS[facilityType]} · ${vlabel}`,
    };
  }, [facilityType, venueCode]);

  useEffect(() => {
    const v = venuesForFacilityType(facilityType);
    setVenueCode(v[0]?.code ?? "computerhall1");
  }, [facilityType]);

  const fetchMine = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("facility_bookings")
      .select("*")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false });
    setRows((data as FacilityBooking[]) ?? []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  useEffect(() => {
    if (!bookingDate || !startTime || !endTime) {
      setBlocked(false);
      return;
    }
    const supabase = createClient();
    const st = normalizeTimeForDb(startTime);
    const et = normalizeTimeForDb(endTime);
    supabase
      .from("facility_bookings")
      .select("start_time, end_time")
      .eq("facility_type", facilityType)
      .eq("venue_code", venueCode)
      .eq("booking_date", bookingDate)
      .eq("status", "approved")
      .then(({ data }) => {
        const clash = (data ?? []).some((row) =>
          isTimeOverlap(
            timeSlice(st),
            timeSlice(et),
            timeSlice(row.start_time),
            timeSlice(row.end_time)
          )
        );
        setBlocked(clash);
      });
  }, [bookingDate, startTime, endTime, facilityType, venueCode]);

  async function submit() {
    if (!bookingDate) {
      toast.error("Pick a date.");
      return;
    }
    if (startTime >= endTime) {
      toast.error("End time must be after start.");
      return;
    }
    if (blocked) {
      toast.error("This slot overlaps an approved booking.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("facility_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      requester_role: "professor",
      facility_type: facilityType,
      venue_code: venueCode,
      booking_date: bookingDate,
      start_time: normalizeTimeForDb(startTime),
      end_time: normalizeTimeForDb(endTime),
      purpose: purpose.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Facility request submitted.");
    setPurpose("");
    fetchMine();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Computer hall, board room & conference halls</CardTitle>
          <CardDescription>
            Same flow as guest-house requests: submit a slot; an admin approves.
            Each facility has three halls or rooms to choose from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Facility</Label>
              <Select
                value={facilityType}
                onValueChange={(v) =>
                  v && setFacilityType(v as FacilityBookingType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose facility type">
                    {FACILITY_TYPE_LABELS[facilityType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FACILITY_TYPE_LABELS) as FacilityBookingType[])
                    .filter((k) => k !== "auditorium")
                    .map((k) => (
                      <SelectItem key={k} value={k}>
                        {FACILITY_TYPE_LABELS[k]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room / hall</Label>
              <Select
                value={venueCode}
                onValueChange={(v) => v && setVenueCode(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a hall">
                    {venues.find((x) => x.code === venueCode)?.label ?? "Choose a hall"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.code} value={v.code}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResourceAvailabilityCalendar resource={facilityAvailabilityResource} />
          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker value={bookingDate} onChange={setBookingDate} />
          </div>
          <TimeRangeSelect
            startValue={startTime}
            endValue={endTime}
            onStartChange={setStartTime}
            onEndChange={setEndTime}
          />
          {blocked && (
            <p className="text-sm text-destructive">
              This time overlaps an approved booking for this hall.
            </p>
          )}
          <div className="space-y-2">
            <Label>Purpose (optional)</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="e.g. Dept review meeting"
            />
          </div>
          <Button onClick={submit} disabled={submitting || blocked}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your facility requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 py-2" aria-busy>
              <span className="sr-only">Loading facility requests</span>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-[66%] rounded-md" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-border/80 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {FACILITY_TYPE_LABELS[b.facility_type]}
                    </span>
                    <Badge className={statusBadgeClass(b.status)}>
                      {formatStatus(b.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {b.booking_date} · {timeSlice(b.start_time)}–
                    {timeSlice(b.end_time)} ·{" "}
                    {facilityVenueLabel(b.facility_type, b.venue_code)}
                  </p>
                  {b.purpose && <p className="mt-1">{b.purpose}</p>}
                  {b.admin_note && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Admin: {b.admin_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Exam hall & exam scheduling</CardTitle>
          <CardDescription>
            Book <strong>Exam Hall</strong> like any classroom from the{" "}
            <strong>Calendar</strong> tab (pick the room in the form). Use{" "}
            <strong>Request type → Exam scheduling</strong> in the booking form
            for exam blocks; admins approve in Event Requests as usual.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
