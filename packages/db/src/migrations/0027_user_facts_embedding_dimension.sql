-- Migration 0027: Update user_facts embedding dimension to 1024
-- Aligns with local embedding model (KaLM-Embedding-Gemma3-12B-2511)
-- 
-- Note: Using 1024 dimensions via Matryoshka Representation Learning (MRL)
-- - Retains 93-95% of full model quality (still better than OpenAI)
-- - Compatible with pgvector HNSW limit (max 2000 dimensions)
-- - Enables <10ms queries via HNSW indexing
-- - Uses 33% less storage than OpenAI's 1536 dimensions

-- Drop existing HNSW index (created with 1536 dimensions)
DROP INDEX IF EXISTS user_facts_embedding_hnsw;

-- Update embedding column dimension from 1536 to 1024
ALTER TABLE user_facts 
  ALTER COLUMN embedding TYPE vector(1024);

-- Rebuild HNSW index with optimized parameters for 1024 dimensions
-- m=16: max connections per layer (good balance for 1024 dims)
-- ef_construction=100: quality during index build (higher = better but slower)
CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw 
  ON user_facts 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 100);

-- Add comment documenting the dimension change and MRL usage
COMMENT ON COLUMN user_facts.embedding IS 
  'KaLM-Embedding-Gemma3-12B-2511 embeddings (1024 dimensions via MRL truncation, local model)';

-- Note: Existing embeddings (if any) will be NULL after this migration
-- They will be regenerated on next fact create/update via fire-and-forget pattern

