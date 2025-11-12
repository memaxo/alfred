-- Migration 0023: Reasoning indexes for archived/confidence lookups

CREATE INDEX IF NOT EXISTS memory_nodes_archived_idx
  ON memory_nodes ((properties->>'archived'))
  WHERE properties->>'archived' IS NOT NULL;

CREATE INDEX IF NOT EXISTS memory_nodes_confidence_idx
  ON memory_nodes (((properties->>'confidence')::numeric))
  WHERE properties ? 'confidence';
