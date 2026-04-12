import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { GuestHouseAllocationPicker } from "../../components/GuestHouseAllocationPicker";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { RequestStatusFilterChips } from "../../components/RequestStatusFilterChips";
import { adminRequestActionVisibility } from "../../lib/admin-request-action-visibility";
import {
  allocatedRoomsForBooking,
  formatGuestHouseAllocationSummary,
  validateGuestHouseApprovalAllocations,
} from "../../lib/guest-house";
import { requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import type { GuestHouseBooking, GuestHouseRoomAllocation, Profile, RequestStatus } from "../../types";
import { theme } from "../../theme";

type StatusFilter = "all" | RequestStatus;

export function AdminGuestHouseRequestsScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<GuestHouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selected, setSelected] = useState<GuestHouseBooking | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [selectedAllocations, setSelectedAllocations] = useState<GuestHouseRoomAllocation[]>([]);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const clearBookingSelection = useCallback(() => {
    setSelected(null);
    setAdminNote("");
    setSelectedAllocations([]);
  }, []);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("guest_house_bookings")
      .select("*, requester:profiles!guest_house_bookings_requester_id_fkey(*)")
      .order("created_at", { ascending: false });
    if (error) {
      if (!silent) Alert.alert("Could not load", error.message);
      setRows([]);
    } else {
      setRows((data as GuestHouseBooking[]) ?? []);
    }
    if (!silent) setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  function openBooking(b: GuestHouseBooking) {
    setSelected(b);
    setAdminNote(b.admin_note ?? "");
    setSelectedAllocations(b.status === "approved" ? allocatedRoomsForBooking(b) : []);
  }

  async function submitUpdate(status: RequestStatus) {
    if (!selected) return;

    if (status === "approved") {
      const v = validateGuestHouseApprovalAllocations(selected.guest_count ?? 1, selectedAllocations);
      if (!v.ok) {
        Alert.alert("Cannot approve", v.message);
        return;
      }
    }

    setUpdating(true);
    const firstAlloc = selectedAllocations[0];
    const { error } = await getSupabase()
      .from("guest_house_bookings")
      .update({
        status,
        allocated_rooms: status === "approved" ? selectedAllocations : null,
        guest_house: status === "approved" && firstAlloc ? firstAlloc.guest_house : null,
        room_number: status === "approved" && firstAlloc ? firstAlloc.room_number : null,
        admin_note: adminNote.trim() || null,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    setUpdating(false);

    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }

    Alert.alert(
      "Done",
      status === "approved"
        ? "Guest house booking approved."
        : status === "rejected"
          ? "Guest house booking rejected."
          : "Guest house booking sent for clarification."
    );
    clearBookingSelection();
    load();
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
        {filtered.length === 0 ? (
          <Text style={styles.muted}>No guest house requests.</Text>
        ) : (
          filtered.map((b) => (
            <Pressable key={b.id} style={styles.card} onPress={() => openBooking(b)}>
              <Text style={styles.cardTitle}>{b.guest_name}</Text>
              <Text style={styles.cardMeta}>
                {b.check_in_date} → {b.check_out_date} · {requestStatusLabel(b.status)}
              </Text>
              <Text style={styles.cardMeta}>
                {b.guest_count ?? 1} guest(s) · {b.requested_room_count ?? "—"} rooms requested
              </Text>
            </Pressable>
          ))
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={selected !== null}
        onClose={clearBookingSelection}
        dismissDisabled={updating}
        maxHeight="92%"
      >
        {selected ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selected.guest_name}</Text>
            <Text style={styles.cardMeta}>
              {selected.guest_count ?? 1} guest(s) · stay {selected.check_in_date} →{" "}
              {selected.check_out_date}
            </Text>
            <Text style={styles.cardMeta}>{requestStatusLabel(selected.status)}</Text>
            <Text style={styles.cardMeta}>
              Requested by: {selected.requester?.full_name ?? selected.requester_email ?? "Unknown"}
            </Text>
            {selected.purpose ? (
              <Text style={[styles.cardMeta, { marginTop: 6 }]}>Purpose: {selected.purpose}</Text>
            ) : null}
            {formatGuestHouseAllocationSummary(selected) ? (
              <Text style={styles.alloc}>{formatGuestHouseAllocationSummary(selected)}</Text>
            ) : null}

            <GuestHouseAllocationPicker
              allBookings={rows}
              selectedBooking={selected}
              selectedAllocations={selectedAllocations}
              onAllocationsChange={setSelectedAllocations}
            />

            <Text style={styles.label}>Admin note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={adminNote}
              onChangeText={setAdminNote}
              multiline
              placeholder="Add note for requester…"
              placeholderTextColor={theme.mutedForeground}
            />

            <View style={styles.actions}>
              {adminRequestActionVisibility(selected.status).approve ? (
                <Pressable
                  style={[styles.btn, styles.btnApprove]}
                  onPress={() => !updating && submitUpdate("approved")}
                  disabled={updating}
                >
                  <Text style={styles.btnApproveText}>Approve</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selected.status).reject ? (
                <Pressable style={styles.btn} onPress={() => !updating && submitUpdate("rejected")}>
                  <Text style={styles.btnText}>Reject</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selected.status).clarify ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => !updating && submitUpdate("clarification_needed")}
                >
                  <Text style={styles.btnText}>Clarify</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
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
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  alloc: { fontSize: 13, marginTop: 8, color: theme.foreground },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 15,
    color: theme.foreground,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  btnText: { fontWeight: "600", color: theme.foreground },
  btnApprove: {
    borderColor: "rgba(16, 185, 129, 0.55)",
    backgroundColor: "rgba(16, 185, 129, 0.14)",
  },
  btnApproveText: { fontWeight: "700", color: "#047857" },
});
