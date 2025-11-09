-- Migration 0022: Linear workflow session mapping
-- Add columns to track Linear agent session for workflow runs

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS linear_session_id TEXT,
  ADD COLUMN IF NOT EXISTS linear_space TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_linear_session
  ON workflow_runs(linear_session_id)
  WHERE linear_session_id IS NOT NULL;

COMMENT ON COLUMN workflow_runs.linear_session_id IS 'Linear agent session ID for this workflow run';
COMMENT ON COLUMN workflow_runs.linear_space IS 'Linear workspace ID for this workflow run';

