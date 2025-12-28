-- Migration 0062: Add debugger fields to workflow_events for causal linking and ordering
-- Adds parent_id for causal traceability and seq for intra-run ordering (like codex_events)

-- Add parent_id column for causal linking (nullable for genesis events)
ALTER TABLE workflow_events 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES workflow_events(event_id);

-- Add seq column for monotonic ordering within each run
ALTER TABLE workflow_events 
  ADD COLUMN IF NOT EXISTS seq INTEGER;

-- Populate seq values for existing events using ROW_NUMBER() window function
-- This assigns sequential numbers per run_id ordered by timestamp
UPDATE workflow_events we
SET seq = sub.row_num
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY timestamp, event_id) AS row_num
  FROM workflow_events
) sub
WHERE we.id = sub.id AND we.seq IS NULL;

-- Create unique constraint on (run_id, seq) to ensure ordering integrity
-- This matches the pattern used in codex_events_run_seq_idx
CREATE UNIQUE INDEX IF NOT EXISTS workflow_events_run_seq_idx
  ON workflow_events (run_id, seq)
  WHERE seq IS NOT NULL;

-- Index for efficient parent lookups (causal graph traversal)
CREATE INDEX IF NOT EXISTS workflow_events_parent_id_idx
  ON workflow_events (parent_id)
  WHERE parent_id IS NOT NULL;

-- Composite index for efficient event replay queries (run + ordering)
CREATE INDEX IF NOT EXISTS workflow_events_run_seq_timestamp_idx
  ON workflow_events (run_id, seq, timestamp)
  WHERE seq IS NOT NULL;
