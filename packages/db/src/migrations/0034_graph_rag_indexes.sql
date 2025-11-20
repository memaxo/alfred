-- Migration 0034: Graph + RAG index hardening
-- Goals:
--   * Enforce rag_documents source uniqueness for single-user deduplication
--   * Add label full-text search vector + GIN index for memory_nodes
--   * Add resource-scoped edge indexes to accelerate tenant-filtered traversals

-- 1) Deduplicate rag_documents.source before creating unique index
WITH duplicate_sources AS (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY source
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
           ) AS rn
    FROM rag_documents
    WHERE source IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
)
DELETE FROM rag_documents
WHERE id IN (SELECT id FROM duplicate_sources);

-- 2) Unique index on source (excluding NULLs to keep ingestion flexibility)
CREATE UNIQUE INDEX IF NOT EXISTS rag_documents_source_unique
  ON rag_documents (source)
  WHERE source IS NOT NULL;

-- 3) Label tsvector for memory_nodes + GIN index for search
ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS label_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(label, ''))) STORED;

CREATE INDEX IF NOT EXISTS memory_nodes_label_gin
  ON memory_nodes
  USING gin (label_tsvector);

-- 4) Resource-scoped edge indexes for inbound/outbound queries
CREATE INDEX IF NOT EXISTS memory_edges_resource_from_kind_created_idx
  ON memory_edges (resource, from_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_edges_resource_to_kind_created_idx
  ON memory_edges (resource, to_id, kind, created_at DESC);
