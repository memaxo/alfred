-- packages/db/src/migrations/0076_deployproject.sql
-- Attach deployments to ALFRED Projects.

ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deployments_project_id_fkey'
  ) THEN
    ALTER TABLE deployments
      ADD CONSTRAINT deployments_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deployments_project_created
  ON deployments(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
