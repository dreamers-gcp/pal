"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentBooking,
  AppointmentProviderCode,
  FacilityBooking,
  FacilityBookingType,
  MessExtraRequest,
  MessMealPeriod,
  Profile,
  StudentLeaveRequest,
} from "@/lib/types";
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
import { Input } from "@/components/ui/input";
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
  APPOINTMENT_PROVIDER_LABELS,
  MEAL_PERIOD_LABELS,
  facilityVenueLabel,
  normalizeTimeForDb,
  providersForService,
  timeSlice,
  tomorrowDateString,
  venuesForFacilityType,
} from "@/lib/campus-use-cases";
import { isTimeOverlap } from "@/lib/sports-booking";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";

function badge(status: string) {
  if (status === "approved") return "bg-accent/15 text-accent-foreground";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "clarification_needed") return "bg-primary/10 text-primary";
  return "bg-yellow-100 text-yellow-800";
}

function fmtStatus(s: string) {
  if (s === "clarification_needed") return "Clarification";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StudentCampusTab({ profile }: { profile: Profile }) {
  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [auditorium, setAuditorium] = useState<FacilityBooking[]>([]);
  const [mess, setMess] = useState<MessExtraRequest[]>([]);
  const [appts, setAppts] = useState<AppointmentBooking[]>([]);

  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");
  const [lReason, setLReason] = useState("");
  const [lSubmit, setLSubmit] = useState(false);

  const [aDate, setADate] = useState("");
  const [aVenue, setAVenue] = useState(
    () => venuesForFacilityType("auditorium")[0]?.code ?? "auditorium1"
  );
  const [aStart, setAStart] = useState("14:00");
  const [aEnd, setAEnd] = useState("16:00");
  const [aPurpose, setAPurpose] = useState("");
  const [aBlocked, setABlocked] = useState(false);
  const [aSubmit, setASubmit] = useState(false);

  const [mDate, setMDate] = useState(tomorrowDateString());
  const [mPeriod, setMPeriod] = useState<MessMealPeriod>("lunch");
  const [mCount, setMCount] = useState(1);
  const [mNotes, setMNotes] = useState("");
  const [mSubmit, setMSubmit] = useState(false);

  const [svc, setSvc] = useState<"counsellor" | "doctor">("counsellor");
  const [prov, setProv] = useState<AppointmentProviderCode>("counsellor_1");
  const [pDate, setPDate] = useState("");
  const [pStart, setPStart] = useState("10:00");
  const [pEnd, setPEnd] = useState("10:30");
  const [pNotes, setPNotes] = useState("");
  const [pBlocked, setPBlocked] = useState(false);
  const [pSubmit, setPSubmit] = useState(false);

  const minMess = tomorrowDateString();

  useEffect(() => {
    const opts = providersForService(svc);
    setProv(opts[0]);
  }, [svc]);

  const auditoriumAvailabilityResource = useMemo(
    () =>
      ({
        kind: "facility" as const,
        facilityType: "auditorium" as const,
        venueCode: aVenue,
        label: facilityVenueLabel("auditorium", aVenue),
      }),
    [aVenue]
  );

  const appointmentAvailabilityResource = useMemo(
    () =>
      ({
        kind: "appointment" as const,
        providerCode: prov,
        label: APPOINTMENT_PROVIDER_LABELS[prov],
      }),
    [prov]
  );

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [lr, ar, mr, pr] = await Promise.all([
      supabase
        .from("student_leave_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("facility_bookings")
        .select("*")
        .eq("requester_id", profile.id)
        .eq("facility_type", "auditorium")
        .order("created_at", { ascending: false }),
      supabase
        .from("mess_extra_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointment_bookings")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);
    setLeaves((lr.data as StudentLeaveRequest[]) ?? []);
    setAuditorium((ar.data as FacilityBooking[]) ?? []);
    setMess((mr.data as MessExtraRequest[]) ?? []);
    setAppts((pr.data as AppointmentBooking[]) ?? []);
  }, [profile.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!aDate || !aStart || !aEnd) {
      setABlocked(false);
      return;
    }
    const supabase = createClient();
    const st = normalizeTimeForDb(aStart);
    const et = normalizeTimeForDb(aEnd);
    supabase
      .from("facility_bookings")
      .select("start_time, end_time")
      .eq("facility_type", "auditorium")
      .eq("venue_code", aVenue)
      .eq("booking_date", aDate)
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
        setABlocked(clash);
      });
  }, [aDate, aStart, aEnd, aVenue]);

  useEffect(() => {
    if (!pDate || !pStart || !pEnd) {
      setPBlocked(false);
      return;
    }
    const supabase = createClient();
    const st = normalizeTimeForDb(pStart);
    const et = normalizeTimeForDb(pEnd);
    supabase
      .from("appointment_bookings")
      .select("start_time, end_time")
      .eq("provider_code", prov)
      .eq("booking_date", pDate)
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
        setPBlocked(clash);
      });
  }, [pDate, pStart, pEnd, prov]);

  async function submitLeave() {
    if (!lStart || !lEnd) {
      toast.error("Select leave dates.");
      return;
    }
    if (lEnd < lStart) {
      toast.error("End date cannot be before start.");
      return;
    }
    setLSubmit(true);
    const supabase = createClient();
    const { data: approvedLeaves } = await supabase
      .from("student_leave_requests")
      .select("id, start_date, end_date")
      .eq("student_id", profile.id)
      .eq("status", "approved");
    const overlapsApproved = (approvedLeaves ?? []).some(
      (row) => lStart <= row.end_date && row.start_date <= lEnd
    );
    if (overlapsApproved) {
      toast.error("You already have approved leave that overlaps these dates.");
      setLSubmit(false);
      return;
    }
    const { error } = await supabase.from("student_leave_requests").insert({
      student_id: profile.id,
      start_date: lStart,
      end_date: lEnd,
      reason: lReason.trim() || null,
    });
    setLSubmit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave request submitted.");
    setLReason("");
    reload();
  }

  async function submitAuditorium() {
    if (!aDate) {
      toast.error("Pick a date.");
      return;
    }
    if (aStart >= aEnd) {
      toast.error("End time after start time.");
      return;
    }
    if (aBlocked) {
      toast.error("Slot unavailable.");
      return;
    }
    setASubmit(true);
    const supabase = createClient();
    const { error } = await supabase.from("facility_bookings").insert({
      requester_id: profile.id,
      requester_email: profile.email,
      requester_role: "student",
      facility_type: "auditorium",
      venue_code: aVenue,
      booking_date: aDate,
      start_time: normalizeTimeForDb(aStart),
      end_time: normalizeTimeForDb(aEnd),
      purpose: aPurpose.trim() || null,
    });
    setASubmit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Auditorium request submitted.");
    setAPurpose("");
    reload();
  }

  async function submitMess() {
    if (!mDate) {
      toast.error("Pick a meal date.");
      return;
    }
    if (mDate < minMess) {
      toast.error("Mess extras must be requested at least one day in advance.");
      return;
    }
    setMSubmit(true);
    const supabase = createClient();
    const { data: approvedMess } = await supabase
      .from("mess_extra_requests")
      .select("id")
      .eq("student_id", profile.id)
      .eq("meal_date", mDate)
      .eq("meal_period", mPeriod)
      .eq("status", "approved")
      .maybeSingle();
    if (approvedMess) {
      toast.error(
        "You already have an approved mess request for this meal date and period."
      );
      setMSubmit(false);
      return;
    }
    const { error } = await supabase.from("mess_extra_requests").insert({
      student_id: profile.id,
      meal_date: mDate,
      meal_period: mPeriod,
      extra_guest_count: mCount,
      notes: mNotes.trim() || null,
    });
    setMSubmit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mess request submitted.");
    setMNotes("");
    reload();
  }

  async function submitAppt() {
    if (!pDate) {
      toast.error("Pick a date.");
      return;
    }
    if (pStart >= pEnd) {
      toast.error("End time after start.");
      return;
    }
    if (pBlocked) {
      toast.error("That slot is already booked.");
      return;
    }
    setPSubmit(true);
    const supabase = createClient();
    const { error } = await supabase.from("appointment_bookings").insert({
      student_id: profile.id,
      service_type: svc,
      provider_code: prov,
      booking_date: pDate,
      start_time: normalizeTimeForDb(pStart),
      end_time: normalizeTimeForDb(pEnd),
      notes: pNotes.trim() || null,
    });
    setPSubmit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Appointment request submitted.");
    setPNotes("");
    reload();
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Leave, auditorium, dining (extra guests), counsellor and doctor bookings
        are sent to an admin for approval. Track status below each form.
      </p>

      {/* Leave */}
      <Card>
        <CardHeader>
          <CardTitle>Leave request</CardTitle>
          <CardDescription>
            Request time away from campus. Admins approve or follow up here and
            on the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <DatePicker value={lStart} onChange={setLStart} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <DatePicker value={lEnd} onChange={setLEnd} min={lStart || undefined} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={lReason} onChange={(e) => setLReason(e.target.value)} rows={2} />
          </div>
          <Button onClick={submitLeave} disabled={lSubmit}>
            {lSubmit ? "Submitting…" : "Submit leave request"}
          </Button>
          {leaves.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {leaves.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {r.start_date} → {r.end_date}
                  </span>
                  <Badge className={badge(r.status)}>{fmtStatus(r.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Auditorium */}
      <Card>
        <CardHeader>
          <CardTitle>Auditorium booking</CardTitle>
          <CardDescription>
            Three auditoriums — choose a hall, date, and time. Admin approves like
            guest house requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Auditorium</Label>
            <Select
              value={aVenue}
              onValueChange={(v) => v && setAVenue(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an auditorium">
                  {facilityVenueLabel("auditorium", aVenue)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {venuesForFacilityType("auditorium").map((v) => (
                  <SelectItem key={v.code} value={v.code}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ResourceAvailabilityCalendar resource={auditoriumAvailabilityResource} />
          <DatePicker value={aDate} onChange={setADate} />
          <TimeRangeSelect
            startValue={aStart}
            endValue={aEnd}
            onStartChange={setAStart}
            onEndChange={setAEnd}
          />
          {aBlocked && (
            <p className="text-sm text-destructive">Overlaps an approved booking.</p>
          )}
          <Textarea
            placeholder="Purpose / event name"
            value={aPurpose}
            onChange={(e) => setAPurpose(e.target.value)}
            rows={2}
          />
          <Button onClick={submitAuditorium} disabled={aSubmit || aBlocked}>
            {aSubmit ? "Submitting…" : "Request auditorium"}
          </Button>
          {auditorium.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {auditorium.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {facilityVenueLabel(
                      r.facility_type as FacilityBookingType,
                      r.venue_code
                    )}{" "}
                    · {r.booking_date} {timeSlice(r.start_time)}–{timeSlice(r.end_time)}
                  </span>
                  <Badge className={badge(r.status)}>{fmtStatus(r.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Mess */}
      <Card>
        <CardHeader>
          <CardTitle>Dining hall — extra guests</CardTitle>
          <CardDescription>
            Tell the mess vendor one day ahead how many extra people join you for a
            meal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DatePicker value={mDate} onChange={setMDate} min={minMess} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Meal</Label>
              <Select
                value={mPeriod}
                onValueChange={(v) => v && setMPeriod(v as MessMealPeriod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose meal">
                    {MEAL_PERIOD_LABELS[mPeriod]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEAL_PERIOD_LABELS) as MessMealPeriod[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {MEAL_PERIOD_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Extra guests</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={mCount}
                onChange={(e) => setMCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          </div>
          <Textarea
            placeholder="Notes (optional)"
            value={mNotes}
            onChange={(e) => setMNotes(e.target.value)}
            rows={2}
          />
          <Button onClick={submitMess} disabled={mSubmit}>
            {mSubmit ? "Submitting…" : "Submit mess request"}
          </Button>
          {mess.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {mess.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {r.meal_date} · {MEAL_PERIOD_LABELS[r.meal_period]} · +
                    {r.extra_guest_count}
                  </span>
                  <Badge className={badge(r.status)}>{fmtStatus(r.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Health appointments */}
      <Card>
        <CardHeader>
          <CardTitle>Counsellor & doctor slots</CardTitle>
          <CardDescription>
            One counsellor and two doctors — choose service, date, and time. Admin
            confirms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={svc}
                onValueChange={(v) => v && setSvc(v as "counsellor" | "doctor")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose service">
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
                <SelectTrigger>
                  <SelectValue placeholder="Choose provider">
                    {APPOINTMENT_PROVIDER_LABELS[prov]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {providersForService(svc).map((c) => (
                    <SelectItem key={c} value={c}>
                      {APPOINTMENT_PROVIDER_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResourceAvailabilityCalendar resource={appointmentAvailabilityResource} />
          <DatePicker value={pDate} onChange={setPDate} />
          <TimeRangeSelect
            startValue={pStart}
            endValue={pEnd}
            onStartChange={setPStart}
            onEndChange={setPEnd}
          />
          {pBlocked && (
            <p className="text-sm text-destructive">Slot taken for this provider.</p>
          )}
          <Textarea
            placeholder="Notes (optional)"
            value={pNotes}
            onChange={(e) => setPNotes(e.target.value)}
            rows={2}
          />
          <Button onClick={submitAppt} disabled={pSubmit || pBlocked}>
            {pSubmit ? "Submitting…" : "Request appointment"}
          </Button>
          {appts.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {appts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {APPOINTMENT_PROVIDER_LABELS[r.provider_code]} · {r.booking_date}{" "}
                    {timeSlice(r.start_time)}–{timeSlice(r.end_time)}
                  </span>
                  <Badge className={badge(r.status)}>{fmtStatus(r.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
