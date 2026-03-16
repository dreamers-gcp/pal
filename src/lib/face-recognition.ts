/**
 * Face Recognition Utilities
 * 
 * Note: Face embedding extraction happens on the FRONTEND (client-side)
 * The backend only stores and compares embeddings using cosine similarity
 */

/**
 * Calculate cosine similarity between two embeddings
 * Returns a score between 0 and 1
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Generate a random embedding for testing
 * Should only be used for development/testing, never in production
 */
export function generateRandomEmbedding(): number[] {
  return Array(128).fill(0).map(() => Math.random() * 2 - 1);
}
