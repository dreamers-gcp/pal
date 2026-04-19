import type { SupabaseClient } from "@supabase/supabase-js";
import * as QueryParams from "expo-auth-session/build/QueryParams";

export type GoogleOAuthResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

/**
 * Deep link used after Google OAuth. Must be listed in Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs (add this exact string).
 * Matches `scheme` in `app.config.ts` (not the same as iOS bundle id / Android package).
 */
export function getGoogleOAuthRedirectUri(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { makeRedirectUri } = require("expo-auth-session");
  return makeRedirectUri({
    scheme: "thenucleus",
    path: "auth/callback",
  });
}

/**
 * Same provider flow as web (`signInWithOAuth` + PKCE): opens the system browser,
 * returns to the app via the custom URL scheme, then exchanges the code for a session.
 *
 * All native module imports are lazy so the app doesn't crash on builds that
 * haven't linked `expo-web-browser` / `expo-auth-session` yet.
 */
export async function signInWithGoogleOAuth(
  supabase: SupabaseClient<any>
): Promise<GoogleOAuthResult> {
  let WebBrowser: typeof import("expo-web-browser");
  try {
    WebBrowser = require("expo-web-browser");
  } catch {
    return {
      ok: false,
      error:
        "Google sign-in requires a native rebuild. Run: npx expo prebuild --clean && npx expo run:ios (or run:android).",
    };
  }

  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // non-critical if it fails here
  }

  const redirectTo = getGoogleOAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.url) {
    return { ok: false, error: "Could not start Google sign-in." };
  }

  const browser = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (browser.type === "cancel") {
    return { ok: false, cancelled: true };
  }
  if (browser.type !== "success" || !("url" in browser) || !browser.url) {
    const msg =
      browser.type === "dismiss"
        ? "Sign-in was dismissed."
        : "Google sign-in did not complete.";
    return { ok: false, error: msg };
  }

  const { params, errorCode } = QueryParams.getQueryParams(browser.url);
  if (errorCode) {
    return { ok: false, error: String(errorCode) };
  }

  const code = params.code;
  if (code) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      return { ok: false, error: exchangeErr.message };
    }
    return { ok: true };
  }

  const access = params.access_token;
  const refresh = params.refresh_token;
  if (access && refresh) {
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessErr) {
      return { ok: false, error: sessErr.message };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error: "Google sign-in did not return a session. Check redirect URL matches Supabase settings.",
  };
}
