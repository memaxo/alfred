-- Migration 0053: Durable Codex runs + event logs
-- Adds codex_runs and codex_events tables for complete, queryable Codex execution logs.

CREATE TABLE IF NOT EXISTS codex_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id VARCHAR(255),
  thread_id VARCHAR(255),
  parent_run_id UUID REFERENCES codex_runs(id) ON DELETE SET NULL,
  resume_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed' | 'cancelled'
  exit_code INTEGER,
  error_code TEXT,
  error_message TEXT,

  auto TEXT,
  model TEXT,
  profile TEXT,

  environment_kind TEXT NOT NULL DEFAULT 'host', -- 'host' | 'worktree' | 'container' | 'poof'
  working_directory TEXT,
  workspace_root TEXT,

  docker_container_id TEXT,
  docker_image TEXT,

  poof_upper_dir TEXT,
  poof_profile TEXT,

  output_schema JSONB,
  structured_output JSONB,
  structured_output_status TEXT, -- 'valid' | 'invalid' | 'parse_failed' | 'skipped'

  artifacts JSONB,
  result_text TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS codex_runs_user_started_idx
  ON codex_runs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS codex_runs_user_session_started_idx
  ON codex_runs (user_id, session_id, started_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS codex_runs_thread_idx
  ON codex_runs (thread_id)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS codex_runs_parent_idx
  ON codex_runs (parent_run_id)
  WHERE parent_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS codex_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES codex_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  content_tsvector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', COALESCE(text, ''))) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS codex_events_run_seq_idx
  ON codex_events (run_id, seq);

CREATE INDEX IF NOT EXISTS codex_events_run_created_idx
  ON codex_events (run_id, created_at);

CREATE INDEX IF NOT EXISTS codex_events_type_created_idx
  ON codex_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS codex_events_text_gin_idx
  ON codex_events USING gin (content_tsvector);

-- Retention policy function (patterned after workflow retention)
CREATE OR REPLACE FUNCTION prune_old_codex_data(retention_days INTEGER DEFAULT 30)
RETURNS TABLE(deleted_runs INTEGER, deleted_events INTEGER) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  runs_deleted INTEGER;
  events_deleted INTEGER;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

  -- Delete old events first
  DELETE FROM codex_events
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS events_deleted = ROW_COUNT;

  -- Delete terminal runs older than retention window
  DELETE FROM codex_runs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND started_at < cutoff_date;
  GET DIAGNOSTICS runs_deleted = ROW_COUNT;

  RETURN QUERY SELECT runs_deleted, events_deleted;
END;
$$ LANGUAGE plpgsql;

