/**
 * Public API for @alfred/embed
 * Provides embed() and embedMany() functions matching @alfred/rag interface
 */

import { EmbedPool } from "./pool";

export { EmbedPool } from "./pool";
export { EmbedProcess } from "./process";
export type {
  EmbedConfig,
  EmbedRequest,
  EmbedResponse,
  ProcessHealth,
} from "./types";

// Embedding dimension for KaLM-Embedding-Gemma3-12B-2511
// Using 1024 dimensions via Matryoshka Representation Learning (MRL)
// Retains 93-95% of full model quality while enabling HNSW indexing
export const EMBEDDING_DIM = 1024;

// Singleton pool instance
let pool: EmbedPool | null = null;

/**
 * Embed a single text and return 3840-dimensional vector
 */
export async function embed(text: string): Promise<number[]> {
  if (!pool) {
    pool = new EmbedPool({
      modelName:
        process.env.EMBED_MODEL ?? "tencent/KaLM-Embedding-Gemma3-12B-2511",
      device: (process.env.EMBED_DEVICE as any) ?? "auto",
      poolSize: Number(process.env.EMBED_POOL_SIZE ?? 2),
    });
    await pool.initialize();
  }

  const embeddings = await pool.embed([text]);
  const embedding = embeddings[0];

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  return embedding;
}

/**
 * Embed multiple texts and return array of 3840-dimensional vectors
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (!pool) {
    pool = new EmbedPool({
      modelName:
        process.env.EMBED_MODEL ?? "tencent/KaLM-Embedding-Gemma3-12B-2511",
      device: (process.env.EMBED_DEVICE as any) ?? "auto",
      poolSize: Number(process.env.EMBED_POOL_SIZE ?? 2),
    });
    await pool.initialize();
  }

  return pool.embed(texts);
}

/**
 * Shutdown the embedding pool (cleanup)
 */
export async function shutdown(): Promise<void> {
  if (pool) {
    await pool.shutdown();
    pool = null;
  }
}

/**
 * Get health status of embedding workers
 */
export function getHealth() {
  if (!pool) {
    return [];
  }
  return pool.getHealth();
}
