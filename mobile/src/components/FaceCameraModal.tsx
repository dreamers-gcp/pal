import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenModal } from "./FullScreenModal";
import { theme } from "../theme";

/** Result of `takePictureAsync` — `base64` is used for reliable uploads; `uri` is for previews and FormData. */
export type FaceCaptureResult = {
  uri: string;
  base64?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: FaceCaptureResult) => void;
  title?: string;
};

export function FaceCameraModal({
  visible,
  onClose,
  onCapture,
  title = "Center your face in the frame",
}: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    if (visible) {
      setReady(false);
      setTaking(false);
    }
  }, [visible]);

  return (
    <FullScreenModal visible={visible} onClose={onClose} dismissDisabled={taking}>
      <View style={styles.root}>
        {!permission?.granted ? (
          <View style={styles.centerBlock}>
            <Text style={styles.info}>Camera access is required for face capture.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => requestPermission()}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.textBtn} onPress={onClose}>
              <Text style={styles.textBtnLabel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.previewWrap}>
              <CameraView
                ref={camRef}
                style={styles.camera}
                facing="front"
                onCameraReady={() => setReady(true)}
              />
            </View>
            <Text style={styles.hint}>{title}</Text>
            {!ready ? (
              <Text style={styles.subtle}>Starting camera…</Text>
            ) : null}
            <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <Pressable style={styles.outlineBtn} onPress={onClose} disabled={taking}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, (!ready || taking) && styles.primaryBtnDisabled]}
                disabled={!ready || taking}
                onPress={async () => {
                  if (!camRef.current) return;
                  setTaking(true);
                  try {
                    const photo = await camRef.current.takePictureAsync({
                      /** Lower size → faster native upload to Storage (still enough for face match). */
                      quality: 0.72,
                      base64: true,
                      // Android: skipProcessing often yields a URI that multipart FormData
                      // fails to read, so /api/face/embedding gets no file ("Embedding request failed").
                      skipProcessing: Platform.OS !== "android",
                    });
                    if (photo?.uri) {
                      onCapture({ uri: photo.uri, base64: photo.base64 });
                      onClose();
                    }
                  } finally {
                    setTaking(false);
                  }
                }}
              >
                {taking ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text style={styles.primaryBtnText}>Capture</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centerBlock: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  info: { color: "#fff", fontSize: 16, textAlign: "center", lineHeight: 22 },
  previewWrap: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  camera: { flex: 1 },
  hint: {
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  subtle: { color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 6, fontSize: 13 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: theme.primaryForeground, fontWeight: "700", fontSize: 16 },
  outlineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
  },
  outlineBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  textBtn: { alignSelf: "center", paddingVertical: 8 },
  textBtnLabel: { color: "rgba(255,255,255,0.85)", fontSize: 16 },
});
