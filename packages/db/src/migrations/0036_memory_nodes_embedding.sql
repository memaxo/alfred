-- Migration 0036: Add vector embeddings to memory_nodes for entity linking
-- Goals:
--   * Add embedding column (vector(1024)) to memory_nodes
--   * Add HNSW index for fast similarity search

ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS memory_nodes_embedding_idx
  ON memory_nodes
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
