import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { State } from "react-native-ble-plx";
import type { PostgrestError } from "@supabase/supabase-js";
import { FaceBiometricConsentModal } from "../../components/FaceBiometricConsentModal";
import { FaceCameraModal, type FaceCaptureResult } from "../../components/FaceCameraModal";
import { useFaceBiometricConsentGate } from "../../hooks/useFaceBiometricConsentGate";
import { getPalApiBaseUrl } from "../../lib/config";
import { postFaceCompare } from "../../lib/face-api";
import { PAL_MESH_MAX_HOP } from "../../lib/ble-mesh-constants";
import {
  getBlePlxManager,
  isBleAdvertiserNativeAvailable,
  parsePayloadFromBlePlxDevice,
  startMeshAdvertise,
  stopMeshAdvertise,
} from "../../lib/ble-mesh-native";
import { ensureAndroidBleScanPermissions, ensureAndroidBleAdvertisePermissions } from "../../lib/ble-mesh-permissions";
import { beaconTokenHexToBytes } from "../../lib/ble-mesh-payload";
import {
  fetchBleSessionByBeaconToken,
  fetchExistingBleVerification,
  insertBleVerification,
  type BleSessionWithEvent,
} from "../../lib/ble-mesh-supabase";
import { uploadLocalImageToSupabase } from "../../lib/storage-upload";
import { getSupabase } from "../../lib/supabase";
import type { Profile } from "../../types";
import { theme } from "../../theme";

type Props = { profile: Profile };

type Discovery = { token: string; hop: number; key: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function StudentBleMeshScreen({ profile }: Props) {
  const [manualToken, setManualToken] = useState("");
  const [session, setSession] = useState<BleSessionWithEvent | null>(null);
  const [heardHop, setHeardHop] = useState(0);
  const [verifierId, setVerifierId] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { consentVisible, requestCameraAccess, onConsentAgree, onConsentDecline } =
    useFaceBiometricConsentGate();
  const [relaying, setRelaying] = useState(false);
  const [verifiedHop, setVerifiedHop] = useState<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const apiOk = Boolean(getPalApiBaseUrl());
  const advertiserOk = isBleAdvertiserNativeAvailable();

  const ev = session?.calendar_requests;

  const canRelay =
    advertiserOk &&
    session != null &&
    verifiedHop !== null &&
    verifiedHop < PAL_MESH_MAX_HOP;

  const loadSessionByToken = useCallback(
    async (tokenHex: string, hopFromAir: number) => {
      const t = tokenHex.trim().toLowerCase();
      if (!/^[0-9a-f]{16}$/.test(t)) {
        Alert.alert("Token", "Enter a 16-character hex token from your instructor.");
        return;
      }
      setLoadingSession(true);
      try {
        beaconTokenHexToBytes(t);
      } catch {
        Alert.alert("Token", "Invalid token format.");
        setLoadingSession(false);
        return;
      }
      try {
        const supabase = getSupabase();
        const row = await fetchBleSessionByBeaconToken(supabase, t);
        if (!row) {
          Alert.alert("Session", "No active session for this token, or you are not enrolled.");
          setSession(null);
          return;
        }
        setSession(row);
        setHeardHop(hopFromAir);
        setVerifierId("");
        setVerifiedHop(null);
      } catch (e) {
        Alert.alert("Session", e instanceof Error ? e.message : "Lookup failed");
        setSession(null);
      } finally {
        setLoadingSession(false);
      }
    },
    []
  );

  async function onScanToggle() {
    if (scanning) {
      getBlePlxManager().stopDeviceScan();
      setScanning(false);
      return;
    }
    const ok = await ensureAndroidBleScanPermissions();
    if (!ok) {
      Alert.alert("Bluetooth", "Scan permission was not granted.");
      return;
    }
    const mgr = getBlePlxManager();
    const st = await mgr.state();
    if (st !== State.PoweredOn) {
      Alert.alert("Bluetooth", "Turn Bluetooth on to scan.");
      return;
    }
    seenRef.current = new Set();
    setDiscoveries([]);
    setScanning(true);
    mgr.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        Alert.alert("Scan", error.message);
        setScanning(false);
        return;
      }
      if (!device) return;
      const parsed = parsePayloadFromBlePlxDevice(device);
      if (!parsed) return;
      const key = `${parsed.t}-${parsed.h}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      setDiscoveries((prev) => {
        if (prev.some((p) => p.key === key)) return prev;
        return [...prev, { token: parsed.t, hop: parsed.h, key }].slice(0, 24);
      });
    });
  }

  useEffect(() => {
    return () => {
      getBlePlxManager().stopDeviceScan();
      void stopMeshAdvertise();
    };
  }, []);

  async function submitVerification(capture: FaceCaptureResult) {
    if (!session) return;
    if (heardHop > 0) {
      const v = verifierId.trim();
      if (!UUID_RE.test(v)) {
        Alert.alert(
          "Verifier required",
          "For relay beacons (hop > 0), enter the student profile UUID of the classmate who relayed the signal. They can find it in their BLE mesh screen after verifying."
        );
        return;
      }
    }

    const supabase = getSupabase();
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    const accessToken = authSession?.access_token;
    if (!accessToken) {
      Alert.alert("Sign in", "Your session expired. Sign in again.");
      return;
    }

    setVerifying(true);
    try {
      const existing = await fetchExistingBleVerification(supabase, session.id, profile.id);
      if (existing) {
        Alert.alert("Already verified", "You already checked in for this BLE session.");
        return;
      }

      const filename = `${profile.id}/ble-mesh-${session.id}-${Date.now()}.jpg`;
      const { uri, base64 } = capture;
      const { error: upErr } = await uploadLocalImageToSupabase(
        "face-photos",
        filename,
        uri,
        { base64 }
      );
      if (upErr) {
        Alert.alert("Upload", String(upErr));
        return;
      }

      const cmp = await postFaceCompare(accessToken, uri, profile.id);
      if (!cmp.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Face check", cmp.error);
        return;
      }
      if (!cmp.match) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Face check", "Face not recognized. Try again with clearer lighting.");
        return;
      }

      await insertBleVerification(supabase, {
        sessionId: session.id,
        studentId: profile.id,
        hopCount: heardHop,
        verifierStudentId: heardHop > 0 ? verifierId.trim() : null,
      });

      setVerifiedHop(heardHop);
      Alert.alert("Checked in", "Your BLE attendance was recorded.");
    } catch (e: unknown) {
      const pe = e as PostgrestError | Error;
      const code = "code" in pe ? pe.code : "";
      if (code === "23505") {
        Alert.alert("Already verified", "This session already has your check-in.");
      } else {
        Alert.alert("Error", pe instanceof Error ? pe.message : "Unexpected error");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function onRelay() {
    if (!session || verifiedHop === null) return;
    const nextHop = verifiedHop + 1;
    if (nextHop > PAL_MESH_MAX_HOP) return;
    const ok = await ensureAndroidBleAdvertisePermissions();
    if (!ok) {
      Alert.alert("Bluetooth", "Advertising permission was not granted.");
      return;
    }
    setRelaying(true);
    try {
      await startMeshAdvertise(session.public_beacon_token, nextHop);
      Alert.alert(
        "Relaying",
        `Advertising hop ${nextHop}. Share your profile ID (below) with classmates who hear this relay so they can complete check-in.`
      );
    } catch (e) {
      setRelaying(false);
      Alert.alert("Relay", e instanceof Error ? e.message : "Failed");
    }
  }

  async function onStopRelay() {
    await stopMeshAdvertise();
    setRelaying(false);
  }

  const subtitle = useMemo(() => {
    if (!ev) return "";
    return `${format(new Date(ev.event_date), "MMM d")} · ${ev.start_time.slice(0, 5)} – ${ev.end_time.slice(0, 5)}`;
  }, [ev]);

  if (!profile.face_registered) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>BLE mesh attendance</Text>
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Register your face under Face registration before using BLE check-in.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BLE mesh attendance</Text>
      <Text style={styles.sub}>
        Scan for your instructor’s beacon or type the token. Face check uses the same API as Wi‑Fi
        attendance (no classroom Wi‑Fi required).
      </Text>

      {!apiOk ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>Set EXPO_PUBLIC_PAL_API_URL for face compare.</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Scan</Text>
      <Pressable
        style={[styles.btnPrimary, scanning && styles.btnDisabled]}
        onPress={() => void onScanToggle()}
      >
        <Text style={styles.btnPrimaryText}>{scanning ? "Stop scan" : "Start scan"}</Text>
      </Pressable>
      {discoveries.length > 0 ? (
        <View style={styles.discList}>
          {discoveries.map((d) => (
            <Pressable
              key={d.key}
              style={styles.discRow}
              onPress={() => void loadSessionByToken(d.token, d.hop)}
            >
              <Text style={styles.discToken} numberOfLines={1}>
                {d.token}
              </Text>
              <Text style={styles.discHop}>hop {d.hop}</Text>
            </Pressable>
          ))}
        </View>
      ) : scanning ? (
        <Text style={styles.muted}>Listening for PAL beacons…</Text>
      ) : null}

      <Text style={styles.section}>Or enter token</Text>
      <TextInput
        value={manualToken}
        onChangeText={setManualToken}
        placeholder="16-character hex token"
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
      />
      <Pressable
        style={[styles.btnSecondary, loadingSession && styles.btnDisabled]}
        disabled={loadingSession}
        onPress={() => void loadSessionByToken(manualToken, 0)}
      >
        {loadingSession ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Text style={styles.btnSecondaryText}>Load session</Text>
        )}
      </Pressable>

      {session && ev ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {ev.title}
          </Text>
          <Text style={styles.meta}>{subtitle}</Text>
          <Text style={styles.meta}>Prof. {ev.professor?.full_name ?? "—"}</Text>
          <Text style={styles.meta}>Heard hop: {heardHop}</Text>
          <Text style={styles.metaSmall} selectable>
            Session token: {session.public_beacon_token}
          </Text>

          {heardHop > 0 ? (
            <View style={styles.verifierBox}>
              <Text style={styles.meta}>
                Relay check-in: enter the student profile UUID of the device that relayed this beacon.
              </Text>
              <TextInput
                value={verifierId}
                onChangeText={setVerifierId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          ) : null}

          {verifiedHop === null ? (
            <Pressable
              style={[styles.btnPrimary, (verifying || !apiOk) && styles.btnDisabled]}
              disabled={verifying || !apiOk}
              onPress={() => requestCameraAccess(() => setCameraOpen(true))}
            >
              {verifying ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text style={styles.btnPrimaryText}>Verify face & check in</Text>
              )}
            </Pressable>
          ) : (
            <Text style={styles.ok}>Checked in (hop {verifiedHop})</Text>
          )}

          {verifiedHop !== null ? (
            <View style={styles.shareBox}>
              <Text style={styles.meta}>Your profile ID (for relay classmates):</Text>
              <Text style={styles.mono} selectable>
                {profile.id}
              </Text>
            </View>
          ) : null}

          {canRelay ? (
            relaying ? (
              <Pressable style={styles.btnDanger} onPress={() => void onStopRelay()}>
                <Text style={styles.btnDangerText}>Stop relay</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.btnSecondary} onPress={() => void onRelay()}>
                <Text style={styles.btnSecondaryText}>
                  Relay beacon (advertise hop {verifiedHop! + 1})
                </Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}

      <FaceBiometricConsentModal
        visible={consentVisible}
        onClose={onConsentDecline}
        onAgree={onConsentAgree}
      />
      <FaceCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title="Face check for BLE attendance"
        onCapture={(result) => {
          setCameraOpen(false);
          void submitVerification(result);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 6 },
  sub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 14 },
  section: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginTop: 16, marginBottom: 8 },
  muted: { fontSize: 13, color: theme.mutedForeground, marginTop: 8 },
  warn: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 12,
  },
  warnText: { fontSize: 13, color: theme.foreground, lineHeight: 18 },
  btnPrimary: {
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 42,
    justifyContent: "center",
  },
  btnPrimaryText: { color: theme.primaryForeground, fontWeight: "700" },
  btnSecondary: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    minHeight: 42,
    justifyContent: "center",
  },
  btnSecondaryText: { fontWeight: "700", color: theme.primary },
  btnDanger: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  btnDangerText: { fontWeight: "700", color: "#b91c1c" },
  btnDisabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  discList: { marginTop: 10 },
  discRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  discToken: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
    marginRight: 8,
  },
  discHop: { fontSize: 12, fontWeight: "700", color: theme.mutedForeground },
  card: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.card,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  meta: { fontSize: 13, color: theme.mutedForeground },
  metaSmall: { fontSize: 11, color: theme.mutedForeground },
  verifierBox: { marginTop: 8, gap: 8 },
  ok: { fontSize: 14, fontWeight: "700", color: "#047857", marginTop: 4 },
  shareBox: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: theme.glyphWell },
  mono: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
    color: theme.foreground,
  },
});
