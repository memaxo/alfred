-- packages/db/src/migrations/0072_codexproject.sql
-- Attach Codex sessions/runs to ALFRED Projects.

ALTER TABLE codex_sessions
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'codex_sessions_project_id_fkey'
  ) THEN
    ALTER TABLE codex_sessions
      ADD CONSTRAINT codex_sessions_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_codex_sessions_project
  ON codex_sessions(project_id)
  WHERE project_id IS NOT NULL;

ALTER TABLE codex_runs
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'codex_runs_project_id_fkey'
  ) THEN
    ALTER TABLE codex_runs
      ADD CONSTRAINT codex_runs_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_codex_runs_project_started
  ON codex_runs(project_id, started_at DESC)
  WHERE project_id IS NOT NULL;
