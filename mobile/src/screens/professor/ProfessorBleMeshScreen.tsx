import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ensureAndroidBleAdvertisePermissions } from "../../lib/ble-mesh-permissions";
import {
  isBleAdvertiserNativeAvailable,
  startMeshAdvertise,
  stopMeshAdvertise,
} from "../../lib/ble-mesh-native";
import {
  createBleAttendanceSession,
  endBleAttendanceSession,
  fetchProfessorActiveBleSessions,
  filterProfessorApprovedToday,
  type BleSessionWithEvent,
} from "../../lib/ble-mesh-supabase";
import { fetchProfessorRequests } from "../../lib/student-events-fetch";
import { getSupabase } from "../../lib/supabase";
import type { CalendarRequest, Profile } from "../../types";
import { theme } from "../../theme";

type Props = { profile: Profile };

export function ProfessorBleMeshScreen({ profile }: Props) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [activeSessions, setActiveSessions] = useState<BleSessionWithEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [advertisingSessionId, setAdvertisingSessionId] = useState<string | null>(null);

  const todayYmd = format(new Date(), "yyyy-MM-dd");
  const todayClasses = useMemo(
    () => filterProfessorApprovedToday(requests, todayYmd),
    [requests, todayYmd]
  );

  const advertiserOk = isBleAdvertiserNativeAvailable();

  const refresh = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    try {
      const [reqRows, sessions] = await Promise.all([
        fetchProfessorRequests(supabase, profile),
        fetchProfessorActiveBleSessions(supabase, profile.id),
      ]);
      setRequests(reqRows);
      setActiveSessions(sessions);
    } catch (e) {
      Alert.alert(
        "BLE sessions",
        e instanceof Error ? e.message : "Could not load data. Apply supabase/ble-mesh-attendance.sql if tables are missing."
      );
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onStartSession(event: CalendarRequest) {
    const supabase = getSupabase();
    setBusyId(`start-${event.id}`);
    try {
      const existing = activeSessions.find((s) => s.calendar_event_id === event.id);
      if (existing) {
        Alert.alert(
          "Session already active",
          "End the current session for this class before starting a new one."
        );
        return;
      }
      const session = await createBleAttendanceSession(supabase, profile.id, event.id);
      await refresh();
      if (advertiserOk) {
        const ok = await ensureAndroidBleAdvertisePermissions();
        if (!ok) {
          Alert.alert("Bluetooth", "Advertising permission was not granted.");
          return;
        }
        try {
          await startMeshAdvertise(session.public_beacon_token, 0);
          setAdvertisingSessionId(session.id);
        } catch (e) {
          Alert.alert(
            "Advertising",
            e instanceof Error ? e.message : "Could not start BLE advertising. Students can still enter the token manually."
          );
        }
      }
    } catch (e) {
      Alert.alert("Start session", e instanceof Error ? e.message : "Insert failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onResumeAdvertise(session: BleSessionWithEvent) {
    setBusyId(`adv-${session.id}`);
    try {
      const ok = await ensureAndroidBleAdvertisePermissions();
      if (!ok) {
        Alert.alert("Bluetooth", "Advertising permission was not granted.");
        return;
      }
      await startMeshAdvertise(session.public_beacon_token, 0);
      setAdvertisingSessionId(session.id);
    } catch (e) {
      Alert.alert("Advertising", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onStopAdvertising() {
    setBusyId("stop-adv");
    try {
      await stopMeshAdvertise();
      setAdvertisingSessionId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function onEndSession(session: BleSessionWithEvent) {
    const supabase = getSupabase();
    setBusyId(`end-${session.id}`);
    try {
      if (advertisingSessionId === session.id) {
        await stopMeshAdvertise();
        setAdvertisingSessionId(null);
      }
      await endBleAttendanceSession(supabase, session.id);
      await refresh();
    } catch (e) {
      Alert.alert("End session", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BLE mesh attendance</Text>
      <Text style={styles.sub}>
        Start a session for today’s approved class. The app advertises a short token students can
        scan (or they can type it). Requires a dev build with native Bluetooth.
      </Text>

      {!advertiserOk ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Native advertiser module not linked. Run{" "}
            <Text style={styles.mono}>npx expo prebuild</Text> and{" "}
            <Text style={styles.mono}>expo run:android</Text> /{" "}
            <Text style={styles.mono}>expo run:ios</Text>, or EAS. You can still create sessions;
            share the token manually.
          </Text>
        </View>
      ) : null}

      <Text style={styles.section}>Active sessions</Text>
      {activeSessions.length === 0 ? (
        <Text style={styles.muted}>No active BLE sessions.</Text>
      ) : (
        activeSessions.map((s) => {
          const ev = s.calendar_requests;
          const busy = busyId !== null;
          return (
            <View key={s.id} style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ev?.title ?? "Class"}
              </Text>
              <Text style={styles.meta} selectable>
                Token: {s.public_beacon_token}
              </Text>
              <Text style={styles.meta}>
                Started {format(new Date(s.started_at), "MMM d, h:mm a")}
              </Text>
              {advertisingSessionId === s.id ? (
                <Text style={styles.live}>Advertising</Text>
              ) : (
                <Text style={styles.mutedSmall}>Not advertising</Text>
              )}
              <View style={styles.row}>
                {advertiserOk && advertisingSessionId !== s.id ? (
                  <Pressable
                    style={styles.btnSecondary}
                    disabled={!!busy}
                    onPress={() => void onResumeAdvertise(s)}
                  >
                    <Text style={styles.btnSecondaryText}>Advertise</Text>
                  </Pressable>
                ) : null}
                {advertiserOk && advertisingSessionId === s.id ? (
                  <Pressable
                    style={styles.btnSecondary}
                    disabled={busyId === "stop-adv"}
                    onPress={() => void onStopAdvertising()}
                  >
                    <Text style={styles.btnSecondaryText}>Stop advertising</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.btnDanger}
                  disabled={!!busy}
                  onPress={() => void onEndSession(s)}
                >
                  <Text style={styles.btnDangerText}>End session</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.section}>Start for today</Text>
      {todayClasses.length === 0 ? (
        <Text style={styles.muted}>No approved classes scheduled for today.</Text>
      ) : (
        todayClasses.map((ev) => {
          const activeForEvent = activeSessions.find((s) => s.calendar_event_id === ev.id);
          const starting = busyId === `start-${ev.id}`;
          return (
            <View key={ev.id} style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ev.title}
              </Text>
              <Text style={styles.meta}>
                {ev.start_time.slice(0, 5)} – {ev.end_time.slice(0, 5)} ·{" "}
                {ev.classroom?.name ?? "—"}
              </Text>
              {activeForEvent ? (
                <Text style={styles.mutedSmall}>Session already active for this class.</Text>
              ) : (
                <Pressable
                  style={[styles.btnPrimary, starting && styles.btnDisabled]}
                  disabled={starting}
                  onPress={() => void onStartSession(ev)}
                >
                  {starting ? (
                    <ActivityIndicator color={theme.primaryForeground} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Start BLE session</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })
      )}

      <Pressable style={styles.refresh} onPress={() => void refresh()}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  sub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 14 },
  section: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginTop: 8, marginBottom: 10 },
  muted: { fontSize: 14, color: theme.mutedForeground, marginBottom: 10 },
  mutedSmall: { fontSize: 12, color: theme.mutedForeground, marginTop: 6 },
  note: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 14,
  },
  noteText: { fontSize: 13, color: theme.foreground, lineHeight: 18 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }) },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: theme.card,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  meta: { fontSize: 13, color: theme.mutedForeground, marginTop: 6 },
  live: { fontSize: 13, fontWeight: "700", color: "#047857", marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btnPrimary: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 42,
    justifyContent: "center",
  },
  btnPrimaryText: { color: theme.primaryForeground, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  btnSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  btnSecondaryText: { fontWeight: "700", color: theme.primary },
  btnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  btnDangerText: { fontWeight: "700", color: "#b91c1c" },
  refresh: { alignSelf: "flex-start", marginTop: 16, paddingVertical: 8 },
  refreshText: { fontSize: 15, fontWeight: "600", color: theme.primary },
});
