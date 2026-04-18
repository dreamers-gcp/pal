import { format, parse, addMinutes, isWithinInterval } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DatePickerField } from "../../components/DatePickerField";
import { FaceCameraModal, type FaceCaptureResult } from "../../components/FaceCameraModal";
import { SelectModal, type SelectOption } from "../../components/SelectModal";
import { postFaceCompare } from "../../lib/face-api";
import {
  ATTENDANCE_WINDOW_MINUTES,
} from "../../lib/face-math";
import { getPalApiBaseUrl } from "../../lib/config";
import {
  classroomExpectsWifi,
  matchStudentWifiToClassroom,
} from "../../lib/attendance-wifi-match";
import {
  getWifiSnapshotForAttendance,
  type WifiAttendanceSnapshot,
} from "../../lib/wifi-attendance";
import { uploadLocalImageToSupabase } from "../../lib/storage-upload";
import {
  isProfessorMarkedAbsent,
  isStudentPresent,
} from "../../lib/attendance-record";
import {
  attendanceSubjectLabelsForEvent,
  decodeCalendarRequestSubjects,
  eventMatchesAttendanceSubjectFilter,
  uniqueAttendanceSubjectLabels,
} from "../../lib/calendar-subject";
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

function StudentAttendanceHistory({
  events,
  attendanceMap,
}: {
  events: CalendarRequest[];
  attendanceMap: Record<string, AttendanceRecord>;
}) {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("");
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  const pastEvents = useMemo(
    () =>
      events.filter(
        (e) => new Date(e.event_date) <= new Date() && !isEventToday(e.event_date)
      ),
    [events]
  );

  const sortedPast = useMemo(
    () =>
      [...pastEvents].sort(
        (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      ),
    [pastEvents]
  );

  const subjectOptions = useMemo(
    () => uniqueAttendanceSubjectLabels(sortedPast),
    [sortedPast]
  );

  const subjectSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: "all", label: "All subjects" },
      ...subjectOptions.map((s) => ({ value: s, label: s })),
    ],
    [subjectOptions]
  );

  const subjectFilterLabel =
    subjectFilter === "all"
      ? "All subjects"
      : subjectOptions.includes(subjectFilter)
        ? subjectFilter
        : "All subjects";

  const filteredPast = useMemo(() => {
    return sortedPast.filter((event) => {
      const day = format(new Date(event.event_date), "yyyy-MM-dd");
      if (!eventMatchesAttendanceSubjectFilter(event, subjectFilter)) return false;
      if (dayFilter && day !== dayFilter) return false;
      return true;
    });
  }, [sortedPast, subjectFilter, dayFilter]);

  const subjectSummary = useMemo(() => {
    const bucket = new Map<string, { total: number; attended: number }>();
    for (const event of sortedPast) {
      for (const subject of attendanceSubjectLabelsForEvent(event)) {
        const row = bucket.get(subject) ?? { total: 0, attended: 0 };
        row.total += 1;
        if (isStudentPresent(attendanceMap[event.id])) row.attended += 1;
        bucket.set(subject, row);
      }
    }
    return Array.from(bucket.entries())
      .map(([subject, stats]) => ({
        subject,
        total: stats.total,
        attended: stats.attended,
        percentage:
          stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }));
  }, [sortedPast, attendanceMap]);

  const { overallPastTotal, overallPastAttended, overallPct } = useMemo(() => {
    const overallPastTotal = sortedPast.length;
    const overallPastAttended = sortedPast.filter((e) =>
      isStudentPresent(attendanceMap[e.id])
    ).length;
    const overallPct =
      overallPastTotal > 0
        ? Math.round((overallPastAttended / overallPastTotal) * 100)
        : 0;
    return { overallPastTotal, overallPastAttended, overallPct };
  }, [sortedPast, attendanceMap]);

  if (pastEvents.length === 0) return null;

  return (
    <View style={styles.historySection}>
      <Text style={styles.historyTitleMain}>Attendance history</Text>

      <View style={styles.statCard}>
        <View style={styles.statCardHeader}>
          <Text style={styles.statCardLabel}>Overall attendance</Text>
          <Text style={styles.statCardPct}>{overallPct}%</Text>
        </View>
        <Text style={styles.statCardSub}>
          {overallPastAttended}/{overallPastTotal} classes attended
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${overallPct}%` }]} />
        </View>
      </View>

      <Text style={styles.subjectSummaryHeading}>Subject summary</Text>
      <View style={styles.subjectGrid}>
        {subjectSummary.map((item) => (
          <View key={item.subject} style={styles.subjectCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.subjectCardName} numberOfLines={2}>
                {item.subject}
              </Text>
              <Text style={styles.statCardPct}>{item.percentage}%</Text>
            </View>
            <Text style={styles.statCardSub}>
              {item.attended}/{item.total} classes attended
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${item.percentage}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.filterBar}>
        <Text style={styles.filterBarTitle}>Filters</Text>
        <Pressable
          onPress={() => setSubjectModalOpen(true)}
          style={styles.selectTrigger}
          accessibilityRole="button"
          accessibilityLabel="Filter by subject"
        >
          <Text style={styles.selectTriggerText} numberOfLines={1}>
            {subjectFilterLabel}
          </Text>
          <Text style={styles.selectChevron}>▼</Text>
        </Pressable>
        <SelectModal
          visible={subjectModalOpen}
          title="Subject"
          options={subjectSelectOptions}
          selectedValue={subjectFilter}
          onSelect={setSubjectFilter}
          onClose={() => setSubjectModalOpen(false)}
        />
        <DatePickerField
          label="Date"
          value={dayFilter}
          onChange={setDayFilter}
          placeholder="Any date"
          containerStyle={styles.filterDateField}
        />
        {(subjectFilter !== "all" || dayFilter !== "") && (
          <Pressable
            onPress={() => {
              setSubjectFilter("all");
              setDayFilter("");
            }}
            style={styles.clearFilters}
          >
            <Text style={styles.clearFiltersText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {filteredPast.slice(0, 30).map((event) => {
        const att = attendanceMap[event.id];
        const pastPresent = isStudentPresent(att);
        const pastProfAbsent = isProfessorMarkedAbsent(att);
        return (
          <View key={event.id} style={styles.historyListRow}>
            <Text style={pastPresent ? styles.historyIconOk : styles.historyIconBad}>
              {pastPresent ? "✓" : "✕"}
            </Text>
            <View style={styles.historyListMain}>
              <Text style={styles.historyListTitle} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={styles.historyListMeta} numberOfLines={1}>
                {decodeCalendarRequestSubjects(event.subject).join(", ") || "—"} ·{" "}
                {format(new Date(event.event_date), "MMM d, yyyy")}
              </Text>
            </View>
            <Text
              style={[
                styles.historyListStatus,
                pastPresent && styles.historyOk,
                pastProfAbsent && styles.historyAbsent,
              ]}
            >
              {pastPresent
                ? "Present"
                : pastProfAbsent
                  ? "Absent (instructor)"
                  : "Absent"}
            </Text>
          </View>
        );
      })}

      {filteredPast.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyText}>No attendance history for selected filters.</Text>
        </View>
      ) : null}
    </View>
  );
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
  const [wifiSnap, setWifiSnap] = useState<WifiAttendanceSnapshot>({
    wifi_ssid: null,
    wifi_bssid: null,
  });

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

  /** Events, attendance, profile (e.g. face_registered), and Wi‑Fi snapshot — only when the user taps Refresh. */
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [snap] = await Promise.all([
        getWifiSnapshotForAttendance(),
        loadEvents(true),
        fetchAttendance(true),
      ]);
      setWifiSnap(snap);
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
      const { error: upErr } = await uploadLocalImageToSupabase(
        "face-photos",
        filename,
        uri,
        { base64 }
      );

      if (upErr) {
        Alert.alert(
          "Face verification",
          `Could not upload your photo for face check: ${upErr}`
        );
        return;
      }

      const cmp = await postFaceCompare(token, uri, profile.id);
      if (!cmp.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Face verification failed", cmp.error);
        return;
      }
      if (!cmp.match) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert(
          "Face verification failed",
          "Your face was not recognized. Try again with better lighting, facing the camera."
        );
        return;
      }

      const similarity = Number(cmp.similarity ?? 0);
      const similarityScore = cmp.match ? Math.max(similarity, 0.35) : similarity;

      const wifi = await getWifiSnapshotForAttendance();
      const wifiCheck = matchStudentWifiToClassroom(
        event.classroom,
        wifi.wifi_ssid,
        wifi.wifi_bssid
      );
      if (!wifiCheck.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Wi‑Fi verification failed", wifiCheck.message);
        return;
      }

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
          const msg = dbErr.message ?? "";
          const looksLikeWifi = /wi-?fi|ssid|bssid/i.test(msg);
          Alert.alert(
            looksLikeWifi ? "Wi‑Fi verification failed" : "Could not save attendance",
            msg
          );
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, styles.headerTitle]}>Attendance</Text>
          <Pressable
            onPress={() => void refreshAll()}
            disabled={refreshing}
            style={styles.headerRefreshBtn}
            accessibilityRole="button"
            accessibilityLabel="Refresh attendance and account data"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={styles.headerRefreshLabel}>Refresh</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Face not registered</Text>
          <Text style={styles.warnBody}>
            Register your face under Face registration in the menu before marking attendance. Tap
            Refresh to reload your profile from the server.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, styles.headerTitle]}>{"Today's attendance"}</Text>
        <Pressable
          onPress={() => void refreshAll()}
          disabled={refreshing}
          style={styles.headerRefreshBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh classes, attendance, profile, and Wi‑Fi"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={styles.headerRefreshLabel}>Refresh</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Mark within {ATTENDANCE_WINDOW_MINUTES} minutes after class start using your front camera.
      </Text>

      <View style={styles.wifiCard}>
        <Text style={styles.wifiCardTitleOnly}>Your Wi‑Fi (read by the app)</Text>
        <Text style={styles.wifiRow}>
          <Text style={styles.wifiLabel}>SSID</Text>
          {wifiSnap.wifi_ssid ?? "—"}
        </Text>
        <Text style={styles.wifiRow} selectable>
          <Text style={styles.wifiLabel}>BSSID</Text>
          {wifiSnap.wifi_bssid ?? "—"}
        </Text>
        <Text style={styles.wifiFootnote}>
          Tap Refresh to update. Location must be allowed. On iOS, SSID/BSSID need the “Access WiFi
          Information” capability on your Apple App ID and a rebuild (EAS sets this for cloud
          builds).
        </Text>
      </View>

      {!apiConfigured ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Set EXPO_PUBLIC_PAL_API_URL to your The Nucleus web URL (for /api/face/compare).
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
              {classroomExpectsWifi(event.classroom) ? (
                <Text style={styles.wifiHint}>
                  This room checks class Wi‑Fi with your face. Allow location when prompted so your
                  network can be read.
                </Text>
              ) : null}

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

      <StudentAttendanceHistory events={events} attendanceMap={attendanceMap} />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  headerTitle: { flex: 1, marginBottom: 0 },
  headerRefreshBtn: {
    minWidth: 88,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  headerRefreshLabel: { fontSize: 14, fontWeight: "700", color: theme.primary },
  title: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  sub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 14 },
  wifiCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    backgroundColor: theme.card,
  },
  wifiCardTitleOnly: { fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  wifiRow: { fontSize: 13, color: theme.foreground, marginTop: 4, lineHeight: 18 },
  wifiLabel: { fontWeight: "600", color: theme.mutedForeground, marginRight: 6 },
  wifiFootnote: {
    fontSize: 11,
    color: theme.mutedForeground,
    marginTop: 10,
    lineHeight: 16,
  },
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
  wifiHint: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 8,
    lineHeight: 17,
  },
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
  historySection: { marginTop: 28 },
  historyTitleMain: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 12 },
  statCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: theme.card,
  },
  statCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  statCardLabel: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground },
  statCardPct: { fontSize: 18, fontWeight: "800", color: theme.foreground },
  statCardSub: { fontSize: 12, color: theme.mutedForeground, marginTop: 4 },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.glyphWell,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.primary, borderRadius: 4 },
  subjectSummaryHeading: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginBottom: 10 },
  subjectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  subjectCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: theme.card,
  },
  subjectCardName: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.foreground, marginRight: 6 },
  filterBar: { marginBottom: 12 },
  filterBarTitle: { fontSize: 13, fontWeight: "700", color: theme.foreground, marginBottom: 8 },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.card,
    marginBottom: 10,
  },
  selectTriggerText: { flex: 1, fontSize: 15, color: theme.foreground, marginRight: 8 },
  selectChevron: { fontSize: 10, color: theme.mutedForeground },
  filterDateField: { marginBottom: 8 },
  clearFilters: { alignSelf: "flex-start", paddingVertical: 6 },
  clearFiltersText: { fontSize: 14, fontWeight: "600", color: theme.primary },
  historyListRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyIconOk: { fontSize: 18, fontWeight: "800", color: "#047857", marginTop: 2 },
  historyIconBad: { fontSize: 18, fontWeight: "800", color: "#b91c1c", marginTop: 2 },
  historyListMain: { flex: 1, minWidth: 0 },
  historyListTitle: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  historyListMeta: { fontSize: 12, color: theme.mutedForeground, marginTop: 4 },
  historyListStatus: { fontSize: 12, color: theme.mutedForeground, marginTop: 2, maxWidth: 100, textAlign: "right" },
  historyEmpty: { paddingVertical: 20, alignItems: "center" },
  historyEmptyText: { fontSize: 14, color: theme.mutedForeground, textAlign: "center" },
  historyOk: { color: "#047857", fontWeight: "700" },
  historyAbsent: { color: "#b91c1c", fontWeight: "700" },
});
