-- packages/db/src/migrations/0078_projectarchive.sql
-- Add basic lifecycle fields for Projects.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_archived_at
  ON projects(archived_at)
  WHERE archived_at IS NOT NULL;
