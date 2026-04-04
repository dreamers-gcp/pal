"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentProviderCode,
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
  addMinutesToHHmm,
  appointmentDurationMinutes,
  appointmentStartTimeOptions,
  normalizeTimeForDb,
  providersForService,
  timeSlice,
  tomorrowDateString,
} from "@/lib/campus-use-cases";
import { isTimeOverlap } from "@/lib/sports-booking";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";
import { useClientTodayIso } from "@/hooks/use-client-today";

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

type CampusServiceTab = "leave" | "mess" | "health";

const CAMPUS_SERVICE_LABELS: Record<CampusServiceTab, string> = {
  leave: "Leave request",
  mess: "Dining hall — extra guests",
  health: "Counsellor & doctor appointments",
};

export function StudentCampusTab({ profile }: { profile: Profile }) {
  const [campusService, setCampusService] = useState<CampusServiceTab>("leave");

  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [mess, setMess] = useState<MessExtraRequest[]>([]);

  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");
  const [lReason, setLReason] = useState("");
  const [lSubmit, setLSubmit] = useState(false);

  const [mDate, setMDate] = useState(tomorrowDateString());
  const [mPeriod, setMPeriod] = useState<MessMealPeriod>("lunch");
  const [mCount, setMCount] = useState(1);
  const [mNotes, setMNotes] = useState("");
  const [mSubmit, setMSubmit] = useState(false);

  const [svc, setSvc] = useState<"counsellor" | "doctor">("counsellor");
  const [prov, setProv] = useState<AppointmentProviderCode>("counsellor_1");
  const [pDate, setPDate] = useState("");
  const [pStart, setPStart] = useState("10:00");
  const [pNotes, setPNotes] = useState("");
  const [pBlocked, setPBlocked] = useState(false);
  const [pSubmit, setPSubmit] = useState(false);

  const todayIso = useClientTodayIso();
  const minMess = tomorrowDateString();

  useEffect(() => {
    const opts = providersForService(svc);
    setProv(opts[0]);
  }, [svc]);

  const apptDurationMins = appointmentDurationMinutes(svc);
  const pStartOptions = useMemo(
    () => appointmentStartTimeOptions(apptDurationMins),
    [apptDurationMins]
  );
  const pEndComputed = useMemo(
    () => addMinutesToHHmm(pStart, apptDurationMins),
    [pStart, apptDurationMins]
  );

  useEffect(() => {
    if (pStartOptions.length === 0) return;
    if (!pStartOptions.some((o) => o.value === pStart)) {
      setPStart(pStartOptions[0]!.value);
    }
  }, [svc, pStartOptions, pStart]);

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
    const [lr, mr] = await Promise.all([
      supabase
        .from("student_leave_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("mess_extra_requests")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);
    setLeaves((lr.data as StudentLeaveRequest[]) ?? []);
    setMess((mr.data as MessExtraRequest[]) ?? []);
  }, [profile.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pDate || !pStart) {
      setPBlocked(false);
      return;
    }
    const supabase = createClient();
    const st = normalizeTimeForDb(pStart);
    const et = normalizeTimeForDb(pEndComputed);
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
  }, [pDate, pStart, pEndComputed, prov]);

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
    if (pBlocked) {
      toast.error("Slot is already booked");
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
      end_time: normalizeTimeForDb(pEndComputed),
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Choose a campus service below. Leave, dining extras, and counsellor or doctor
        bookings are sent to an admin for approval. Your past requests for leave and
        mess appear under those forms.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Campus services</CardTitle>
          <CardDescription>
            Select the type of request, then complete the form that appears.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="campus-service">Request type</Label>
            <Select
              value={campusService}
              onValueChange={(v) => v && setCampusService(v as CampusServiceTab)}
            >
              <SelectTrigger id="campus-service" className="w-full">
                <SelectValue placeholder="Choose a service">
                  {CAMPUS_SERVICE_LABELS[campusService]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CAMPUS_SERVICE_LABELS) as CampusServiceTab[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CAMPUS_SERVICE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campusService === "leave" && (
            <div className="rounded-xl border bg-muted/15 p-4 space-y-4">
              <div>
                <p className="font-medium">Leave request</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Request time away from campus. Admins approve or follow up on the admin
                  dashboard.
                </p>
              </div>
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
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
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
            </div>
          )}

          {campusService === "mess" && (
            <div className="rounded-xl border bg-muted/15 p-4 space-y-4">
              <div>
                <p className="font-medium">Dining hall — extra guests</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tell the mess vendor one day ahead how many extra people join you for a
                  meal.
                </p>
              </div>
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
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
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
            </div>
          )}

          {campusService === "health" && (
            <div className="rounded-xl border bg-muted/15 p-4 space-y-4">
              <div>
                <p className="font-medium">Counsellor & doctor slots</p>
                <p className="text-sm text-muted-foreground mt-1">
                  One counsellor and two doctors — choose service, date, and start time.
                  Sessions are 45 minutes (counsellor) or 15 minutes (doctor). Admin
                  confirms.
                </p>
              </div>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label>Date</Label>
                  <DatePicker
                    value={pDate}
                    onChange={setPDate}
                    min={todayIso}
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Start time</Label>
                  <Select
                    value={pStart}
                    onValueChange={(v) => v && setPStart(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Start time">
                        {pStartOptions.find((o) => o.value === pStart)?.label ?? pStart}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {pStartOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {svc === "doctor" ? "15-minute" : "45-minute"} session (end time is set
                automatically).
              </p>
              {pBlocked && (
                <p className="text-sm text-destructive">Slot is already booked</p>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
