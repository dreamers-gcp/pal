import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import {
  getPalApiBaseUrl,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "./src/lib/config";
import { getSupabase } from "./src/lib/supabase";
import { AuthenticatedRoot } from "./src/screens/AuthenticatedRoot";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen, SignupSuccessScreen } from "./src/screens/SignupScreen";
import { theme } from "./src/theme";

type AuthGate = "login" | "signup" | { kind: "signupSuccess"; email: string };

/** iOS only fetches SSID/BSSID when this is set at startup (see NetInfo README). */
if (Platform.OS === "ios" || Platform.OS === "android") {
  NetInfo.configure({ shouldFetchWiFiSSID: true });
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: "center",
    padding: 24,
  },
  configTitle: { fontSize: 20, fontWeight: "700", color: theme.foreground },
  configBody: { marginTop: 12, fontSize: 15, lineHeight: 22, color: theme.mutedForeground },
  configMono: {
    marginTop: 16,
    fontSize: 13,
    color: theme.foreground,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  configHint: { marginTop: 20, fontSize: 14, color: theme.primary, fontWeight: "500" },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [authGate, setAuthGate] = useState<AuthGate>("login");
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    if (prevSessionRef.current && !session) {
      setAuthGate("login");
    }
    prevSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!configured) {
      setBooting(false);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.configTitle}>Configure The Nucleus mobile</Text>
        <Text style={styles.configBody}>
          Copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY (same project as the web app). Optionally set
          EXPO_PUBLIC_PAL_API_URL for links to sign up and the dashboard.
        </Text>
        <Text style={styles.configMono}>
          Supabase: {getSupabaseUrl() ? "set" : "missing"}
          {"\n"}
          Anon key: {getSupabaseAnonKey() ? "set" : "missing"}
          {"\n"}
          Web app URL: {getPalApiBaseUrl() || "(optional)"}
        </Text>
        <Text style={styles.configHint}>Restart with: npx expo start -c</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (session) {
    return (
      <>
        <AuthenticatedRoot session={session} />
        <StatusBar style="dark" />
      </>
    );
  }

  if (authGate === "signup") {
    return (
      <>
        <SignupScreen
          variant="email"
          onGoLogin={() => setAuthGate("login")}
          onSignupSuccessNoSession={(email) => setAuthGate({ kind: "signupSuccess", email })}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (typeof authGate === "object" && authGate.kind === "signupSuccess") {
    return (
      <>
        <SignupSuccessScreen email={authGate.email} onGoLogin={() => setAuthGate("login")} />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <>
      <LoginScreen onGoSignup={() => setAuthGate("signup")} />
      <StatusBar style="dark" />
    </>
  );
}
