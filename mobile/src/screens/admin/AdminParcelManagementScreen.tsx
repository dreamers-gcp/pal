import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { SelectModal } from "../../components/SelectModal";
import { mobileFieldError, normalizeTenDigitMobile } from "../../lib/phone-normalize";
import { getSupabase } from "../../lib/supabase";
import type { Parcel, Profile } from "../../types";
import { theme } from "../../theme";

type ParcelDateSort = "newest" | "oldest";

const PARCEL_SORT_OPTIONS: { value: ParcelDateSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function matchesParcelSearch(p: Parcel, q: string): boolean {
  if (!q) return true;
  const n = (p.recipient?.full_name ?? "").toLowerCase();
  const e = (p.recipient?.email ?? "").toLowerCase();
  const m = p.mobile_snapshot.toLowerCase();
  const nt = (p.notes ?? "").toLowerCase();
  return n.includes(q) || e.includes(q) || m.includes(q) || nt.includes(q);
}

function sortParcelsByRegistered(list: Parcel[], sort: ParcelDateSort): Parcel[] {
  const out = [...list];
  if (sort === "oldest") {
    out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else {
    out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return out;
}

function sortParcelsByCollected(list: Parcel[], sort: ParcelDateSort): Parcel[] {
  const out = [...list];
  const collectedTs = (p: Parcel) => (p.collected_at ? new Date(p.collected_at).getTime() : 0);
  if (sort === "oldest") {
    out.sort((a, b) => collectedTs(a) - collectedTs(b));
  } else {
    out.sort((a, b) => collectedTs(b) - collectedTs(a));
  }
  return out;
}

export function AdminParcelManagementScreen({ profile }: { profile: Profile }) {
  const [mobileInput, setMobileInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [awaitingSearch, setAwaitingSearch] = useState("");
  const [awaitingSort, setAwaitingSort] = useState<ParcelDateSort>("newest");
  const [collectedSearch, setCollectedSearch] = useState("");
  const [collectedSort, setCollectedSort] = useState<ParcelDateSort>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [awaitingSortModalOpen, setAwaitingSortModalOpen] = useState(false);
  const [collectedSortModalOpen, setCollectedSortModalOpen] = useState(false);

  const fetchParcels = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("parcels")
      .select(
        "*, recipient:profiles!parcels_recipient_id_fkey(id, full_name, email, role, mobile_phone)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      if (!opts?.silent) Alert.alert("Could not load parcels", error.message);
      setParcels([]);
    } else {
      setParcels((data as unknown as Parcel[]) ?? []);
    }
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchParcels({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchParcels]);

  async function registerParcel() {
    const err = mobileFieldError(mobileInput);
    if (err) {
      Alert.alert("Check mobile", err);
      return;
    }
    const normalized = normalizeTenDigitMobile(mobileInput)!;

    setSubmitting(true);
    const supabase = getSupabase();
    const { data: recipient, error: findErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, mobile_phone")
      .in("role", ["student", "professor"])
      .eq("mobile_phone", normalized)
      .maybeSingle();

    if (findErr) {
      Alert.alert("Lookup failed", findErr.message);
      setSubmitting(false);
      return;
    }
    if (!recipient) {
      Alert.alert(
        "No match",
        "No student or professor found with this mobile. They must use the same 10-digit number on their account."
      );
      setSubmitting(false);
      return;
    }

    const { error: insErr } = await supabase.from("parcels").insert({
      recipient_id: recipient.id,
      mobile_snapshot: normalized,
      registered_by: profile.id,
      notes: notes.trim() || null,
      status: "awaiting_pickup",
    });

    if (insErr) {
      Alert.alert("Could not register", insErr.message);
      setSubmitting(false);
      return;
    }

    Alert.alert(
      "Registered",
      `Parcel registered for ${recipient.full_name || recipient.email || "recipient"}.`
    );
    setMobileInput("");
    setNotes("");
    await fetchParcels({ silent: true });
    setSubmitting(false);
  }

  async function markCollected(parcel: Parcel) {
    setMarkingId(parcel.id);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("parcels")
      .update({
        status: "collected",
        collected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcel.id);

    if (error) {
      Alert.alert("Update failed", error.message);
    } else {
      await fetchParcels({ silent: true });
    }
    setMarkingId(null);
  }

  const awaiting = parcels.filter((p) => p.status === "awaiting_pickup");
  const collected = parcels.filter((p) => p.status === "collected");

  const awaitingFiltered = useMemo(() => {
    const q = awaitingSearch.trim().toLowerCase();
    const filtered = q ? awaiting.filter((p) => matchesParcelSearch(p, q)) : awaiting;
    return sortParcelsByRegistered(filtered, awaitingSort);
  }, [awaiting, awaitingSearch, awaitingSort]);

  const collectedFiltered = useMemo(() => {
    const q = collectedSearch.trim().toLowerCase();
    const filtered = q ? collected.filter((p) => matchesParcelSearch(p, q)) : collected;
    return sortParcelsByCollected(filtered, collectedSort);
  }, [collected, collectedSearch, collectedSort]);

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Text style={styles.pageTitle}>Parcel management</Text>
      <Text style={styles.pageSub}>
        Register parcels by the 10-digit mobile on the label. Recipients see them under Parcels until
        collected.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Register incoming parcel</Text>
        <Text style={styles.label}>Mobile on parcel</Text>
        <TextInput
          style={styles.input}
          value={mobileInput}
          onChangeText={setMobileInput}
          placeholder="Digits from the shipping label"
          placeholderTextColor={theme.mutedForeground}
          keyboardType="phone-pad"
          maxLength={14}
          autoComplete="tel"
        />
        <Text style={styles.hint}>10 digits; optional +91 or leading 0 is accepted.</Text>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Courier, shelf, tracking…"
          placeholderTextColor={theme.mutedForeground}
          multiline
        />

        <Pressable
          onPress={() => !submitting && registerParcel()}
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "Registering…" : "Register parcel"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Awaiting pickup</Text>
        <Text style={styles.cardSub}>
          Mark collected after handover (recipients can also confirm in the app).
        </Text>

        <TextInput
          style={styles.input}
          value={awaitingSearch}
          onChangeText={setAwaitingSearch}
          placeholder="Search name, email, mobile, notes…"
          placeholderTextColor={theme.mutedForeground}
        />

        <Text style={styles.label}>Sort</Text>
        <Pressable
          onPress={() => setAwaitingSortModalOpen(true)}
          style={styles.sortTrigger}
          accessibilityRole="button"
          accessibilityLabel="Sort awaiting pickup"
        >
          <Text style={styles.sortTriggerText} numberOfLines={1}>
            {PARCEL_SORT_OPTIONS.find((o) => o.value === awaitingSort)?.label ?? "Newest first"}
          </Text>
          <Text style={styles.sortChevron}>▼</Text>
        </Pressable>
        <SelectModal
          visible={awaitingSortModalOpen}
          title="Sort"
          options={PARCEL_SORT_OPTIONS}
          selectedValue={awaitingSort}
          onSelect={(v) => setAwaitingSort(v as ParcelDateSort)}
          onClose={() => setAwaitingSortModalOpen(false)}
        />

        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : awaiting.length === 0 ? (
          <Text style={styles.muted}>No parcels waiting for pickup.</Text>
        ) : awaitingFiltered.length === 0 ? (
          <Text style={styles.muted}>No parcels match your search.</Text>
        ) : (
          awaitingFiltered.map((p) => (
            <View key={p.id} style={styles.awaitCard}>
              <View style={styles.awaitBody}>
                <Text style={styles.awaitName}>
                  {p.recipient?.full_name ?? "Unknown"}{" "}
                  <Text style={styles.awaitRole}>({p.recipient?.role})</Text>
                </Text>
                <Text style={styles.awaitMeta}>
                  Mobile {p.mobile_snapshot} · Registered{" "}
                  {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
                </Text>
                {p.notes ? <Text style={styles.awaitNotes}>{p.notes}</Text> : null}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Awaiting pickup</Text>
                </View>
              </View>
              <Pressable
                onPress={() => markingId !== p.id && markCollected(p)}
                style={[styles.outlineBtn, markingId === p.id && styles.outlineBtnDisabled]}
                disabled={markingId === p.id}
              >
                <Text style={styles.outlineBtnText}>
                  {markingId === p.id ? "…" : "Mark collected"}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recently collected</Text>

        <TextInput
          style={styles.input}
          value={collectedSearch}
          onChangeText={setCollectedSearch}
          placeholder="Search name, email, mobile, notes…"
          placeholderTextColor={theme.mutedForeground}
        />

        <Text style={styles.label}>Sort</Text>
        <Pressable
          onPress={() => setCollectedSortModalOpen(true)}
          style={styles.sortTrigger}
          accessibilityRole="button"
          accessibilityLabel="Sort collected"
        >
          <Text style={styles.sortTriggerText} numberOfLines={1}>
            {PARCEL_SORT_OPTIONS.find((o) => o.value === collectedSort)?.label ?? "Newest first"}
          </Text>
          <Text style={styles.sortChevron}>▼</Text>
        </Pressable>
        <SelectModal
          visible={collectedSortModalOpen}
          title="Sort"
          options={PARCEL_SORT_OPTIONS}
          selectedValue={collectedSort}
          onSelect={(v) => setCollectedSort(v as ParcelDateSort)}
          onClose={() => setCollectedSortModalOpen(false)}
        />

        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : collected.length === 0 ? (
          <Text style={styles.muted}>No collected parcels yet.</Text>
        ) : collectedFiltered.length === 0 ? (
          <Text style={styles.muted}>No parcels match your search.</Text>
        ) : (
          collectedFiltered.map((p) => (
            <View key={p.id} style={styles.collectedRow}>
              <View style={styles.collectedMain}>
                <Text style={styles.collectedName}>{p.recipient?.full_name ?? "—"}</Text>
                <Text style={styles.collectedMobile}> · {p.mobile_snapshot}</Text>
              </View>
              <Text style={styles.collectedWhen}>
                {p.collected_at ? format(new Date(p.collected_at), "MMM d, yyyy h:mm a") : "—"}
              </Text>
            </View>
          ))
        )}
      </View>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 36 },
  pageTitle: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  pageSub: {
    fontSize: 13,
    color: theme.mutedForeground,
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: theme.card,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 4 },
  cardSub: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 17,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.mutedForeground,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.foreground,
    backgroundColor: theme.background,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  hint: { fontSize: 11, color: theme.mutedForeground, marginTop: 4 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  sortTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sortTriggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.foreground,
  },
  sortChevron: {
    fontSize: 11,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  muted: { fontSize: 14, color: theme.mutedForeground, marginTop: 8 },
  inlineLoading: { paddingVertical: 16, alignItems: "center" },
  awaitCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    gap: 10,
  },
  awaitBody: { gap: 4 },
  awaitName: { fontSize: 15, fontWeight: "700", color: theme.foreground },
  awaitRole: { fontWeight: "400", color: theme.mutedForeground },
  awaitMeta: { fontSize: 12, color: theme.mutedForeground },
  awaitNotes: { fontSize: 13, color: theme.foreground, marginTop: 4 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#92400e" },
  outlineBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  outlineBtnDisabled: { opacity: 0.5 },
  outlineBtnText: { fontWeight: "600", color: theme.foreground },
  collectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  collectedMain: { flexDirection: "row", flexWrap: "wrap", flex: 1, minWidth: 0 },
  collectedName: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  collectedMobile: { fontSize: 14, color: theme.mutedForeground },
  collectedWhen: { fontSize: 12, color: theme.mutedForeground },
});
