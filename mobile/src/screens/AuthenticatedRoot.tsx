import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import type { Profile } from "../types";
import { theme } from "../theme";
import { HomeScreen } from "./HomeScreen";
import { SignupScreen } from "./SignupScreen";
import { StudentFaceRegistrationScreen } from "./student/StudentFaceRegistrationScreen";

type Gate = "checking" | "needs_profile" | "needs_face" | "ready";

function profileRowToProfile(row: Record<string, unknown>, fallbackEmail: string | null): Profile {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? fallbackEmail ?? ""),
    full_name: String(row.full_name ?? ""),
    role: (row.role as Profile["role"]) ?? "student",
    student_group: (row.student_group as string | null) ?? null,
    mobile_phone: (row.mobile_phone as string | null) ?? null,
    face_registered: Boolean(row.face_registered),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/**
 * After any sign-in (including Google), require the same core profile fields as the web app
 * before showing the main shell (mirrors Next.js middleware + `/auth/onboarding`).
 * Students must complete face registration in-app before the home shell (mirrors `/face-registration`).
 */
export function AuthenticatedRoot({ session }: { session: Session }) {
  const insets = useSafeAreaInsets();
  const [gate, setGate] = useState<Gate>("checking");
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);

  const refreshProfileGate = useCallback(async () => {
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, student_group, mobile_phone, face_registered, created_at, updated_at"
      )
      .eq("id", session.user.id)
      .maybeSingle();

    const hasCore =
      Boolean(profile?.full_name?.trim()) && Boolean(profile?.mobile_phone?.trim());
    if (!hasCore) {
      setStudentProfile(null);
      setGate("needs_profile");
      return;
    }

    if (profile?.role === "student" && !profile.face_registered) {
      setStudentProfile(
        profileRowToProfile(profile as Record<string, unknown>, session.user.email ?? null)
      );
      setGate("needs_face");
      return;
    }

    setStudentProfile(null);
    setGate("ready");
  }, [session.user.email, session.user.id]);

  useEffect(() => {
    void refreshProfileGate();
  }, [refreshProfileGate]);

  if (gate === "checking") {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.muted}>Checking your account…</Text>
      </View>
    );
  }

  if (gate === "needs_profile") {
    return (
      <SignupScreen
        variant="oauthProfile"
        session={session}
        onComplete={() => {
          void refreshProfileGate();
        }}
      />
    );
  }

  if (gate === "needs_face" && studentProfile) {
    return (
      <View style={[styles.faceShell, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <View style={styles.faceHeader}>
          <Text style={styles.faceTitle}>Face registration</Text>
          <Pressable
            onPress={() => void getSupabase().auth.signOut()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
        <StudentFaceRegistrationScreen
          profile={studentProfile}
          onRegistered={() => void refreshProfileGate()}
        />
      </View>
    );
  }

  return <HomeScreen session={session} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background,
  },
  muted: { marginTop: 12, fontSize: 15, color: theme.mutedForeground },
  faceShell: { flex: 1 },
  faceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  faceTitle: { fontSize: 18, fontWeight: "700", color: theme.foreground },
  signOut: { fontSize: 15, fontWeight: "600", color: theme.primary },
});
