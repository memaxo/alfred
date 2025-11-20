-- Migration 0031: force rag_chunks embeddings to 1024 dimensions and null legacy vectors
-- Context:
-- - Migration 0024 attempted to shrink embeddings from 1536 to 1024 dimensions
-- - It relied on Postgres silently nulling values during ALTER TYPE, which does not happen
-- - This follow-up guarantees the rewrite succeeds on non-empty tables by explicitly nulling legacy vectors
-- - Downstream embedding workers must repopulate rag_chunks.embedding after this migration runs

-- Always drop the HNSW index before touching the column so Postgres can rewrite quickly
DROP INDEX IF EXISTS rag_chunks_embedding_hnsw;

-- Rewrite the column with an explicit USING clause so every legacy value becomes NULL::vector(1024)
ALTER TABLE rag_chunks
  ALTER COLUMN embedding TYPE vector(1024)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE NULL::vector(1024)
  END;

-- Keep the column documentation accurate
COMMENT ON COLUMN rag_chunks.embedding IS
  'KaLM-Embedding-Gemma3-12B-2511 embeddings (1024 dimensions via MRL truncation, local model). Existing rows are nulled on dimension changes.';

-- Recreate the HNSW index with the production parameters; IF NOT EXISTS keeps the migration idempotent
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw
  ON rag_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 100);
