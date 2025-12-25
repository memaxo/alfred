-- packages/db/src/migrations/0057_workflow_runs_project.sql
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs(project_id);
