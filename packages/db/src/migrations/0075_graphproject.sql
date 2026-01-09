-- packages/db/src/migrations/0075_graphproject.sql
-- Attach memory graph records to projects.

ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'memory_nodes_project_id_fkey'
  ) THEN
    ALTER TABLE memory_nodes
      ADD CONSTRAINT memory_nodes_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memory_nodes_project_updated
  ON memory_nodes(project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;

ALTER TABLE memory_edges
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'memory_edges_project_id_fkey'
  ) THEN
    ALTER TABLE memory_edges
      ADD CONSTRAINT memory_edges_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memory_edges_project_created
  ON memory_edges(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

ALTER TABLE knowledge_corrections
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_corrections_project_id_fkey'
  ) THEN
    ALTER TABLE knowledge_corrections
      ADD CONSTRAINT knowledge_corrections_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_corrections_project_created
  ON knowledge_corrections(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;
