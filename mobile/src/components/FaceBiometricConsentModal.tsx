import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenModal } from "./FullScreenModal";
import { theme } from "../theme";

const SUPPORT_EMAIL = "info.thenucleus@gmail.com";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** User accepted; caller should then open the face camera. */
  onAgree: () => void;
};

export function FaceBiometricConsentModal({ visible, onClose, onAgree }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <FullScreenModal visible={visible} onClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Text style={styles.title}>Face data consent</Text>
        <Text style={styles.lead}>
          Before we use your camera for face capture, please read the following and confirm you agree.
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.body}>
            The Nucleus may collect photos of your face and derive numerical templates used only to verify your identity
            for campus attendance and related features you use in this app.
          </Text>
          <Text style={[styles.body, styles.gap]}>
            Your face data is stored on secure infrastructure, is not sold, and is not used for advertising. You can
            withdraw consent later by removing face registration in the app or by contacting us at {SUPPORT_EMAIL}.
          </Text>
          <Text style={[styles.body, styles.gap]}>
            By tapping &quot;I agree&quot;, you confirm that you have read our Privacy Policy and Terms of Service on
            the web and that you consent to this processing.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.outlineBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.outlineBtnText}>Not now</Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            onPress={onAgree}
            accessibilityRole="button"
            accessibilityLabel="I agree to face data collection"
          >
            <Text style={styles.primaryBtnText}>I agree</Text>
          </Pressable>
        </View>
      </View>
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.foreground,
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    color: theme.mutedForeground,
    lineHeight: 22,
    marginBottom: 12,
  },
  scroll: { flex: 1, minHeight: 120 },
  scrollContent: { paddingBottom: 16 },
  body: {
    fontSize: 15,
    color: theme.foreground,
    lineHeight: 23,
  },
  gap: { marginTop: 14 },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    backgroundColor: theme.card,
  },
  outlineBtnText: { fontSize: 16, fontWeight: "600", color: theme.foreground },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: theme.primary,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: theme.primaryForeground },
});
