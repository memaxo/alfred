-- Migration 0029: Index for rag_documents.source deduplication
-- Enables fast lookups when checking if a document already exists

CREATE INDEX IF NOT EXISTS rag_documents_source_idx 
  ON rag_documents(source);

