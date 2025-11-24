-- Migration 0040: User schema performance indexes
-- Adds preference uniqueness enforcement, fact embeddings, and query accelerators

-- Index for preference lookups (user + key)
ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_key_idx 
  ON user_preferences(user_id, key);

-- HNSW vector index for facts embeddings (only on populated rows)
DROP INDEX IF EXISTS user_facts_embedding_hnsw;
CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw_idx
  ON user_facts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 100)
  WHERE embedding IS NOT NULL;

-- Index for timestamp-based fact queries (ordering by newest first)
CREATE INDEX IF NOT EXISTS user_facts_user_created_idx 
  ON user_facts(user_id, created_at DESC);

-- Index for fact category filtering
CREATE INDEX IF NOT EXISTS user_facts_user_category_idx 
  ON user_facts(user_id, category);
