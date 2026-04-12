import { File as ExpoFsFile } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";

const MIN_JPEG_BYTES = 400;

export type BlobFromUriOptions = {
  /** From `takePictureAsync({ base64: true })` — avoids flaky disk reads on many RN builds. */
  base64?: string | null;
};

export type ArrayBufferFromUriOptions = BlobFromUriOptions;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const globalAtob = globalThis.atob;
  if (typeof globalAtob !== "function") {
    throw new Error("Base64 decode is not available on this runtime.");
  }
  const binary = globalAtob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const globalAtob = globalThis.atob;
  if (typeof globalAtob !== "function") {
    throw new Error("Base64 decode is not available on this runtime.");
  }
  const binary = globalAtob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function tryBlobFromInlineBase64(b64: string | null | undefined): Blob | null {
  const trimmed = b64?.trim();
  if (!trimmed || trimmed.length < 80) return null;
  try {
    const blob = base64ToBlob(trimmed, "image/jpeg");
    if (blob.size < MIN_JPEG_BYTES) {
      console.warn("Base64 blob too small:", blob.size, "bytes");
      return null;
    }
    console.log("Successfully created blob from base64:", blob.size, "bytes");
    return blob;
  } catch (e) {
    console.error("Failed to convert base64 to blob:", e);
    return null;
  }
}

function tryBlobFromDataUri(uri: string): Blob | null {
  if (!uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const meta = uri.slice(5, comma);
  if (!/;base64/i.test(meta)) return null;
  return tryBlobFromInlineBase64(uri.slice(comma + 1));
}

async function blobFromLocalUriLegacy(uri: string): Promise<Blob> {
  const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });
  const blob = tryBlobFromInlineBase64(base64);
  if (blob) return blob;
  throw new Error("Could not read image data from this device.");
}

/**
 * Load a local camera/cache URI into an ArrayBuffer for Supabase Storage uploads.
 * Prefer this over blobFromLocalUri — React Native's Blob polyfill sends empty bytes
 * over XHR/fetch even when blob.size appears correct. ArrayBuffer serializes correctly.
 */
export async function arrayBufferFromLocalUri(
  uri: string,
  options?: ArrayBufferFromUriOptions
): Promise<ArrayBuffer> {
  const b64 = options?.base64?.trim();
  if (b64 && b64.length >= 80) {
    try {
      const buf = base64ToArrayBuffer(b64);
      if (buf.byteLength >= MIN_JPEG_BYTES) {
        console.log("arrayBufferFromLocalUri: loaded from base64 option", buf.byteLength, "bytes");
        return buf;
      }
    } catch (e) {
      console.warn("arrayBufferFromLocalUri: base64 decode failed", e);
    }
  }

  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    if (comma >= 0 && /;base64/i.test(uri.slice(5, comma))) {
      try {
        const buf = base64ToArrayBuffer(uri.slice(comma + 1));
        if (buf.byteLength >= MIN_JPEG_BYTES) return buf;
      } catch (_) { /* fall through */ }
    }
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Could not load image (${res.status}).`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < MIN_JPEG_BYTES) throw new Error("Image file is empty or too small.");
    console.log("arrayBufferFromLocalUri: loaded from HTTP URL", buf.byteLength, "bytes");
    return buf;
  }

  try {
    const file = new ExpoFsFile(uri);
    const bytes = await file.bytes();
    if (bytes.byteLength >= MIN_JPEG_BYTES) {
      console.log("arrayBufferFromLocalUri: loaded from ExpoFsFile", bytes.byteLength, "bytes");
      return bytes.buffer as ArrayBuffer;
    }
  } catch (e) {
    console.warn("arrayBufferFromLocalUri: ExpoFsFile failed", e);
  }

  try {
    const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    const buf = base64ToArrayBuffer(base64);
    if (buf.byteLength >= MIN_JPEG_BYTES) {
      console.log("arrayBufferFromLocalUri: loaded from legacy FS", buf.byteLength, "bytes");
      return buf;
    }
  } catch (e) {
    console.warn("arrayBufferFromLocalUri: legacy FS failed", e);
  }

  try {
    const res = await fetch(uri);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength >= MIN_JPEG_BYTES) {
        console.log("arrayBufferFromLocalUri: loaded from fetch fallback", buf.byteLength, "bytes");
        return buf;
      }
    }
  } catch (e) {
    console.warn("arrayBufferFromLocalUri: fetch fallback failed", e);
  }

  throw new Error("Could not read image data from this device.");
}

/**
 * Load a local camera/cache URI into a Blob for Supabase Storage.
 * Prefer `options.base64` from `takePictureAsync({ base64: true })` when available.
 * Avoid relying on `fetch(file://...)` alone — it often returns an empty body in React Native.
 */
export async function blobFromLocalUri(
  uri: string,
  options?: BlobFromUriOptions
): Promise<Blob> {
  console.log("blobFromLocalUri: attempting to load", { uri, hasBase64: !!options?.base64 });
  
  const fromOpt = tryBlobFromInlineBase64(options?.base64 ?? undefined);
  if (fromOpt) {
    console.log("blobFromLocalUri: successfully loaded from base64 option");
    return fromOpt;
  }

  const fromData = tryBlobFromDataUri(uri);
  if (fromData) {
    console.log("blobFromLocalUri: successfully loaded from data URI");
    return fromData;
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Could not load image (${res.status}).`);
    }
    const blob = await res.blob();
    if (blob.size < MIN_JPEG_BYTES) {
      throw new Error("Image file is empty or too small.");
    }
    console.log("blobFromLocalUri: successfully loaded from HTTP URL");
    return blob;
  }

  try {
    const file = new ExpoFsFile(uri);
    const bytes = await file.bytes();
    if (bytes.byteLength >= MIN_JPEG_BYTES) {
      console.log("blobFromLocalUri: successfully loaded from ExpoFsFile", bytes.byteLength);
      return new Blob([bytes], { type: "image/jpeg" });
    }
    console.warn("blobFromLocalUri: ExpoFsFile blob too small", bytes.byteLength);
  } catch (e) {
    console.warn("blobFromLocalUri: ExpoFsFile failed", e);
    /* try other strategies */
  }

  try {
    const blob = await blobFromLocalUriLegacy(uri);
    console.log("blobFromLocalUri: successfully loaded from legacy method");
    return blob;
  } catch (e) {
    console.warn("blobFromLocalUri: legacy method failed", e);
    /* last resort */
  }

  try {
    const res = await fetch(uri);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size >= MIN_JPEG_BYTES) {
        console.log("blobFromLocalUri: successfully loaded from fetch fallback");
        return blob;
      }
      console.warn("blobFromLocalUri: fetch blob too small", blob.size);
    }
  } catch (e) {
    console.warn("blobFromLocalUri: fetch fallback failed", e);
  }

  throw new Error("Could not read image data from this device.");
}
