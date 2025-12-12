-- Migration 0051: Add bi-temporal columns to memory_edges
-- Purpose: Enable non-destructive updates using Zep-style bi-temporal model
-- Reference: alfred-memory-review.md - "Bi-temporal edges for non-lossy updates"
--
-- Bi-temporal model tracks two time dimensions:
-- 1. Transaction time (created_at): When we learned about the edge
-- 2. Valid time (valid_from, valid_to): When the edge is valid in the real world
--
-- This enables:
-- - Non-destructive updates: Set valid_to instead of deleting
-- - Historical queries: "What did the graph look like at time X?"
-- - Future validity: "This relationship starts next week"
-- - Audit trail: Full history of all changes

-- Add bi-temporal validity columns
ALTER TABLE memory_edges
ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone;

ALTER TABLE memory_edges
ADD COLUMN IF NOT EXISTS valid_to timestamp with time zone;

-- Index for point-in-time queries ("what edges were valid at time T")
CREATE INDEX IF NOT EXISTS memory_edges_valid_at_idx
  ON memory_edges (valid_from, valid_to)
  ;

-- Index for historical queries
CREATE INDEX IF NOT EXISTS memory_edges_valid_range_idx
  ON memory_edges USING gist (
    tstzrange(
      COALESCE(valid_from, '-infinity'::timestamp with time zone),
      COALESCE(valid_to, 'infinity'::timestamp with time zone)
    )
  );

-- Index for finding superseded (soft-deleted) edges
CREATE INDEX IF NOT EXISTS memory_edges_superseded_idx
  ON memory_edges (from_id, to_id, kind)
  WHERE valid_to IS NOT NULL;

-- Comment explaining the columns
COMMENT ON COLUMN memory_edges.valid_from IS
  'Start of validity period in the real world. NULL means valid from the beginning of time.';

COMMENT ON COLUMN memory_edges.valid_to IS
  'End of validity period in the real world. NULL means currently valid (open-ended). Set this to "soft delete" an edge.';

-- Helper function to get currently valid edges
CREATE OR REPLACE FUNCTION memory_edges_valid_at(query_time timestamp with time zone DEFAULT NOW())
RETURNS SETOF memory_edges AS $$
  SELECT *
  FROM memory_edges
  WHERE (valid_from IS NULL OR valid_from <= query_time)
    AND (valid_to IS NULL OR valid_to > query_time);
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION memory_edges_valid_at IS
  'Returns edges that were valid at the specified time. Defaults to current time.';
