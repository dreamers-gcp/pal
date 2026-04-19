import Constants from "expo-constants";

export const PASSWORD_RESET_PATH = "reset-password";

function appUrlScheme(): string {
  const s = Constants.expoConfig?.scheme;
  if (typeof s === "string" && s) return s;
  if (Array.isArray(s) && s[0]) return s[0];
  return "thenucleus";
}

/** Supabase `resetPasswordForEmail` redirect; add this exact URL to Supabase → Auth → Redirect URLs. */
export function getPasswordResetRedirectUrl(): string {
  return `${appUrlScheme()}://${PASSWORD_RESET_PATH}`;
}

type RecoveryTokens = { access_token: string; refresh_token: string };

export type PasswordRecoveryPayload =
  /** PKCE (default with `flowType: 'pkce'`): same app must have requested the reset so `code_verifier` is in storage. */
  | { kind: "pkce"; code: string }
  /** Implicit-style fragment (older / server-dependent). */
  | { kind: "implicit"; access_token: string; refresh_token: string };

/** Merge query string and hash fragment into one param map (handles `scheme://path?a=1#b=2`). */
function paramsFromDeepLink(url: string): URLSearchParams {
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  const chunks: string[] = [];
  if (q !== -1) {
    const end = h !== -1 && h > q ? h : url.length;
    chunks.push(url.slice(q + 1, end));
  }
  if (h !== -1) {
    chunks.push(url.slice(h + 1));
  }
  return new URLSearchParams(chunks.join("&"));
}

/**
 * Parses Supabase recovery redirect after the user taps the email link.
 *
 * - **PKCE** (your mail link with `token=pkce_...`): redirect is
 *   `thenucleus://reset-password?code=...` → use `exchangeCodeForSession(code)`.
 * - **Implicit**: `thenucleus://reset-password#access_token=...&refresh_token=...&type=recovery` → `setSession`.
 */
export function parsePasswordRecoveryPayload(url: string): PasswordRecoveryPayload | null {
  if (!looksLikePasswordRecoveryUrl(url)) return null;
  const params = paramsFromDeepLink(url);
  const code = params.get("code");
  if (code) {
    return { kind: "pkce", code };
  }
  if (params.get("type") !== "recovery") return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { kind: "implicit", access_token, refresh_token };
}

/** @deprecated Use parsePasswordRecoveryPayload + branch on kind */
export function parsePasswordRecoveryTokens(url: string): RecoveryTokens | null {
  const p = parsePasswordRecoveryPayload(url);
  if (!p || p.kind !== "implicit") return null;
  return { access_token: p.access_token, refresh_token: p.refresh_token };
}

export function looksLikePasswordRecoveryUrl(url: string): boolean {
  const scheme = appUrlScheme();
  if (!url.toLowerCase().startsWith(`${scheme.toLowerCase()}://`)) return false;
  return url.includes(PASSWORD_RESET_PATH);
}
