/** Cosine similarity on normalized embeddings (matches face-service / web). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((acc, v, i) => acc + v * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
  const normB = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
  return dot / (normA * normB + 1e-10);
}

export const FACE_REGISTRATION_MIN_PHOTOS = 3;
export const FACE_REGISTRATION_MAX_PHOTOS = 5;
export const FACE_REGISTRATION_MATCH_THRESHOLD = 0.35;
export const ATTENDANCE_WINDOW_MINUTES = 15;
