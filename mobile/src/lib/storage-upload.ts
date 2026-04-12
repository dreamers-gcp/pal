import * as FileSystemLegacy from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";
import { arrayBufferFromLocalUri } from "./image-uri";
import { getSupabase } from "./supabase";

/** Large photos + slow networks — abort so the UI does not hang indefinitely. */
const UPLOAD_TIMEOUT_MS = 120_000;

function storageObjectUrl(bucket: string, path: string): string {
  return `${getSupabaseUrl()}/storage/v1/object/${bucket}/${path}`;
}

/**
 * Native upload: streams from disk to Supabase. Avoids loading the full JPEG into JS
 * (large base64 decode + fetch(ArrayBuffer) often stalls or fails on RN).
 */
export async function uploadFileUriToStorage(
  bucket: string,
  path: string,
  fileUri: string,
  contentType: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { error: "Not authenticated — cannot upload file." };

  const url = storageObjectUrl(bucket, path);
  try {
    const result = await FileSystemLegacy.uploadAsync(url, fileUri, {
      httpMethod: "POST",
      uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
        "Content-Type": contentType,
        "x-upsert": "false",
      },
    });
    if (result.status >= 200 && result.status < 300) return { error: null };
    const hint = result.body?.trim().slice(0, 400) || "";
    return {
      error: hint || `Storage upload failed (HTTP ${result.status}).`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

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

  const url = storageObjectUrl(bucket, path);
  const body = new Uint8Array(data);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text();
      return { error: bodyText?.trim().slice(0, 400) || `HTTP ${res.status}` };
    }
    return { error: null };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        error:
          "Upload timed out. Try again on a stronger Wi‑Fi or cellular signal, or move closer to the router.",
      };
    }
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Prefer native file upload (fast, reliable). Falls back to in-memory buffer + fetch
 * on web or if the native upload fails.
 */
export async function uploadLocalImageToSupabase(
  bucket: string,
  storagePath: string,
  localUri: string,
  opts?: { base64?: string | null }
): Promise<{ error: string | null }> {
  const contentType = "image/jpeg";

  if (Platform.OS !== "web") {
    const direct = await uploadFileUriToStorage(bucket, storagePath, localUri, contentType);
    if (!direct.error) return direct;
  }

  try {
    const buf = await arrayBufferFromLocalUri(localUri, {
      base64: opts?.base64 ?? undefined,
    });
    return uploadBufferToStorage(bucket, storagePath, buf, contentType);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
