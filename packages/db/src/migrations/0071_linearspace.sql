-- packages/db/src/migrations/0071_linearspace.sql
-- Add Linear workspace ("space") id to projects so Linear installations can be resolved correctly.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS linear_space_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_linear_space
  ON projects(linear_space_id)
  WHERE linear_space_id IS NOT NULL;

