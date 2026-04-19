import type { Session } from "@supabase/supabase-js";
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
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

const MIN_PASSWORD_LEN = 6;

type Props = {
  session: Session;
  onComplete: () => void;
};

export function ResetPasswordScreen({ session, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setSubmitAttempted(true);
    setError("");
    const next: { password?: string; confirm?: string } = {};
    if (!password) next.password = "Password is required.";
    else if (password.length < MIN_PASSWORD_LEN) {
      next.password = `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
    }
    if (password !== confirm) next.confirm = "Passwords do not match.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const supabase = getSupabase();
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    onComplete();
  }

  async function handleCancel() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    onComplete();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <NucleusWordmark size="lg" />
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.sub}>Signed in as {session.user.email ?? session.user.id}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={[styles.input, fieldErrors.password ? styles.inputErr : null]}
              placeholder={`At least ${MIN_PASSWORD_LEN} characters`}
              placeholderTextColor={theme.mutedForeground}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({
                    ...f,
                    password: !t
                      ? "Password is required."
                      : t.length < MIN_PASSWORD_LEN
                        ? `Password must be at least ${MIN_PASSWORD_LEN} characters.`
                        : undefined,
                  }));
                }
              }}
              secureTextEntry
              autoComplete="new-password"
              editable={!loading}
            />
            {fieldErrors.password ? <Text style={styles.fieldErr}>{fieldErrors.password}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={[styles.input, fieldErrors.confirm ? styles.inputErr : null]}
              placeholder="Re-enter password"
              placeholderTextColor={theme.mutedForeground}
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({
                    ...f,
                    confirm: t === password ? undefined : "Passwords do not match.",
                  }));
                }
              }}
              secureTextEntry
              autoComplete="new-password"
              editable={!loading}
            />
            {fieldErrors.confirm ? <Text style={styles.fieldErr}>{fieldErrors.confirm}</Text> : null}
          </View>

          {error ? (
            <Text style={styles.bannerErr} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => void handleSave()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text style={styles.primaryBtnText}>Update password</Text>
            )}
          </Pressable>

          <Pressable onPress={() => void handleCancel()} style={styles.cancelWrap} disabled={loading}>
            <Text style={styles.cancelText}>Cancel and sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1 },
  inner: {
    paddingHorizontal: 24,
    maxWidth: 440,
    alignSelf: "center",
    width: "100%",
  },
  title: { marginTop: 20, fontSize: 22, fontWeight: "700", color: theme.foreground },
  sub: { marginTop: 8, fontSize: 14, color: theme.mutedForeground },
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
  primaryBtn: {
    marginTop: 24,
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnText: { color: theme.primaryForeground, fontSize: 16, fontWeight: "600" },
  cancelWrap: { marginTop: 16, alignSelf: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, color: theme.mutedForeground, fontWeight: "500" },
});
