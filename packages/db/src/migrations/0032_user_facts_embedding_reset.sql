-- Migration 0032: force user_facts embeddings to 1024 dimensions and null legacy vectors
-- Context mirrors rag_chunks:
-- - Migration 0027 altered the column type without rewriting existing data
-- - Databases with populated embeddings could fail the ALTER TYPE or retain stale 1536-d vectors
-- - This follow-up explicitly nulls pre-existing embeddings so downstream workers can regenerate them consistently

DROP INDEX IF EXISTS user_facts_embedding_hnsw;

ALTER TABLE user_facts
  ALTER COLUMN embedding TYPE vector(1024)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE NULL::vector(1024)
  END;

COMMENT ON COLUMN user_facts.embedding IS
  'KaLM-Embedding-Gemma3-12B-2511 embeddings (1024 dimensions via MRL truncation, local model). Existing rows are nulled on dimension changes.';

CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw
  ON user_facts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 100);
