-- Migration 0086: Add Embedding Model Tracking to Vector Tables
-- Purpose: Track which model generated each embedding for graceful migration
-- Reference: Qwen3-VL-Embedding migration plan

-- Add embedding_model_id to rag_chunks
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;

-- Add embedding_model_id to user_facts
ALTER TABLE user_facts ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;

-- Add embedding_model_id to memory_nodes
ALTER TABLE memory_nodes ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;

-- Backfill existing embeddings with KaLM model ID
-- These are safe to run multiple times (idempotent)
UPDATE rag_chunks 
SET embedding_model_id = 'kalm-12b-1024' 
WHERE embedding IS NOT NULL AND embedding_model_id IS NULL;

UPDATE user_facts 
SET embedding_model_id = 'kalm-12b-1024' 
WHERE embedding IS NOT NULL AND embedding_model_id IS NULL;

UPDATE memory_nodes 
SET embedding_model_id = 'kalm-12b-1024' 
WHERE embedding IS NOT NULL AND embedding_model_id IS NULL;

-- Index for finding stale embeddings (those not matching current default)
-- This supports the re-embedding worker querying for chunks to process
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_model_idx
  ON rag_chunks (embedding_model_id)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_facts_embedding_model_idx
  ON user_facts (embedding_model_id)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS memory_nodes_embedding_model_idx
  ON memory_nodes (embedding_model_id)
  WHERE embedding IS NOT NULL;

-- Partial indexes for finding stale embeddings during migration
-- These help the re-embedding worker efficiently find records to process
CREATE INDEX IF NOT EXISTS rag_chunks_stale_embedding_idx
  ON rag_chunks (id)
  WHERE embedding IS NOT NULL AND (embedding_model_id IS NULL OR embedding_model_id != 'qwen3-vl-2b-1024');

CREATE INDEX IF NOT EXISTS user_facts_stale_embedding_idx
  ON user_facts (id)
  WHERE embedding IS NOT NULL AND (embedding_model_id IS NULL OR embedding_model_id != 'qwen3-vl-2b-1024');

CREATE INDEX IF NOT EXISTS memory_nodes_stale_embedding_idx
  ON memory_nodes (id)
  WHERE embedding IS NOT NULL AND (embedding_model_id IS NULL OR embedding_model_id != 'qwen3-vl-2b-1024');

COMMENT ON COLUMN rag_chunks.embedding_model_id IS 'ID of the model that generated this embedding (FK to embedding_models.id)';
COMMENT ON COLUMN user_facts.embedding_model_id IS 'ID of the model that generated this embedding (FK to embedding_models.id)';
COMMENT ON COLUMN memory_nodes.embedding_model_id IS 'ID of the model that generated this embedding (FK to embedding_models.id)';
