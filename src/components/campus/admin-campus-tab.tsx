"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AppointmentBooking,
  FacilityBooking,
  MessExtraRequest,
  Profile,
  RequestStatus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  APPOINTMENT_PROVIDER_LABELS,
  FACILITY_TYPE_LABELS,
  MEAL_PERIOD_LABELS,
  facilityVenueLabel,
  timeSlice,
} from "@/lib/campus-use-cases";
import { CampusRequestsSkeleton } from "@/components/ui/loading-skeletons";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-accent/15 text-accent-foreground",
  rejected: "bg-destructive/10 text-destructive",
  clarification_needed: "bg-primary/10 text-primary",
};

function fmt(s: RequestStatus): string {
  if (s === "clarification_needed") return "Clarification";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Filter = "pending" | "approved" | "rejected" | "clarification_needed" | "all";

function filterRows<T extends { status: RequestStatus }>(rows: T[], f: Filter): T[] {
  if (f === "all") return rows;
  return rows.filter((r) => r.status === f);
}

const statButtons: { label: string; value: Filter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Clarification", value: "clarification_needed" },
];

function StatusStrip({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  return (
    <div className="rounded-xl border bg-muted/25 p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statButtons.map((stat) => (
          <button
            key={stat.value}
            type="button"
            onClick={() => onChange(stat.value)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
              value === stat.value
                ? "border-primary/50 bg-primary/5"
                : "bg-background hover:bg-muted/40"
            }`}
          >
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <span
              className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${statusColors[stat.value] ?? "bg-muted"}`}
            >
              {counts[stat.value]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminCampusTab({ profile }: { profile: Profile }) {
  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [facilities, setFacilities] = useState<FacilityBooking[]>([]);
  const [mess, setMess] = useState<MessExtraRequest[]>([]);
  const [appts, setAppts] = useState<AppointmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [fLeave, setFLeave] = useState<Filter>("pending");
  const [fFac, setFFac] = useState<Filter>("pending");
  const [fMess, setFMess] = useState<Filter>("pending");
  const [fAppt, setFAppt] = useState<Filter>("pending");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [lr, fr, mr, ar] = await Promise.all([
      supabase
        .from("student_leave_requests")
        .select("*, student:profiles!student_leave_requests_student_id_fkey(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("facility_bookings")
        .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("mess_extra_requests")
        .select("*, student:profiles!mess_extra_requests_student_id_fkey(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("appointment_bookings")
        .select("*, student:profiles!appointment_bookings_student_id_fkey(*)")
        .order("created_at", { ascending: false }),
    ]);
    setLeaves((lr.data as StudentLeaveRequest[]) ?? []);
    setFacilities((fr.data as FacilityBooking[]) ?? []);
    setMess((mr.data as MessExtraRequest[]) ?? []);
    setAppts((ar.data as AppointmentBooking[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function counts<T extends { status: RequestStatus }>(rows: T[]): Record<Filter, number> {
    return {
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      clarification_needed: rows.filter((r) => r.status === "clarification_needed").length,
      all: rows.length,
    };
  }

  async function patch(
    table: string,
    id: string,
    status: RequestStatus
  ) {
    setUpdating(id);
    const supabase = createClient();
    const { error } = await supabase
      .from(table)
      .update({
        status,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setUpdating(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated (${status}).`);
    reload();
  }

  const leaveCounts = counts(leaves);
  const facCounts = counts(facilities);
  const messCounts = counts(mess);
  const apptCounts = counts(appts);

  return (
    <Tabs defaultValue="leave" className="gap-4">
      <TabsList className="flex w-full flex-wrap h-auto gap-1">
        <TabsTrigger value="leave">Leave ({leaves.length})</TabsTrigger>
        <TabsTrigger value="facilities">Facilities ({facilities.length})</TabsTrigger>
        <TabsTrigger value="mess">Mess ({mess.length})</TabsTrigger>
        <TabsTrigger value="health">Counsellor / Doctors ({appts.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="leave" className="space-y-4">
        <StatusStrip value={fLeave} onChange={setFLeave} counts={leaveCounts} />
        {loading ? (
          <div className="py-2" aria-busy>
            <span className="sr-only">Loading leave requests</span>
            <CampusRequestsSkeleton />
          </div>
        ) : filterRows(leaves, fLeave).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No leave requests.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filterRows(leaves, fLeave).map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {r.student?.full_name ?? "Student"}
                    </CardTitle>
                    <Badge className={statusColors[r.status]}>{fmt(r.status)}</Badge>
                  </div>
                  <CardDescription>
                    {r.start_date} → {r.end_date}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {r.reason && <p>{r.reason}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("student_leave_requests", r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("student_leave_requests", r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() =>
                        patch("student_leave_requests", r.id, "clarification_needed")
                      }
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

      <TabsContent value="facilities" className="space-y-4">
        <StatusStrip value={fFac} onChange={setFFac} counts={facCounts} />
        {loading ? (
          <div className="py-2" aria-busy>
            <span className="sr-only">Loading facility requests</span>
            <CampusRequestsSkeleton />
          </div>
        ) : filterRows(facilities, fFac).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No facility bookings (auditorium, computer hall, board room, conference).
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filterRows(facilities, fFac).map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {FACILITY_TYPE_LABELS[b.facility_type]}
                    </CardTitle>
                    <Badge className={statusColors[b.status]}>{fmt(b.status)}</Badge>
                  </div>
                  <CardDescription>
                    {b.requester?.full_name ?? b.requester_email} · {b.booking_date} ·{" "}
                    {timeSlice(b.start_time)}–{timeSlice(b.end_time)} ·{" "}
                    {facilityVenueLabel(b.facility_type, b.venue_code)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {b.purpose && <p>{b.purpose}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch("facility_bookings", b.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch("facility_bookings", b.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch("facility_bookings", b.id, "clarification_needed")}
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

      <TabsContent value="mess" className="space-y-4">
        <StatusStrip value={fMess} onChange={setFMess} counts={messCounts} />
        {loading ? (
          <div className="py-2" aria-busy>
            <span className="sr-only">Loading mess requests</span>
            <CampusRequestsSkeleton />
          </div>
        ) : filterRows(mess, fMess).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No mess extra-guest requests.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filterRows(mess, fMess).map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {r.student?.full_name ?? "Student"}
                    </CardTitle>
                    <Badge className={statusColors[r.status]}>{fmt(r.status)}</Badge>
                  </div>
                  <CardDescription>
                    {r.meal_date} · {MEAL_PERIOD_LABELS[r.meal_period]} · +
                    {r.extra_guest_count} guests
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {r.notes && <p>{r.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("mess_extra_requests", r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("mess_extra_requests", r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("mess_extra_requests", r.id, "clarification_needed")}
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

      <TabsContent value="health" className="space-y-4">
        <StatusStrip value={fAppt} onChange={setFAppt} counts={apptCounts} />
        {loading ? (
          <div className="py-2" aria-busy>
            <span className="sr-only">Loading appointment requests</span>
            <CampusRequestsSkeleton />
          </div>
        ) : filterRows(appts, fAppt).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No appointment requests.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filterRows(appts, fAppt).map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {APPOINTMENT_PROVIDER_LABELS[r.provider_code]}
                    </CardTitle>
                    <Badge className={statusColors[r.status]}>{fmt(r.status)}</Badge>
                  </div>
                  <CardDescription>
                    {r.student?.full_name ?? "Student"} · {r.booking_date}{" "}
                    {timeSlice(r.start_time)}–{timeSlice(r.end_time)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {r.notes && <p>{r.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("appointment_bookings", r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch("appointment_bookings", r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() =>
                        patch("appointment_bookings", r.id, "clarification_needed")
                      }
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
    </Tabs>
  );
}
