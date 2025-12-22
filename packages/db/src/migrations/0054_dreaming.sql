-- Migration 0054: Dreaming
-- Track automatic dreaming progress for failed workflow runs.

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS dreamed_at TIMESTAMPTZ;

-- Efficiently find failed runs pending dreaming.
CREATE INDEX IF NOT EXISTS workflow_runs_failed_dreamed_idx
  ON workflow_runs (created_at DESC)
  WHERE status = 'failed' AND dreamed_at IS NULL;

