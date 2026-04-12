import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlanovaWordmark } from "../components/PlanovaWordmark";
import { getPalApiBaseUrl } from "../lib/config";
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

type LoginProps = {
  /** Native signup flow; if omitted, Sign up opens the web app when PAL URL is set. */
  onGoSignup?: () => void;
};

export function LoginScreen({ onGoSignup }: LoginProps) {
  const insets = useSafeAreaInsets();
  const webBase = getPalApiBaseUrl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function openWeb(path: string) {
    if (!webBase) return;
    const url = `${webBase}${path.startsWith("/") ? path : `/${path}`}`;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  }

  async function handleSignIn() {
    setSubmitAttempted(true);
    setError("");
    const next: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const supabase = getSupabase();
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setLoading(false);
    if (signErr) {
      setError(signErr.message);
      return;
    }
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
          <PlanovaWordmark size="sm" inverse />
          <Text style={styles.heroTitle}>Your campus schedule, simplified.</Text>
          <Text style={styles.heroBody}>
            Book rooms, manage courses, and stay on top of attendance—all in one place.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <PlanovaWordmark size="lg" />
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSub}>Sign in to your Planova account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputErr : null]}
              placeholder="you@university.edu"
              placeholderTextColor={theme.mutedForeground}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({
                    ...f,
                    email: t.trim() ? undefined : "Email is required.",
                  }));
                }
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!loading}
            />
            {fieldErrors.email ? (
              <Text style={styles.fieldErr}>{fieldErrors.email}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.password ? styles.inputErr : null]}
              placeholder="Your password"
              placeholderTextColor={theme.mutedForeground}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({
                    ...f,
                    password: t ? undefined : "Password is required.",
                  }));
                }
              }}
              secureTextEntry
              autoComplete="password"
              editable={!loading}
            />
            {fieldErrors.password ? (
              <Text style={styles.fieldErr}>{fieldErrors.password}</Text>
            ) : null}
            {webBase ? (
              <Pressable onPress={() => openWeb("/forgot-password")} style={styles.forgotWrap}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <Text style={styles.bannerErr} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.divider} />
          <Text style={styles.footerMuted}>
            Don&apos;t have an account?{" "}
            {onGoSignup ? (
              <Text style={styles.linkInline} onPress={onGoSignup}>
                Sign up
              </Text>
            ) : webBase ? (
              <Text style={styles.linkInline} onPress={() => openWeb("/signup")}>
                Sign up
              </Text>
            ) : (
              <Text style={styles.footerMuted}>Set EXPO_PUBLIC_PAL_API_URL to open web sign up.</Text>
            )}
          </Text>
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
    maxWidth: 340,
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
  welcomeTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "600",
    color: theme.foreground,
  },
  welcomeSub: {
    marginTop: 6,
    fontSize: 15,
    color: theme.mutedForeground,
  },
  field: { marginTop: 18 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.foreground,
    marginBottom: 6,
  },
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
  forgotWrap: { alignSelf: "flex-end", marginTop: 8 },
  link: { fontSize: 14, fontWeight: "500", color: theme.primary },
  bannerErr: {
    marginTop: 12,
    fontSize: 14,
    color: theme.destructive,
  },
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
  primaryBtnText: {
    color: theme.primaryForeground,
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    marginTop: 28,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerMuted: {
    textAlign: "center",
    fontSize: 14,
    color: theme.mutedForeground,
    lineHeight: 20,
  },
  linkInline: {
    fontWeight: "600",
    color: theme.primary,
  },
});
