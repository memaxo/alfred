-- Migration 0018: RAG tsvector + HNSW tuning
-- Add full-text search index and optimize HNSW parameters

-- Drop existing HNSW index to recreate with tuned parameters
DROP INDEX IF EXISTS rag_chunks_embedding_hnsw;

-- Recreate HNSW index with optimized parameters for 1M+ documents
-- m=16: balance between recall and build time
-- ef_construction=64: higher quality index at build time
CREATE INDEX rag_chunks_embedding_hnsw
  ON rag_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add tsvector column for full-text search (sparse/hybrid search)
ALTER TABLE rag_chunks
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS rag_chunks_content_gin
  ON rag_chunks
  USING gin (content_tsvector);

-- Add composite index for document_id + order (common query pattern)
CREATE INDEX IF NOT EXISTS rag_chunks_document_order_idx
  ON rag_chunks (document_id, "order");

