/**
 * Shared Embedding Utilities for Memory Tools
 *
 * Provides on-the-fly embedding generation for semantic search queries.
 */

import { embedMany } from "@alfred/rag";

/**
 * Embed a single query string for semantic search.
 *
 * @param query - Natural language query to embed
 * @returns Embedding vector
 */
export async function embedQuery(query: string): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    throw new Error("memory_query_empty");
  }

  const embeddings = await embedMany([query.trim()]);
  const embedding = embeddings[0];

  if (!embedding || embedding.length === 0) {
    throw new Error("memory_embedding_failed");
  }

  return embedding;
}

/**
 * Embed multiple texts for batch operations.
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return Promise.resolve([]);
  }

  const cleaned = texts.map((t) => t.trim()).filter((t) => t.length > 0);

  if (cleaned.length === 0) {
    return Promise.resolve([]);
  }

  return embedMany(cleaned);
}

/**
 * Normalize an embedding from various storage formats.
 */
export function normalizeEmbedding(value: unknown): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const nums = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
    return nums.length > 0 ? nums : null;
  }

  if (value instanceof Uint8Array) {
    if (value.byteLength % 4 !== 0) {
      return null;
    }
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    const result: number[] = [];
    for (let offset = 0; offset < view.byteLength; offset += 4) {
      result.push(view.getFloat32(offset, true));
    }
    return result.length > 0 ? result : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const nums = parsed
          .map((entry) => Number(entry))
          .filter((entry) => Number.isFinite(entry));
        return nums.length > 0 ? nums : null;
      }
    } catch {
      return null;
    }
  }

  return null;
}
