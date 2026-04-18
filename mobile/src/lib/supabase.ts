import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

/** Typed loosely until we generate DB types from Supabase (avoids `never` on `.from()`). */
let client: SupabaseClient<any> | null = null;

export function getSupabase(): SupabaseClient<any> {
  if (client) return client;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }
  client = createClient<any>(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Required for signInWithOAuth + exchangeCodeForSession (stores code_verifier in AsyncStorage).
      flowType: "pkce",
    },
  });
  return client;
}
