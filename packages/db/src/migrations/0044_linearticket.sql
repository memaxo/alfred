-- Linear ticket linkage for workflow runs
-- Adds explicit issue identifiers/URLs for downstream tooling
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS linear_issue_id text,
  ADD COLUMN IF NOT EXISTS linear_issue_url text;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_linear_issue
  ON workflow_runs(linear_issue_id);
