import Constants from "expo-constants";

/** Dotenv / Metro sometimes leave quotes or spaces — normalize before use. */
function readPublicEnv(key: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return undefined;
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * Set in `.env` (Expo loads `EXPO_PUBLIC_*` at bundler start — restart after edits):
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 * - EXPO_PUBLIC_PAL_API_URL — deployed Next.js origin, no trailing slash
 */
export function getSupabaseUrl(): string {
  const v = readPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
  if (!v) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL. Copy .env.example to .env and set values (no spaces around =)."
    );
  }
  return v.replace(/\/$/, "");
}

export function getSupabaseAnonKey(): string {
  const v = readPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  if (!v) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Check .env — no space after =."
    );
  }
  return v;
}

export function getPalApiBaseUrl(): string {
  const v =
    readPublicEnv("EXPO_PUBLIC_PAL_API_URL") ||
    (Constants.expoConfig?.extra as { palApiUrl?: string } | undefined)?.palApiUrl;
  if (!v) {
    throw new Error(
      "Missing EXPO_PUBLIC_PAL_API_URL — your deployed PAL web app URL (https, no trailing slash)."
    );
  }
  return v.replace(/\/$/, "");
}

/** Returns a user-visible message if env is invalid; otherwise null. */
export function getConfigErrorMessage(): string | null {
  try {
    getSupabaseUrl();
    getSupabaseAnonKey();
    getPalApiBaseUrl();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
