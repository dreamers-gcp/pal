import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { format } from "date-fns";
import type {
  AttendanceRecord,
  CalendarRequest,
  Profile,
} from "../lib/types";
import { fetchAttendanceMap, fetchStudentEventsForProfile } from "../lib/student-events";
import {
  ATTENDANCE_WINDOW_MINUTES,
  isEventToday,
  isWithinAttendanceWindow,
} from "../lib/datetime";
import { markAttendanceWithPhoto } from "../lib/face-attendance";
import {
  isProfessorMarkedAbsent,
  isStudentPresent,
} from "../lib/attendance-status";

export function AttendanceScreen({
  profile,
  onSignOut,
}: {
  profile: Profile;
  onSignOut: () => void;
}) {
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceRecord>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<CalendarRequest | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    const [ev, att] = await Promise.all([
      fetchStudentEventsForProfile(profile),
      fetchAttendanceMap(profile.id),
    ]);
    setEvents(ev);
    setAttendance(att);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const todayEvents = events.filter((e) => isEventToday(e.event_date));

  async function openCameraFor(event: CalendarRequest) {
    setMessage(null);
    if (!profile.face_registered) {
      setMessage(
        "Register your face in the PAL web app (Face Registration) before using mobile attendance."
      );
      return;
    }
    if (!isWithinAttendanceWindow(event)) {
      setMessage(
        `Attendance opens at class start and stays open for ${ATTENDANCE_WINDOW_MINUTES} minutes.`
      );
      return;
    }
    const rec = attendance[event.id];
    if (isProfessorMarkedAbsent(rec)) {
      setMessage(
        "Your instructor marked you absent for this class. Contact them if this is a mistake."
      );
      return;
    }
    if (isStudentPresent(rec)) {
      setMessage("You already marked attendance for this class.");
      return;
    }
    const perm = await requestPermission();
    if (!perm.granted) {
      setMessage("Camera permission is required.");
      return;
    }
    setActiveEvent(event);
    setCameraOpen(true);
  }

  async function onPhotoTaken(uri: string) {
    if (!activeEvent) return;
    setCameraOpen(false);
    setVerifying(true);
    setMessage(null);
    try {
      const result = await markAttendanceWithPhoto(profile.id, activeEvent, uri);
      if (result.ok) {
        setMessage("Attendance marked.");
        await load();
      } else {
        setMessage(result.message);
      }
    } finally {
      setVerifying(false);
      setActiveEvent(null);
    }
  }

  if (!profile.face_registered) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warnTitle}>Face not registered</Text>
        <Text style={styles.warnBody}>
          Open the PAL web app and complete Face Registration before marking attendance
          here.
        </Text>
        <Pressable style={styles.outlineBtn} onPress={onSignOut}>
          <Text style={styles.outlineBtnText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Today&apos;s classes</Text>
          <Text style={styles.headerSub}>{profile.full_name}</Text>
        </View>
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.banner}>{message}</Text> : null}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {todayEvents.length === 0 ? (
          <Text style={styles.empty}>No classes scheduled for today.</Text>
        ) : (
          todayEvents.map((event) => {
            const rec = attendance[event.id];
            const present = isStudentPresent(rec);
            const profAbsent = isProfessorMarkedAbsent(rec);
            const window = isWithinAttendanceWindow(event);
            return (
              <View key={event.id} style={styles.card}>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.meta}>
                  {format(new Date(String(event.event_date).split("T")[0]), "EEEE, MMM d")}
                  {" · "}
                  {String(event.start_time).slice(0, 5)} –{" "}
                  {String(event.end_time).slice(0, 5)}
                </Text>
                {event.classroom?.name ? (
                  <Text style={styles.meta}>{event.classroom.name}</Text>
                ) : null}
                {present ? (
                  <Text style={styles.present}>Present</Text>
                ) : profAbsent ? (
                  <Text style={styles.profAbsent}>
                    Absent (instructor) — you cannot mark attendance here.
                  </Text>
                ) : !window ? (
                  <Text style={styles.muted}>
                    {`Mark within ${ATTENDANCE_WINDOW_MINUTES} min after class start`}
                  </Text>
                ) : (
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => openCameraFor(event)}
                    disabled={verifying}
                  >
                    <Text style={styles.primaryBtnText}>
                      {verifying ? "Working…" : "Take photo & mark attendance"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <CameraModal
        visible={cameraOpen}
        permission={permission}
        onClose={() => {
          setCameraOpen(false);
          setActiveEvent(null);
        }}
        onCapture={onPhotoTaken}
      />
    </View>
  );
}

function CameraModal({
  visible,
  permission,
  onClose,
  onCapture,
}: {
  visible: boolean;
  permission: ReturnType<typeof useCameraPermissions>[0];
  onClose: () => void;
  onCapture: (uri: string) => void;
}) {
  const cameraRef = useRef<CameraView>(null);

  async function takePicture() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) onCapture(photo.uri);
    } catch {
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          />
        ) : (
          <Text style={styles.muted}>Camera unavailable</Text>
        )}
        <View style={styles.cameraActions}>
          <Pressable style={styles.outlineBtn} onPress={onClose}>
            <Text style={styles.outlineBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={takePicture}>
            <Text style={styles.primaryBtnText}>Capture</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#111" },
  headerSub: { fontSize: 14, color: "#666", marginTop: 4 },
  signOut: { fontSize: 15, color: "#2563eb", fontWeight: "500" },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    fontSize: 14,
  },
  empty: { padding: 24, color: "#666", fontSize: 15 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#111" },
  meta: { fontSize: 14, color: "#666", marginTop: 4 },
  present: {
    marginTop: 10,
    color: "#15803d",
    fontWeight: "600",
    fontSize: 15,
  },
  profAbsent: {
    marginTop: 10,
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
  muted: { marginTop: 8, color: "#888", fontSize: 13 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  outlineBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  outlineBtnText: { fontSize: 15, color: "#333" },
  warnTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8,
    textAlign: "center" },
  warnBody: { fontSize: 15, color: "#666", textAlign: "center", lineHeight: 22 },
  cameraWrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  cameraActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
});
