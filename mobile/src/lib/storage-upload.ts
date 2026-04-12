import { getSupabaseAnonKey, getSupabaseUrl } from "./config";
import { getSupabase } from "./supabase";

/**
 * Upload an ArrayBuffer to Supabase Storage via the REST API directly.
 *
 * The @supabase/storage-js client in React Native explicitly rejects ArrayBuffer /
 * ArrayBufferView bodies — so we bypass it and POST to the Storage REST endpoint
 * ourselves, attaching the session token as a Bearer header.
 */
export async function uploadBufferToStorage(
  bucket: string,
  path: string,
  data: ArrayBuffer,
  contentType: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { error: "Not authenticated — cannot upload file." };

  const url = `${getSupabaseUrl()}/storage/v1/object/${bucket}/${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: data,
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: body || `HTTP ${res.status}` };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
