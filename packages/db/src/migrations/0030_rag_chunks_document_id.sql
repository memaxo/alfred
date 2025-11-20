-- Migration 0030: Index for rag_chunks.document_id queries
-- Optimizes queries that filter only by document_id (without order)
-- Note: Composite index (document_id, order) exists but single-column index is more efficient for document_id-only queries

CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx 
  ON rag_chunks(document_id);

