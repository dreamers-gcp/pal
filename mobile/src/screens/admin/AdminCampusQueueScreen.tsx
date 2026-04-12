import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { RequestStatusFilterChips } from "../../components/RequestStatusFilterChips";
import { adminRequestActionVisibility } from "../../lib/admin-request-action-visibility";
import {
  FACILITY_TYPE_LABELS,
  facilityVenueLabel,
} from "../../lib/facility-labels";
import {
  APPOINTMENT_PROVIDER_LABELS,
  MEAL_PERIOD_LABELS,
} from "../../lib/campus-use-mobile";
import { requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import type {
  AppointmentBooking,
  FacilityBooking,
  FacilityBookingType,
  MessExtraRequest,
  Profile,
  RequestStatus,
  StudentLeaveRequest,
} from "../../types";
import { theme } from "../../theme";

export type CampusQueueKind = "leave" | "facilities" | "mess" | "health";

type StatusFilter = "all" | RequestStatus;

const TABLE: Record<CampusQueueKind, string> = {
  leave: "student_leave_requests",
  facilities: "facility_bookings",
  mess: "mess_extra_requests",
  health: "appointment_bookings",
};

export function AdminCampusQueueScreen({
  profile,
  kind,
}: {
  profile: Profile;
  kind: CampusQueueKind;
}) {
  const [leaves, setLeaves] = useState<StudentLeaveRequest[]>([]);
  const [facilities, setFacilities] = useState<FacilityBooking[]>([]);
  const [mess, setMess] = useState<MessExtraRequest[]>([]);
  const [appts, setAppts] = useState<AppointmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
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
    if (!silent) setLoading(false);
  }, [kind]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload(true);
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rows: { id: string; status: RequestStatus; title: string; sub: string }[] = [];
  if (kind === "leave") {
    for (const r of leaves) {
      if (filter !== "all" && r.status !== filter) continue;
      rows.push({
        id: r.id,
        status: r.status,
        title: `${r.start_date} → ${r.end_date}`,
        sub: r.student?.full_name ?? r.student_id,
      });
    }
  } else if (kind === "facilities") {
    for (const r of facilities) {
      if (filter !== "all" && r.status !== filter) continue;
      const typeLabel = FACILITY_TYPE_LABELS[r.facility_type as FacilityBookingType] ?? r.facility_type;
      const venue = facilityVenueLabel(r.facility_type as FacilityBookingType, r.venue_code);
      rows.push({
        id: r.id,
        status: r.status,
        title: `${typeLabel} · ${venue}`,
        sub: `${r.booking_date} · ${r.requester?.full_name ?? r.requester_email ?? "—"}`,
      });
    }
  } else if (kind === "mess") {
    for (const r of mess) {
      if (filter !== "all" && r.status !== filter) continue;
      rows.push({
        id: r.id,
        status: r.status,
        title: `${r.meal_date} · ${MEAL_PERIOD_LABELS[r.meal_period]}`,
        sub: `+${r.extra_guest_count} guests · ${r.student?.full_name ?? ""}`,
      });
    }
  } else {
    for (const r of appts) {
      if (filter !== "all" && r.status !== filter) continue;
      rows.push({
        id: r.id,
        status: r.status,
        title: `${APPOINTMENT_PROVIDER_LABELS[r.provider_code]} · ${r.booking_date}`,
        sub: `${String(r.start_time).slice(0, 5)} · ${r.student?.full_name ?? ""}`,
      });
    }
  }

  async function patch(status: RequestStatus) {
    if (!selectedId) return;
    setUpdating(true);
    await getSupabase()
      .from(TABLE[kind])
      .update({
        status,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedId);
    setUpdating(false);
    setSelectedId(null);
    setSelectedStatus(null);
    reload();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.filterBar}>
        <RequestStatusFilterChips value={filter} onChange={setFilter} />
      </View>
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {rows.length === 0 ? (
          <Text style={styles.muted}>Nothing in this filter.</Text>
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              style={styles.card}
              onPress={() => {
                setSelectedId(r.id);
                setSelectedStatus(r.status);
              }}
            >
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardMeta}>
                {r.sub} · {requestStatusLabel(r.status)}
              </Text>
            </Pressable>
          ))
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={selectedId !== null}
        onClose={() => setSelectedId(null)}
        dismissDisabled={updating}
        maxHeight="52%"
      >
        {selectedId && selectedStatus ? (
          <>
            <Text style={styles.modalTitle}>Update status</Text>
            <Text style={styles.cardMeta}>{requestStatusLabel(selectedStatus)}</Text>
            <View style={styles.actions}>
              {adminRequestActionVisibility(selectedStatus).approve ? (
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => !updating && patch("approved")}
                >
                  <Text style={styles.btnPrimaryText}>Approve</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selectedStatus).reject ? (
                <Pressable style={styles.btn} onPress={() => !updating && patch("rejected")}>
                  <Text style={styles.btnText}>Reject</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selectedStatus).clarify ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => !updating && patch("clarification_needed")}
                >
                  <Text style={styles.btnText}>Clarify</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterBar: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  muted: { color: theme.mutedForeground },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnText: { fontWeight: "600" },
  btnPrimary: { backgroundColor: theme.primary, borderColor: theme.primary },
  btnPrimaryText: { color: theme.primaryForeground, fontWeight: "700" },
});
