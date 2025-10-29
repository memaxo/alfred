-- Migration 0016: Graph traversal indexes
-- Aligns graph queries with repository access patterns.

CREATE INDEX IF NOT EXISTS memory_nodes_kind_idx ON memory_nodes(kind);
CREATE INDEX IF NOT EXISTS memory_edges_from_id_kind_idx ON memory_edges(from_id, kind);
CREATE INDEX IF NOT EXISTS memory_edges_to_id_kind_idx ON memory_edges(to_id, kind);
CREATE INDEX IF NOT EXISTS memory_edges_created_idx ON memory_edges(created_at);
