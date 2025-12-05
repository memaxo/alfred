-- Migration 0049: Add access tracking columns for adaptive decay
-- Purpose: Enable frequency-based retention where frequently accessed nodes decay slower
-- Reference: alfred-memory-review.md - "Adaptive decay based on access frequency"
--
-- Formula: effective_half_life = base_half_life × (1 + log(1 + access_count))
-- This means:
-- - access_count=0: half_life = base (normal decay)
-- - access_count=9: half_life = base × 2 (2x slower decay)
-- - access_count=99: half_life = base × 3 (3x slower decay)

-- Add access tracking columns to memory_nodes
ALTER TABLE memory_nodes
ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0;

ALTER TABLE memory_nodes
ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone;

-- Index for finding cold (rarely accessed) nodes for pruning
CREATE INDEX IF NOT EXISTS memory_nodes_access_cold_idx
  ON memory_nodes (last_accessed_at, access_count)
  WHERE access_count < 5;

-- Index for finding hot (frequently accessed) nodes
CREATE INDEX IF NOT EXISTS memory_nodes_access_hot_idx
  ON memory_nodes (access_count DESC, last_accessed_at DESC)
  WHERE access_count >= 10;

-- Comment explaining the columns
COMMENT ON COLUMN memory_nodes.access_count IS
  'Number of times this node has been retrieved. Used for adaptive decay: effective_half_life = base_half_life × (1 + log(1 + access_count))';

COMMENT ON COLUMN memory_nodes.last_accessed_at IS
  'Timestamp of most recent retrieval. Used for cold start detection and pruning decisions.';
