-- Graph traversal performance indexes for memory_edges

CREATE INDEX IF NOT EXISTS memory_edges_from_kind_idx
  ON memory_edges (from_id, kind);

CREATE INDEX IF NOT EXISTS memory_edges_to_kind_idx
  ON memory_edges (to_id, kind);

CREATE INDEX IF NOT EXISTS memory_edges_kind_idx
  ON memory_edges (kind);

CREATE INDEX IF NOT EXISTS memory_edges_from_kind_resource_idx
  ON memory_edges (from_id, kind, resource);

CREATE INDEX IF NOT EXISTS memory_edges_to_kind_resource_idx
  ON memory_edges (to_id, kind, resource);
