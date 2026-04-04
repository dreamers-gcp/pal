"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import {
  APPOINTMENT_PROVIDER_LABELS,
  FACILITY_TYPE_LABELS,
  MEAL_PERIOD_LABELS,
  facilityVenueLabel,
  timeSlice,
} from "@/lib/campus-use-cases";
import { BookingCardsSkeleton } from "@/components/ui/loading-skeletons";
import { formatSubmittedAt, sortByCreatedAtAsc } from "@/lib/utils";

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

export type CampusApprovalKind = "leave" | "facilities" | "mess" | "health";

type StatusFilter = "pending" | "approved" | "rejected" | "clarification_needed";

const STAT_CONFIG: {
  label: string;
  value: StatusFilter;
  color: string;
  chip: string;
}[] = [
  { label: "Pending", value: "pending", color: "text-yellow-700", chip: "bg-yellow-100" },
  {
    label: "Approved",
    value: "approved",
    color: "text-accent-foreground",
    chip: "bg-accent/20",
  },
  { label: "Rejected", value: "rejected", color: "text-destructive", chip: "bg-destructive/10" },
  {
    label: "Clarification",
    value: "clarification_needed",
    color: "text-primary",
    chip: "bg-primary/10",
  },
];

function filterByStatus<T extends { status: RequestStatus }>(
  rows: T[],
  f: StatusFilter
): T[] {
  return rows.filter((r) => r.status === f);
}

function countByStatus(rows: { status: RequestStatus }[], s: StatusFilter): number {
  return rows.filter((r) => r.status === s).length;
}

const TABLE: Record<CampusApprovalKind, string> = {
  leave: "student_leave_requests",
  facilities: "facility_bookings",
  mess: "mess_extra_requests",
  health: "appointment_bookings",
};

/**
 * Admin approval UI for one campus request type — same pattern as guest house / sports tabs.
 */
export function AdminCampusApprovalSection({
  profile,
  kind,
}: {
  profile: Profile;
  kind: CampusApprovalKind;
}) {
  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [facilities, setFacilities] = useState<FacilityBooking[]>([]);
  const [mess, setMess] = useState<MessExtraRequest[]>([]);
  const [appts, setAppts] = useState<AppointmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (kind === "leave") {
      const { data } = await supabase
        .from("student_leave_requests")
        .select("*, student:profiles!student_leave_requests_student_id_fkey(*)")
        .order("created_at", { ascending: false });
      setLeaves((data as StudentLeaveRequest[]) ?? []);
    } else if (kind === "facilities") {
      const { data } = await supabase
        .from("facility_bookings")
        .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
        .order("created_at", { ascending: false });
      setFacilities((data as FacilityBooking[]) ?? []);
    } else if (kind === "mess") {
      const { data } = await supabase
        .from("mess_extra_requests")
        .select("*, student:profiles!mess_extra_requests_student_id_fkey(*)")
        .order("created_at", { ascending: false });
      setMess((data as MessExtraRequest[]) ?? []);
    } else {
      const { data } = await supabase
        .from("appointment_bookings")
        .select("*, student:profiles!appointment_bookings_student_id_fkey(*)")
        .order("created_at", { ascending: false });
      setAppts((data as AppointmentBooking[]) ?? []);
    }
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patch(id: string, status: RequestStatus) {
    setUpdating(id);
    const supabase = createClient();
    const { error } = await supabase
      .from(TABLE[kind])
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

  const rowsForCounts = useMemo((): { status: RequestStatus }[] => {
    if (kind === "leave") return leaves;
    if (kind === "facilities") return facilities;
    if (kind === "mess") return mess;
    return appts;
  }, [kind, leaves, facilities, mess, appts]);

  const filteredLeaves = useMemo(
    () => filterByStatus(leaves, statusFilter),
    [leaves, statusFilter]
  );
  const filteredFacilities = useMemo(
    () => filterByStatus(facilities, statusFilter),
    [facilities, statusFilter]
  );
  const filteredMess = useMemo(
    () => filterByStatus(mess, statusFilter),
    [mess, statusFilter]
  );
  const filteredAppts = useMemo(
    () => filterByStatus(appts, statusFilter),
    [appts, statusFilter]
  );

  const sortedLeaves = useMemo(
    () => sortByCreatedAtAsc(filteredLeaves),
    [filteredLeaves]
  );
  const sortedFacilities = useMemo(
    () => sortByCreatedAtAsc(filteredFacilities),
    [filteredFacilities]
  );
  const sortedMess = useMemo(
    () => sortByCreatedAtAsc(filteredMess),
    [filteredMess]
  );
  const sortedAppts = useMemo(
    () => sortByCreatedAtAsc(filteredAppts),
    [filteredAppts]
  );

  const emptyMessage =
    kind === "leave"
      ? "No leave requests in this status."
      : kind === "facilities"
        ? "No facility bookings in this status."
        : kind === "mess"
          ? "No mess extra-guest requests in this status."
          : "No appointment requests in this status.";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-muted/25 p-2.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAT_CONFIG.map((stat) => (
            <button
              key={stat.value}
              type="button"
              onClick={() => setStatusFilter(stat.value)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                statusFilter === stat.value
                  ? "border-primary/50 bg-primary/5"
                  : "bg-background hover:bg-muted/40"
              }`}
            >
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span
                className={`inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold ${stat.color} ${stat.chip}`}
              >
                {countByStatus(rowsForCounts, stat.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-6">
          <BookingCardsSkeleton count={4} />
        </div>
      ) : kind === "leave" && sortedLeaves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : kind === "facilities" && sortedFacilities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : kind === "mess" && sortedMess.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : kind === "health" && sortedAppts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kind === "leave" &&
            sortedLeaves.map((r) => (
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
                  <p className="text-xs text-muted-foreground">
                    Submitted at {formatSubmittedAt(r.created_at)}
                  </p>
                  {r.reason && <p>{r.reason}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "clarification_needed")}
                    >
                      Clarify
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          {kind === "facilities" &&
            sortedFacilities.map((b) => (
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
                  <p className="text-xs text-muted-foreground">
                    Submitted at {formatSubmittedAt(b.created_at)}
                  </p>
                  {b.purpose && <p>{b.purpose}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch(b.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch(b.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === b.id}
                      onClick={() => patch(b.id, "clarification_needed")}
                    >
                      Clarify
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          {kind === "mess" &&
            sortedMess.map((r) => (
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
                  <p className="text-xs text-muted-foreground">
                    Submitted at {formatSubmittedAt(r.created_at)}
                  </p>
                  {r.notes && <p>{r.notes}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "clarification_needed")}
                    >
                      Clarify
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          {kind === "health" &&
            sortedAppts.map((r) => (
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
                  <p className="text-xs text-muted-foreground">
                    Submitted at {formatSubmittedAt(r.created_at)}
                  </p>
                  {r.notes && <p>{r.notes}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updating === r.id}
                      onClick={() => patch(r.id, "clarification_needed")}
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
  );
}
