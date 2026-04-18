import { getPalApiBaseUrl } from "./config";

function missingBase(): { ok: false; error: string; status: number } {
  return {
    ok: false,
    error:
      "Set EXPO_PUBLIC_PAL_API_URL in mobile/.env to your API base URL (the host where /api/face runs, e.g. your Next.js server).",
    status: 0,
  };
}

type EmbeddingFetchOptions = {
  /** Unauthenticated signup flow — sends `x-signup-flow: 1` (matches web signup). */
  signupFlow?: boolean;
  accessToken?: string;
};

async function postFaceEmbeddingRequest(
  imageUri: string,
  opts: EmbeddingFetchOptions = {}
): Promise<
  { ok: true; embedding: number[] } | { ok: false; error: string; status: number }
> {
  const base = getPalApiBaseUrl();
  if (!base) return missingBase();

  const form = new FormData();
  form.append("file", {
    uri: imageUri,
    name: "face.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  /** RN often drops `Authorization` on multipart requests; API also reads `access_token`. */
  if (opts.accessToken) form.append("access_token", opts.accessToken);

  const headers: Record<string, string> = {};
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  if (opts.signupFlow) headers["x-signup-flow"] = "1";

  try {
    const res = await fetch(`${base}/api/face/embedding`, { method: "POST", body: form, headers });
    const raw = await res.text();
    let data = {} as { embedding?: number[]; error?: string };
    try {
      data = raw ? (JSON.parse(raw) as { embedding?: number[]; error?: string }) : {};
    } catch {
      /* non-JSON error body (proxies, HTML) */
    }
    if (!res.ok) {
      const fromBody =
        data.error ||
        (raw && !raw.trimStart().startsWith("{") ? raw.slice(0, 200).trim() : "");
      const errMsg =
        fromBody ||
        res.statusText ||
        (res.status === 502
          ? "Next.js could not reach the face service. On the computer running Next, set FACE_SERVICE_URL (e.g. http://127.0.0.1:8100) and ensure the Python face API is running."
          : `Embedding request failed (HTTP ${res.status})`);
      return { ok: false, error: errMsg, status: res.status };
    }
    if (!data.embedding || !Array.isArray(data.embedding)) {
      return { ok: false, error: "Invalid embedding response", status: 502 };
    }
    return { ok: true, embedding: data.embedding };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, status: 502 };
  }
}

/** Multipart upload from a local file URI (Expo camera image). */
export async function postFaceEmbedding(
  accessToken: string | undefined,
  imageUri: string
): Promise<
  { ok: true; embedding: number[] } | { ok: false; error: string; status: number }
> {
  return postFaceEmbeddingRequest(imageUri, { accessToken });
}

/** Before account exists: same embedding API as web signup (`x-signup-flow`). */
export function postFaceEmbeddingForSignup(imageUri: string) {
  return postFaceEmbeddingRequest(imageUri, { signupFlow: true });
}

export async function postFaceCompare(
  accessToken: string | undefined,
  imageUri: string,
  studentId: string
): Promise<
  | { ok: true; match: boolean; similarity?: number }
  | { ok: false; error: string; status: number }
> {
  const base = getPalApiBaseUrl();
  if (!base) return missingBase();
  if (!accessToken) {
    return { ok: false, error: "Not signed in.", status: 401 };
  }

  const form = new FormData();
  form.append("file", {
    uri: imageUri,
    name: "face.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  form.append("studentId", studentId);
  form.append("access_token", accessToken);

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const res = await fetch(`${base}/api/face/compare`, { method: "POST", body: form, headers });
    const data = (await res.json().catch(() => ({}))) as {
      match?: boolean;
      similarity?: number;
      error?: string;
    };
    if (!res.ok) {
      const base =
        data.error ||
        res.statusText ||
        (res.status === 502
          ? "Next.js could not reach the face service. Set FACE_SERVICE_URL where Next runs (same machine as local dev: http://127.0.0.1:8100)."
          : "Compare request failed");
      return { ok: false, error: base, status: res.status };
    }
    return { ok: true, match: Boolean(data.match), similarity: data.similarity };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, status: 502 };
  }
}
