/**
 * Set these in `mobile/.env` (no spaces around `=`, no quotes on values).
 * Expo inlines EXPO_PUBLIC_* at bundle time.
 *
 * **PAL API (Next.js):** In __DEV__, if `EXPO_PUBLIC_PAL_API_URL` is unset, or is
 * `localhost` / `127.0.0.1` (wrong on a physical device), we infer your dev machine
 * from Expo (`hostUri` / Metro `scriptURL`) so `/api/face/*` matches the web app.
 * Production builds should set `EXPO_PUBLIC_PAL_API_URL` to your deployed site.
 * With `expo start --tunnel`, Metro may use a tunnel host; set `EXPO_PUBLIC_PAL_API_URL`
 * to a URL where your Next app is reachable (e.g. ngrok).
 */
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

export function getSupabaseUrl(): string {
  return (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabaseAnonKey(): string {
  return (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

function palApiDevPort(): string {
  return (process.env.EXPO_PUBLIC_PAL_API_DEV_PORT ?? "3000").trim() || "3000";
}

function isTunnelishHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("exp.direct") ||
    h.includes("ngrok") ||
    h.includes("loca.lt") ||
    h.includes("trycloudflare.com")
  );
}

function isExplicitLoopback(url: string): boolean {
  try {
    const withProto = url.includes("://") ? url : `http://${url}`;
    const u = new URL(withProto);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

/**
 * Base URL for the Next app (face API, web links). Only used in __DEV__ when env is missing
 * or misleading (localhost on device).
 */
function inferDevPalApiBaseUrl(): string | null {
  if (!__DEV__) return null;

  const port = palApiDevPort();
  const scriptURL = (NativeModules.SourceCode?.scriptURL as string) ?? "";
  const packagerHost = scriptURL.match(/^(?:https?:|file:)?\/\/([^/:]+)/)?.[1] ?? null;

  const hostUriRaw = Constants.expoConfig?.hostUri ?? null;
  const hostFromUri = hostUriRaw?.includes(":") ? hostUriRaw.split(":")[0] : hostUriRaw;

  const candidate = hostFromUri || packagerHost;

  if (!candidate) {
    return Platform.OS === "android"
      ? `http://10.0.2.2:${port}`
      : `http://127.0.0.1:${port}`;
  }

  if (isTunnelishHost(candidate)) {
    return null;
  }

  const h = candidate.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") {
    return Platform.OS === "android"
      ? `http://10.0.2.2:${port}`
      : `http://127.0.0.1:${port}`;
  }

  return `http://${candidate}:${port}`;
}

/** Deployed or local Next app URL (no trailing slash). */
export function getPalApiBaseUrl(): string {
  const inferred = inferDevPalApiBaseUrl();
  let explicit = (process.env.EXPO_PUBLIC_PAL_API_URL ?? "").trim().replace(/\/$/, "");

  if (explicit && __DEV__ && isExplicitLoopback(explicit)) {
    if (inferred) return inferred;
    return "";
  }

  if (explicit) return explicit;
  return inferred ?? "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
