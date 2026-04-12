import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { RequestStatusFilterChips } from "../../components/RequestStatusFilterChips";
import { transformCalendarRequestJoins } from "../../lib/calendar-request-transform";
import { decodeCalendarRequestSubjects } from "../../lib/calendar-subject";
import { decodeCalendarRequestInfra, formatInfraRequirementsLines } from "../../lib/calendar-request-infra";
import { adminRequestActionVisibility } from "../../lib/admin-request-action-visibility";
import { requestKindLabel, requestStatusLabel } from "../../lib/request-display";
import { getSupabase } from "../../lib/supabase";
import type { CalendarRequest, Profile, RequestStatus } from "../../types";
import { theme } from "../../theme";

type StatusFilter = "all" | RequestStatus;

export function AdminEventRequestsScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selected, setSelected] = useState<CalendarRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [adminSpoc, setAdminSpoc] = useState("");
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
      )
      .order("created_at", { ascending: false });
    setRows(data ? transformCalendarRequestJoins(data) : []);
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
    setAdminSpoc("");
  }, []);

  const openDetail = useCallback((request: CalendarRequest) => {
    setSelected(request);
    setAdminNote(request.admin_note ?? "");
    setAdminSpoc(request.admin_spoc ?? "");
  }, []);

  async function patch(status: RequestStatus) {
    if (!selected) return;
    if (status === "approved" && !adminSpoc.trim()) return;

    setUpdating(true);
    const supabase = getSupabase();
    const patch: Record<string, unknown> = {
      status,
      admin_note: adminNote.trim() || null,
      reviewed_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    if (status === "approved") {
      patch.admin_spoc = adminSpoc.trim();
    }
    await supabase.from("calendar_requests").update(patch).eq("id", selected.id);
    setUpdating(false);
    setSelected(null);
    setAdminNote("");
    setAdminSpoc("");
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
          <Text style={styles.muted}>No event requests in this filter.</Text>
        ) : (
          filtered.map((r) => {
            const subjects = decodeCalendarRequestSubjects(r.subject ?? null);
            const subj = subjects.length ? subjects.join(", ") : r.student_group?.name ?? "—";
            const dateOnly = String(r.event_date).split("T")[0];
            return (
              <Pressable key={r.id} style={styles.card} onPress={() => openDetail(r)}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.cardMeta}>
                  {requestKindLabel(r.request_kind)} · {requestStatusLabel(r.status)}
                </Text>
                <Text style={styles.cardMeta}>
                  {format(new Date(dateOnly + "T12:00:00"), "MMM d, yyyy")} ·{" "}
                  {String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}
                </Text>
                <Text style={styles.cardMeta}>{r.classroom?.name ?? "Room"} · {subj}</Text>
              </Pressable>
            );
          })
        )}
      </RefreshableScrollView>

      <BottomSheetModal
        visible={selected !== null}
        onClose={clearDetail}
        dismissDisabled={updating}
        maxHeight="88%"
      >
        {selected ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selected.title}</Text>
            <Text style={styles.cardMeta}>Status: {requestStatusLabel(selected.status)}</Text>
            
            {/* Display infrastructure requirements if present */}
            {(() => {
              const infraLines = formatInfraRequirementsLines(
                decodeCalendarRequestInfra(selected.infra_requirements)
              );
              if (infraLines.length > 0) {
                return (
                  <>
                    <Text style={styles.label}>Infrastructure Requirements</Text>
                    {infraLines.map((line, idx) => (
                      <Text key={idx} style={styles.infraLine}>
                        • {line}
                      </Text>
                    ))}
                  </>
                );
              }
              return null;
            })()}
            
            <Text style={styles.label}>Admin note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="Optional note to requester"
              placeholderTextColor={theme.mutedForeground}
              multiline
            />
            <Text style={styles.label}>Admin SPOC (required to approve)</Text>
            <TextInput
              style={styles.input}
              value={adminSpoc}
              onChangeText={setAdminSpoc}
              placeholder="Name / contact"
              placeholderTextColor={theme.mutedForeground}
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
  muted: { color: theme.mutedForeground, fontSize: 14 },
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
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginTop: 10, marginBottom: 4 },
  infraLine: { fontSize: 13, color: theme.foreground, marginLeft: 8, marginBottom: 4 },
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
