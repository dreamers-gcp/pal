import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NucleusWordmark } from "../components/NucleusWordmark";
import { getPasswordResetRedirectUrl } from "../lib/auth-deep-link";
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

type Props = {
  onBackToLogin: () => void;
};

export function ForgotPasswordScreen({ onBackToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setSubmitAttempted(true);
    setError("");
    setMessage("");
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Email is required.");
      return;
    }
    setFieldError("");

    setLoading(true);
    const supabase = getSupabase();
    const redirectTo = getPasswordResetRedirectUrl();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage(
      "If an account exists for that email, you will receive a link to reset your password. Open it on this device to finish in the app."
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["rgba(79, 70, 229, 0.92)", "#5b52f0", theme.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: 20 + insets.top }]}
        >
          <NucleusWordmark size="sm" inverse />
          <Text style={styles.heroTitle}>Reset your password</Text>
          <Text style={styles.heroBody}>
            We&apos;ll email you a secure link. Use the same device with this app installed so the link opens The
            Nucleus.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.sub}>Enter your account email.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldError ? styles.inputErr : null]}
              placeholder="you@university.edu"
              placeholderTextColor={theme.mutedForeground}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (submitAttempted) {
                  setFieldError(t.trim() ? "" : "Email is required.");
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
            {fieldError ? <Text style={styles.fieldErr}>{fieldError}</Text> : null}
          </View>

          {error ? (
            <Text style={styles.bannerErr} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text style={styles.primaryBtnText}>Send reset link</Text>
            )}
          </Pressable>

          <Pressable onPress={onBackToLogin} style={styles.backWrap} hitSlop={8}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 28,
  },
  heroBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.88)",
    maxWidth: 360,
  },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    marginBottom: 24,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: 22, fontWeight: "600", color: theme.foreground },
  sub: { marginTop: 6, fontSize: 15, color: theme.mutedForeground },
  field: { marginTop: 18 },
  label: { fontSize: 14, fontWeight: "500", color: theme.foreground, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  inputErr: { borderColor: theme.destructive },
  fieldErr: { marginTop: 4, fontSize: 13, color: theme.destructive },
  bannerErr: { marginTop: 12, fontSize: 14, color: theme.destructive },
  message: { marginTop: 12, fontSize: 14, color: theme.mutedForeground, lineHeight: 21 },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnText: { color: theme.primaryForeground, fontSize: 16, fontWeight: "600" },
  backWrap: { marginTop: 20, alignSelf: "center" },
  link: { fontSize: 14, fontWeight: "600", color: theme.primary },
});
