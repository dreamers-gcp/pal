import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { RequestStatusFilterChips } from "../../components/RequestStatusFilterChips";
import { adminRequestActionVisibility } from "../../lib/admin-request-action-visibility";
import { requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import { SPORT_LABELS, SPORTS_VENUE_LABELS } from "../../lib/sports-booking";
import type { Profile, RequestStatus, SportsBooking } from "../../types";
import { theme } from "../../theme";

type StatusFilter = "all" | RequestStatus;

export function AdminSportsRequestsScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<SportsBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selected, setSelected] = useState<SportsBooking | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("sports_bookings")
      .select("*, requester:profiles!sports_bookings_requester_id_fkey(*)")
      .order("created_at", { ascending: false });
    setRows((data as SportsBooking[]) ?? []);
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

  const clearDetail = useCallback(() => {
    setSelected(null);
    setAdminNote("");
  }, []);

  const openDetail = useCallback((booking: SportsBooking) => {
    setSelected(booking);
    setAdminNote(booking.admin_note ?? "");
  }, []);

  async function patch(status: RequestStatus) {
    if (!selected) return;
    setUpdating(true);
    await getSupabase()
      .from("sports_bookings")
      .update({
        status,
        admin_note: adminNote.trim() || null,
        reviewed_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);
    setUpdating(false);
    setSelected(null);
    setAdminNote("");
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
          <Text style={styles.muted}>No sports requests.</Text>
        ) : (
          filtered.map((b) => (
            <Pressable key={b.id} style={styles.card} onPress={() => openDetail(b)}>
              <Text style={styles.cardTitle}>
                {SPORT_LABELS[b.sport]} · {SPORTS_VENUE_LABELS[b.venue_code]}
              </Text>
              <Text style={styles.cardMeta}>
                {b.booking_date} · {String(b.start_time).slice(0, 5)}–{String(b.end_time).slice(0, 5)}
              </Text>
              <Text style={styles.cardMeta}>
                {b.requester_role} · {requestStatusLabel(b.status)}
              </Text>
            </Pressable>
          ))
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={selected !== null}
        onClose={clearDetail}
        dismissDisabled={updating}
        maxHeight="72%"
      >
        {selected ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {SPORT_LABELS[selected.sport]} · {SPORTS_VENUE_LABELS[selected.venue_code]}
            </Text>
            <Text style={styles.cardMeta}>{requestStatusLabel(selected.status)}</Text>
            {selected.requester?.full_name ? (
              <Text style={styles.cardMeta}>{selected.requester.full_name}</Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {selected.booking_date} · {String(selected.start_time).slice(0, 5)}–{String(selected.end_time).slice(0, 5)}
            </Text>
            {selected.purpose ? (
              <Text style={styles.cardMeta}>Purpose: {selected.purpose}</Text>
            ) : null}
            
            <Text style={styles.label}>Admin note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="Add note for requester…"
              placeholderTextColor={theme.mutedForeground}
              multiline
            />
            
            <View style={styles.actions}>
              {adminRequestActionVisibility(selected.status).approve ? (
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => !updating && patch("approved")}
                >
                  <Text style={styles.btnPrimaryText}>Approve</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selected.status).reject ? (
                <Pressable style={styles.btn} onPress={() => !updating && patch("rejected")}>
                  <Text style={styles.btnText}>Reject</Text>
                </Pressable>
              ) : null}
              {adminRequestActionVisibility(selected.status).clarify ? (
                <Pressable
                  style={styles.btn}
                  onPress={() => !updating && patch("clarification_needed")}
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
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginTop: 14, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
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
  },
  btnText: { fontWeight: "600" },
  btnPrimary: { backgroundColor: theme.primary, borderColor: theme.primary },
  btnPrimaryText: { color: theme.primaryForeground, fontWeight: "700" },
});
