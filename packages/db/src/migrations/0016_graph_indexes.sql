-- Migration 0016: Graph traversal indexes
-- Aligns graph queries with repository access patterns.

CREATE INDEX IF NOT EXISTS memory_nodes_kind_created_idx
  ON memory_nodes (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_edges_from_kind_created_idx
  ON memory_edges (from_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_edges_to_kind_created_idx
  ON memory_edges (to_id, kind, created_at DESC);
