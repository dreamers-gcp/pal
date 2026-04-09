import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** Lazy init so a bad .env doesn’t crash the bundle before the config error UI renders. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
