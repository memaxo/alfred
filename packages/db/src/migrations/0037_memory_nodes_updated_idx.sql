-- Migration 0037: Add index on memory_nodes(updated_at) for decay performance
-- Motivation:
-- - The Learning Worker queries nodes by updated_at to find decay candidates
-- - Without this index, decay checks perform full table scans

CREATE INDEX IF NOT EXISTS memory_nodes_updated_idx
  ON memory_nodes (updated_at ASC);
