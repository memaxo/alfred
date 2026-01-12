-- Migration 0082: trajectory
-- Store exported trajectories (e.g., Harbor ATIF) for durable retrieval and caching.

CREATE TABLE IF NOT EXISTS workflow_trajectories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  format text NOT NULL,
  schema_version text NOT NULL DEFAULT 'ATIF-v1.4',
  data jsonb NOT NULL,
  valid boolean NOT NULL DEFAULT true,
  errors jsonb,
  last_event_id uuid,
  last_seq integer,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_trajectories_run_format_idx
  ON workflow_trajectories (run_id, format);

CREATE INDEX IF NOT EXISTS workflow_trajectories_run_updated_idx
  ON workflow_trajectories (run_id, updated_at DESC);

