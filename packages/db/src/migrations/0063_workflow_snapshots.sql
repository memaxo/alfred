-- Migration 0063: Create workflow_snapshots table for efficient state reconstruction
-- Mirrors the cognitive_snapshots pattern for workflow state snapshots

CREATE TABLE IF NOT EXISTS workflow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  last_event_id UUID NOT NULL REFERENCES workflow_events(event_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching latest snapshot per run (matches cognitive pattern)
CREATE INDEX IF NOT EXISTS workflow_snapshots_run_idx
  ON workflow_snapshots(run_id);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS workflow_snapshots_created_idx
  ON workflow_snapshots(created_at);

-- Composite index for efficient latest snapshot lookup
-- Used by getLatestSnapshot(runId) queries
CREATE INDEX IF NOT EXISTS workflow_snapshots_run_created_idx
  ON workflow_snapshots(run_id, created_at DESC);

-- Index for event-based snapshot lookups
CREATE INDEX IF NOT EXISTS workflow_snapshots_last_event_id_idx
  ON workflow_snapshots(last_event_id);
