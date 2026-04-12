import { format, parse, addMinutes, isWithinInterval } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FaceCameraModal, type FaceCaptureResult } from "../../components/FaceCameraModal";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { postFaceCompare } from "../../lib/face-api";
import {
  ATTENDANCE_WINDOW_MINUTES,
} from "../../lib/face-math";
import { getPalApiBaseUrl } from "../../lib/config";
import { getWifiSnapshotForAttendance } from "../../lib/wifi-attendance";
import { arrayBufferFromLocalUri } from "../../lib/image-uri";
import { uploadBufferToStorage } from "../../lib/storage-upload";
import {
  isProfessorMarkedAbsent,
  isStudentPresent,
} from "../../lib/attendance-record";
import { fetchStudentEventsForAttendance } from "../../lib/student-events-for-attendance";
import { getSupabase } from "../../lib/supabase";
import type { AttendanceRecord, CalendarRequest, Profile } from "../../types";
import { theme } from "../../theme";

type Props = {
  profile: Profile;
};

function isEventToday(dateStr: string): boolean {
  const now = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
}

export function StudentAttendanceScreen({ profile }: Props) {
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [loadingAtt, setLoadingAtt] = useState(true);
  const [faceRegistered, setFaceRegistered] = useState(profile.face_registered);
  const [verifyingEventId, setVerifyingEventId] = useState<string | null>(null);
  const [cameraForEventId, setCameraForEventId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const apiConfigured = Boolean(getPalApiBaseUrl());

  const loadEvents = useCallback(async (silent?: boolean) => {
    if (!silent) setLoadingEvents(true);
    const supabase = getSupabase();
    const list = await fetchStudentEventsForAttendance(supabase, profile);
    setEvents(list);
    if (!silent) setLoadingEvents(false);
  }, [profile]);

  const fetchAttendance = useCallback(async (silent?: boolean) => {
    if (!silent) setLoadingAtt(true);
    const supabase = getSupabase();
    const [{ data: attData }, { data: profileData }] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("student_id", profile.id),
      supabase.from("profiles").select("face_registered").eq("id", profile.id).single(),
    ]);

    if (profileData) {
      setFaceRegistered(Boolean((profileData as { face_registered?: boolean }).face_registered));
    }

    const map: Record<string, AttendanceRecord> = {};
    for (const r of attData ?? []) {
      map[(r as AttendanceRecord).event_id] = r as AttendanceRecord;
    }
    setAttendanceMap(map);
    if (!silent) setLoadingAtt(false);
  }, [profile.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadEvents(true), fetchAttendance(true)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadEvents, fetchAttendance]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const todayEvents = useMemo(
    () => events.filter((e) => isEventToday(e.event_date)),
    [events]
  );

  function isWithinAttendanceWindow(event: CalendarRequest): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTime = parse(event.start_time, "HH:mm:ss", today);
    const windowEnd = addMinutes(startTime, ATTENDANCE_WINDOW_MINUTES);
    return isWithinInterval(now, { start: startTime, end: windowEnd });
  }

  async function handleAttendancePhoto(event: CalendarRequest, capture: FaceCaptureResult) {
    setVerifyingEventId(event.id);
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      if (!isWithinAttendanceWindow(event)) {
        Alert.alert(
          "Window closed",
          `You can only mark attendance within ${ATTENDANCE_WINDOW_MINUTES} minutes after class start.`
        );
        return;
      }

      const { data: existingRow } = await supabase
        .from("attendance_records")
        .select("verified, photo_path")
        .eq("student_id", profile.id)
        .eq("event_id", event.id)
        .maybeSingle();

      const row = existingRow as { verified?: boolean; photo_path?: string } | null;
      if (isProfessorMarkedAbsent(row)) {
        Alert.alert(
          "Absent",
          "Your instructor marked you absent for this class. Contact them if this is a mistake."
        );
        return;
      }
      if (row?.verified) {
        Alert.alert("Already marked", "Attendance is already recorded for this class.");
        return;
      }

      const filename = `${profile.id}/attendance-${event.id}-${Date.now()}.jpg`;
      const { uri, base64 } = capture;
      const data = await arrayBufferFromLocalUri(uri, { base64 });
      const { error: upErr } = await uploadBufferToStorage(
        "face-photos",
        filename,
        data,
        "image/jpeg"
      );

      if (upErr) {
        Alert.alert("Upload failed", upErr);
        return;
      }

      const cmp = await postFaceCompare(token, uri, profile.id);
      if (!cmp.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Verification failed", cmp.error);
        return;
      }
      if (!cmp.match) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Not recognized", "Try again with better lighting, facing the camera.");
        return;
      }

      const similarity = Number(cmp.similarity ?? 0);
      const similarityScore = cmp.match ? Math.max(similarity, 0.35) : similarity;

      const wifi = await getWifiSnapshotForAttendance();

      const { error: dbErr } = await supabase.from("attendance_records").insert({
        student_id: profile.id,
        event_id: event.id,
        photo_path: filename,
        similarity_score: similarityScore,
        verified: true,
        wifi_ssid: wifi.wifi_ssid,
        wifi_bssid: wifi.wifi_bssid,
      });

      if (dbErr) {
        if (dbErr.code === "23505") {
          Alert.alert("Already recorded", "Attendance is already recorded for this class.");
        } else {
          Alert.alert("Could not save", dbErr.message);
        }
        return;
      }

      Alert.alert("Success", "Attendance marked.");
      await fetchAttendance();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setVerifyingEventId(null);
    }
  }

  const loading = loadingEvents || loadingAtt;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!faceRegistered) {
    return (
      <RefreshableScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <Text style={styles.title}>Attendance</Text>
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Face not registered</Text>
          <Text style={styles.warnBody}>
            Register your face under Face registration in the menu before marking attendance.
          </Text>
        </View>
      </RefreshableScrollView>
    );
  }

  const pastEvents = events.filter(
    (e) => new Date(e.event_date) <= new Date() && !isEventToday(e.event_date)
  );
  const sortedPast = [...pastEvents].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Text style={styles.title}>{"Today's attendance"}</Text>
      <Text style={styles.sub}>
        Mark within {ATTENDANCE_WINDOW_MINUTES} minutes after class start using your front camera.
      </Text>

      {!apiConfigured ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Set EXPO_PUBLIC_PAL_API_URL to your Planova web URL (for /api/face/compare).
          </Text>
        </View>
      ) : null}

      {todayEvents.length === 0 ? (
        <Text style={styles.muted}>No classes scheduled for today.</Text>
      ) : (
        todayEvents.map((event) => {
          const att = attendanceMap[event.id];
          const inWindow = isWithinAttendanceWindow(event);
          const present = isStudentPresent(att);
          const profAbsent = isProfessorMarkedAbsent(att);
          const verifying = verifyingEventId === event.id;

          let statusLabel = "";
          let badgeBg = "#eef2ff";
          if (present) {
            statusLabel = "Present";
            badgeBg = "rgba(16, 185, 129, 0.15)";
          } else if (profAbsent) {
            statusLabel = "Absent (instructor)";
            badgeBg = "rgba(239, 68, 68, 0.12)";
          } else if (inWindow) {
            statusLabel = "Open";
            badgeBg = "rgba(1, 105, 111, 0.12)";
          } else {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const st = parse(event.start_time, "HH:mm:ss", today);
            statusLabel = st > now ? "Upcoming" : "Missed";
          }

          return (
            <View key={event.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={styles.badgeText}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)} ·{" "}
                {event.classroom?.name ?? "—"}
              </Text>
              <Text style={styles.meta}>Prof. {event.professor?.full_name ?? "—"}</Text>

              {present && att ? (
                <Text style={styles.successNote}>
                  Marked at {format(new Date(att.marked_at), "h:mm a")}
                </Text>
              ) : null}
              {profAbsent ? (
                <Text style={styles.errorNote}>
                  You cannot submit attendance here. Contact your instructor if needed.
                </Text>
              ) : null}
              {verifying ? (
                <Text style={styles.muted}>Verifying face…</Text>
              ) : null}
              {!present && !profAbsent && inWindow && !verifying ? (
                <Pressable
                  style={[styles.markBtn, !apiConfigured && styles.btnDisabled]}
                  onPress={() => apiConfigured && setCameraForEventId(event.id)}
                  disabled={!apiConfigured}
                >
                  <Text style={styles.markBtnText}>Mark attendance</Text>
                </Pressable>
              ) : null}
              {!present && !profAbsent && !inWindow && !verifying ? (
                <Text style={styles.windowNote}>Attendance window not active</Text>
              ) : null}
            </View>
          );
        })
      )}

      {sortedPast.length > 0 ? (
        <>
          <Text style={[styles.sectionHead, { marginTop: 24 }]}>History</Text>
          {sortedPast.slice(0, 40).map((event) => {
            const att = attendanceMap[event.id];
            const ok = isStudentPresent(att);
            const absent = isProfessorMarkedAbsent(att);
            return (
              <View key={event.id} style={styles.historyRow}>
                <Text style={styles.historyDate}>{event.event_date}</Text>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[styles.historyState, absent && styles.historyAbsent, ok && styles.historyOk]}>
                  {ok ? "Present" : absent ? "Absent" : "—"}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}

      <FaceCameraModal
        visible={cameraForEventId !== null}
        onClose={() => setCameraForEventId(null)}
        title="Capture your face for attendance"
        onCapture={(result) => {
          const ev = todayEvents.find((e) => e.id === cameraForEventId);
          setCameraForEventId(null);
          if (ev) void handleAttendancePhoto(ev, result);
        }}
      />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  sub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 14 },
  warn: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 12,
  },
  warnTitle: { fontWeight: "800", color: "#92400e", marginBottom: 6 },
  warnBody: { fontSize: 13, color: theme.foreground, lineHeight: 18 },
  warnText: { fontSize: 13, color: theme.foreground, lineHeight: 18 },
  muted: { fontSize: 14, color: theme.mutedForeground, marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: theme.card,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: theme.foreground },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  successNote: { fontSize: 12, color: "#047857", marginTop: 8, fontWeight: "600" },
  errorNote: { fontSize: 12, color: "#b91c1c", marginTop: 8 },
  windowNote: { fontSize: 12, color: theme.mutedForeground, marginTop: 8 },
  markBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.45 },
  markBtnText: { color: theme.primaryForeground, fontWeight: "700" },
  sectionHead: { fontSize: 17, fontWeight: "700", marginBottom: 10 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyDate: { width: 92, fontSize: 12, color: theme.mutedForeground },
  historyTitle: { flex: 1, fontSize: 13, color: theme.foreground },
  historyState: { width: 72, fontSize: 12, color: theme.mutedForeground, textAlign: "right" },
  historyOk: { color: "#047857", fontWeight: "700" },
  historyAbsent: { color: "#b91c1c", fontWeight: "700" },
});
