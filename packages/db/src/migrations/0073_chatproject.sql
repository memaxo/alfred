-- packages/db/src/migrations/0073_chatproject.sql
-- Attach conversations to ALFRED Projects.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_project_id_fkey'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_project_updated
  ON conversations(project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;
