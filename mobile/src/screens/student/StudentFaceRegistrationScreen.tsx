import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FaceBiometricConsentModal } from "../../components/FaceBiometricConsentModal";
import { FaceCameraModal, type FaceCaptureResult } from "../../components/FaceCameraModal";
import { useFaceBiometricConsentGate } from "../../hooks/useFaceBiometricConsentGate";
import { RefreshableScrollView } from "../../components/RefreshableScrollView";
import { postFaceEmbedding } from "../../lib/face-api";
import {
  cosineSimilarity,
  FACE_REGISTRATION_MATCH_THRESHOLD,
  FACE_REGISTRATION_MAX_PHOTOS,
  FACE_REGISTRATION_MIN_PHOTOS,
} from "../../lib/face-math";
import { arrayBufferFromLocalUri } from "../../lib/image-uri";
import { uploadBufferToStorage } from "../../lib/storage-upload";
import { getPalApiBaseUrl } from "../../lib/config";
import { getSupabase } from "../../lib/supabase";
import type { FaceEmbedding, Profile } from "../../types";
import { theme } from "../../theme";

type Props = {
  profile: Profile;
  onRegistered?: () => void;
};

function FaceThumb({
  emb,
  onRemove,
}: {
  emb: FaceEmbedding;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getSupabase().storage
        .from("face-photos")
        .createSignedUrl(emb.photo_path, 300);
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [emb.photo_path]);

  return (
    <View style={styles.thumbWrap}>
      <View style={styles.thumbBox}>
        {url ? (
          <Image source={{ uri: url }} style={styles.thumbImg} />
        ) : (
          <ActivityIndicator style={styles.thumbLoader} color={theme.mutedForeground} />
        )}
      </View>
      <Pressable style={styles.thumbRemove} onPress={onRemove} hitSlop={8}>
        <Text style={styles.thumbRemoveText}>×</Text>
      </Pressable>
    </View>
  );
}

export function StudentFaceRegistrationScreen({ profile, onRegistered }: Props) {
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { consentVisible, requestCameraAccess, onConsentAgree, onConsentDecline } =
    useFaceBiometricConsentGate();

  const apiConfigured = Boolean(getPalApiBaseUrl());

  const fetchEmbeddings = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("face_embeddings")
      .select("*")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: true });
    setEmbeddings((data as FaceEmbedding[]) ?? []);
    if (!silent) setLoading(false);
  }, [profile.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchEmbeddings(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchEmbeddings]);

  useEffect(() => {
    fetchEmbeddings();
  }, [fetchEmbeddings]);

  async function handleCapturedUri({ uri, base64 }: FaceCaptureResult) {
    setUploading(true);
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const filename = `${profile.id}/${Date.now()}.jpg`;

    try {
      const data = await arrayBufferFromLocalUri(uri, { base64 });
      const { error: uploadErr } = await uploadBufferToStorage(
        "face-photos",
        filename,
        data,
        "image/jpeg"
      );

      if (uploadErr) {
        Alert.alert("Upload failed", uploadErr);
        setUploading(false);
        return;
      }

      const embRes = await postFaceEmbedding(token, uri);
      if (!embRes.ok) {
        await supabase.storage.from("face-photos").remove([filename]);
        Alert.alert("Face processing", embRes.error);
        setUploading(false);
        return;
      }

      const newEmbedding = embRes.embedding;
      const { data: existingRows } = await supabase
        .from("face_embeddings")
        .select("embedding")
        .eq("student_id", profile.id);
      const existingEmb = (existingRows ?? []) as { embedding: number[] }[];
      if (existingEmb.length > 0) {
        const bestSim = Math.max(
          ...existingEmb.map((e) => cosineSimilarity(newEmbedding, e.embedding))
        );
        if (bestSim < FACE_REGISTRATION_MATCH_THRESHOLD) {
          await supabase.storage.from("face-photos").remove([filename]);
          Alert.alert(
            "No match",
            "This photo does not match your earlier captures. Retake with only your face visible."
          );
          setUploading(false);
          return;
        }
      }

      const { error: dbErr } = await supabase.from("face_embeddings").insert({
        student_id: profile.id,
        photo_path: filename,
        embedding: newEmbedding,
      });

      if (dbErr) {
        Alert.alert("Save failed", dbErr.message);
        setUploading(false);
        return;
      }

      await fetchEmbeddings();

      const { count } = await supabase
        .from("face_embeddings")
        .select("id", { count: "exact", head: true })
        .eq("student_id", profile.id);

      if ((count ?? 0) >= FACE_REGISTRATION_MIN_PHOTOS) {
        await supabase.from("profiles").update({ face_registered: true }).eq("id", profile.id);
        onRegistered?.();
      }

      Alert.alert("Saved", "Face photo registered.");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(emb: FaceEmbedding) {
    const supabase = getSupabase();
    await supabase.storage.from("face-photos").remove([emb.photo_path]);
    await supabase.from("face_embeddings").delete().eq("id", emb.id);
    const updated = embeddings.filter((e) => e.id !== emb.id);
    setEmbeddings(updated);
    if (updated.length < FACE_REGISTRATION_MIN_PHOTOS) {
      await supabase.from("profiles").update({ face_registered: false }).eq("id", profile.id);
      onRegistered?.();
    }
    Alert.alert("Removed", "Photo removed.");
  }

  const registered = embeddings.length >= FACE_REGISTRATION_MIN_PHOTOS;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <RefreshableScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Text style={styles.title}>Face registration</Text>
      <Text style={styles.sub}>
        Take {FACE_REGISTRATION_MIN_PHOTOS}–{FACE_REGISTRATION_MAX_PHOTOS} clear photos from slightly
        different angles. They are used to verify attendance.
      </Text>

      {!apiConfigured ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Set EXPO_PUBLIC_PAL_API_URL in mobile/.env to the base URL your phone can reach (where{" "}
            <Text style={{ fontWeight: "700" }}>/api/face/embedding</Text> is served).
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.progress}>
          {embeddings.length}/{FACE_REGISTRATION_MIN_PHOTOS} required photos
        </Text>
        {registered ? (
          <View style={styles.doneBadge}>
            <Text style={styles.doneBadgeText}>Registered</Text>
          </View>
        ) : null}
      </View>

      {embeddings.length > 0 ? (
        <View style={styles.thumbRow}>
          {embeddings.map((emb) => (
            <FaceThumb key={emb.id} emb={emb} onRemove={() => removePhoto(emb)} />
          ))}
        </View>
      ) : null}

      {uploading ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.muted}>Processing…</Text>
        </View>
      ) : null}

      {embeddings.length < FACE_REGISTRATION_MAX_PHOTOS && !uploading ? (
        <Pressable
          style={[styles.primaryBtn, !apiConfigured && styles.btnDisabled]}
          onPress={() => apiConfigured && requestCameraAccess(() => setCameraOpen(true))}
          disabled={!apiConfigured}
        >
          <Text style={styles.primaryBtnText}>
            {embeddings.length === 0 ? "Start face registration" : "Add another photo"}
          </Text>
        </Pressable>
      ) : null}

      <FaceBiometricConsentModal
        visible={consentVisible}
        onClose={onConsentDecline}
        onAgree={onConsentAgree}
      />
      <FaceCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapturedUri}
        title="Hold still — capture your face"
      />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: theme.foreground, marginBottom: 8 },
  sub: { fontSize: 13, color: theme.mutedForeground, lineHeight: 19, marginBottom: 16 },
  warn: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 14,
  },
  warnText: { fontSize: 13, color: theme.foreground, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  progress: { fontSize: 14, color: theme.mutedForeground },
  doneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(1, 105, 111, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(1, 105, 111, 0.35)",
  },
  doneBadgeText: { fontSize: 12, fontWeight: "700", color: theme.primary },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  thumbWrap: { position: "relative" },
  thumbBox: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.accentBg,
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbLoader: { marginTop: 32 },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemoveText: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: -1 },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  muted: { fontSize: 14, color: theme.mutedForeground },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
});
