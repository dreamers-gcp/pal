import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { getSupabase } from "../../lib/supabase";
import type { Parcel, Profile } from "../../types";
import { theme } from "../../theme";

export function UserParcelsScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("parcels")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false });
    setRows((data as Parcel[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id]);

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

  async function markCollected(p: Parcel) {
    setMarkingId(p.id);
    await getSupabase()
      .from("parcels")
      .update({
        status: "collected",
        collected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id)
      .eq("recipient_id", profile.id);
    setMarkingId(null);
    load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const awaiting = rows.filter((p) => p.status === "awaiting_pickup");
  const past = rows.filter((p) => p.status === "collected");

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {!profile.mobile_phone?.trim() ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Add your mobile for parcels</Text>
          <Text style={styles.bannerBody}>
            Parcel matching uses the mobile on your profile. Ask admin to update your profile if needed.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Awaiting pickup</Text>
      {awaiting.length === 0 ? (
        <Text style={styles.muted}>Nothing waiting right now.</Text>
      ) : (
        awaiting.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardMeta}>
              Registered {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
            </Text>
            {p.notes ? <Text style={styles.cardBody}>{p.notes}</Text> : null}
            <Pressable
              onPress={() => markingId !== p.id && markCollected(p)}
              style={styles.collectBtn}
            >
              <Text style={styles.collectBtnText}>
                {markingId === p.id ? "…" : "Mark collected"}
              </Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Past</Text>
      {past.length === 0 ? (
        <Text style={styles.muted}>No collected parcels yet.</Text>
      ) : (
        past.map((p) => (
          <View key={p.id} style={[styles.card, styles.cardPast]}>
            <Text style={styles.cardMeta}>
              Collected{" "}
              {p.collected_at
                ? format(new Date(p.collected_at), "MMM d, yyyy")
                : "—"}
            </Text>
            {p.notes ? <Text style={styles.cardBody}>{p.notes}</Text> : null}
          </View>
        ))
      )}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  banner: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 16,
  },
  bannerTitle: { fontWeight: "700", marginBottom: 4 },
  bannerBody: { fontSize: 13, color: theme.mutedForeground, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  muted: { fontSize: 14, color: theme.mutedForeground, marginBottom: 8 },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(1, 105, 111, 0.25)",
    backgroundColor: "rgba(1, 105, 111, 0.06)",
    marginBottom: 10,
  },
  cardPast: { opacity: 0.85 },
  cardMeta: { fontSize: 13, color: theme.mutedForeground },
  cardBody: { fontSize: 14, marginTop: 8 },
  collectBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  collectBtnText: { color: theme.primaryForeground, fontWeight: "700" },
});
