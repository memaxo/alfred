-- Migration 0083: workflowruns
-- Bring workflow_runs columns in line with Drizzle schema expectations.

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES workflow_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requirement TEXT,
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_plan_id
  ON workflow_runs(plan_id);

