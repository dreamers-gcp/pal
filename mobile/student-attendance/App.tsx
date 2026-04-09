import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { getConfigErrorMessage } from "./src/lib/config";
import { getSupabase } from "./src/lib/supabase";
import type { Profile } from "./src/lib/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AttendanceScreen } from "./src/screens/AttendanceScreen";

export default function App() {
  const configError = getConfigErrorMessage();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (configError) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, [configError]);

  useEffect(() => {
    if (configError) {
      setLoading(false);
      return;
    }
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getSupabase()
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProfile(null);
        } else {
          setProfile(data as Profile);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, configError]);

  if (configError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Configuration error</Text>
        <Text style={styles.body}>{configError}</Text>
        <Text style={[styles.body, { marginTop: 12 }]}>
          Fix `mobile/student-attendance/.env`: no spaces around `=`, no quotes on
          values, then run `npx expo start -c`.
        </Text>
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

  if (!session || !profile) {
    return <LoginScreen />;
  }

  if (profile.role !== "student") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Students only</Text>
        <Text style={styles.body}>
          This app is for student attendance. Sign in with a student account on the web
          dashboard.
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => void getSupabase().auth.signOut()}
        >
          <Text style={styles.btnText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <AttendanceScreen
      profile={profile}
      onSignOut={() => void getSupabase().auth.signOut()}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fafafa",
  },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  body: { fontSize: 15, color: "#666", textAlign: "center", lineHeight: 22 },
  btn: {
    marginTop: 20,
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
