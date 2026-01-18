/**
 * Canonical embedding dimensions for the default KaLM embedding model.
 *
 * Kept in a standalone module to avoid circular imports between `index.ts`
 * and `registry.ts`.
 */

// Embedding dimension for KaLM-Embedding-Gemma3-12B-2511
// Using 1024 dimensions via Matryoshka Representation Learning (MRL)
// Retains 93-95% of full model quality while enabling HNSW indexing
export const EMBEDDING_DIM = 1024;
