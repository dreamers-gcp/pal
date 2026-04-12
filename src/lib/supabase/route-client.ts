import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

function readBearerFromAuthorizationHeader(request: NextRequest): string | null {
  const raw =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  return raw.length > 0 ? raw : null;
}

/**
 * Access token for API routes: `Authorization: Bearer` or multipart field
 * `access_token`. React Native often does not send custom headers on `FormData`
 * uploads; the form field is the reliable fallback.
 */
export function resolveRouteAccessToken(
  request: NextRequest,
  formData: FormData
): string | null {
  const fromHeader = readBearerFromAuthorizationHeader(request);
  if (fromHeader) return fromHeader;
  const v = formData.get("access_token");
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Supabase client for Route Handlers: Bearer JWT (mobile / API) or cookies (web).
 */
export async function createSupabaseForRoute(
  accessToken: string | null
): Promise<SupabaseClient> {
  if (accessToken) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* Server Component / read-only cookie context */
          }
        },
      },
    }
  );
}

/**
 * Resolves the signed-in user. When `accessToken` is set, uses `getUser(jwt)` so
 * the JWT is validated without an in-memory session (required for native apps).
 */
export async function getRouteAuthUser(
  supabase: SupabaseClient,
  accessToken: string | null
) {
  if (accessToken) {
    return supabase.auth.getUser(accessToken);
  }
  return supabase.auth.getUser();
}
