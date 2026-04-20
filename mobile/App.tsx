import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import {
  getPalApiBaseUrl,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "./src/lib/config";
import {
  looksLikePasswordRecoveryUrl,
  parsePasswordRecoveryPayload,
} from "./src/lib/auth-deep-link";
import { getSupabase } from "./src/lib/supabase";
import { AuthenticatedRoot } from "./src/screens/AuthenticatedRoot";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
import { SignupScreen, SignupSuccessScreen } from "./src/screens/SignupScreen";
import { theme } from "./src/theme";

type AuthGate = "login" | "signup" | "forgotPassword" | { kind: "signupSuccess"; email: string };

/** iOS only fetches SSID/BSSID when this is set at startup (see NetInfo README). */
if (Platform.OS === "ios" || Platform.OS === "android") {
  NetInfo.configure({ shouldFetchWiFiSSID: true });
}

async function applyPasswordRecoveryDeepLink(
  supabase: ReturnType<typeof getSupabase>,
  url: string
): Promise<boolean> {
  if (!looksLikePasswordRecoveryUrl(url)) return false;
  const payload = parsePasswordRecoveryPayload(url);
  if (!payload) return false;
  if (payload.kind === "pkce") {
    const { error } = await supabase.auth.exchangeCodeForSession(payload.code);
    return !error;
  }
  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  return !error;
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
  /** After email recovery deep link: show native new-password UI before main app. */
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    if (prevSessionRef.current && !session) {
      setAuthGate("login");
      setPasswordRecoveryActive(false);
    }
    prevSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!configured) {
      setBooting(false);
      return;
    }
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && looksLikePasswordRecoveryUrl(initialUrl)) {
        const ok = await applyPasswordRecoveryDeepLink(supabase, initialUrl);
        if (!cancelled && ok) {
          setPasswordRecoveryActive(true);
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(data.session ?? null);
        setBooting(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryActive(true);
      }
    });

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void (async () => {
        if (!looksLikePasswordRecoveryUrl(url)) return;
        const ok = await applyPasswordRecoveryDeepLink(supabase, url);
        if (ok) setPasswordRecoveryActive(true);
      })();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, [configured]);

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.configTitle}>Configure The Nucleus mobile</Text>
        {__DEV__ ? (
          <>
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
          </>
        ) : (
          <>
            <Text style={styles.configBody}>
              This install was built without Supabase settings. Those values are not read from a file
              on your phone—they must be set as EAS environment variables when the app is built, then
              a new release must be uploaded to the Play Store.
            </Text>
            <Text style={styles.configMono}>
              Supabase URL: {getSupabaseUrl() ? "set" : "missing"}
              {"\n"}
              Anon key: {getSupabaseAnonKey() ? "set" : "missing"}
              {"\n"}
              Web app URL: {getPalApiBaseUrl() || "(optional — needed for signup / dashboard links)"}
            </Text>
            <Text style={styles.configHint}>
              Developer: see “Play Store / EAS Build” in mobile/README.md — set EXPO_PUBLIC_* secrets and
              run eas build again.
            </Text>
          </>
        )}
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
    if (passwordRecoveryActive) {
      return (
        <>
          <ResetPasswordScreen
            session={session}
            onComplete={() => setPasswordRecoveryActive(false)}
          />
          <StatusBar style="dark" />
        </>
      );
    }
    return (
      <>
        <AuthenticatedRoot session={session} />
        <StatusBar style="dark" />
      </>
    );
  }

  if (authGate === "forgotPassword") {
    return (
      <>
        <ForgotPasswordScreen onBackToLogin={() => setAuthGate("login")} />
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
      <LoginScreen
        onGoSignup={() => setAuthGate("signup")}
        onForgotPassword={() => setAuthGate("forgotPassword")}
      />
      <StatusBar style="dark" />
    </>
  );
}
