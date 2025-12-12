-- Knowledge correction records for the memory graph
-- Purpose: Persist durable correction intent + before/after snapshots for node/edge corrections.

CREATE TABLE IF NOT EXISTS knowledge_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  target_type TEXT NOT NULL, -- "node" | "edge"
  target_id UUID NOT NULL,
  operation TEXT NOT NULL, -- "update" | "delete"
  reason TEXT NOT NULL,
  previous JSONB,
  patch JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_corrections_user_created_idx
  ON knowledge_corrections (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_corrections_target_idx
  ON knowledge_corrections (target_type, target_id);

CREATE INDEX IF NOT EXISTS knowledge_corrections_resource_idx
  ON knowledge_corrections (resource);
