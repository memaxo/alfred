-- Migration: Replace poof columns with agentfs columns in codex_runs
-- This migration adds AgentFS support and deprecates poof columns.
-- PostgreSQL 9.6+ required for ADD COLUMN IF NOT EXISTS.

-- Add new agentfs columns (idempotent for PostgreSQL 9.6+)
DO $$
BEGIN
  -- Check if agentfs_db_path column exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'codex_runs'
    AND column_name = 'agentfs_db_path'
  ) THEN
    ALTER TABLE codex_runs ADD COLUMN agentfs_db_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'codex_runs'
    AND column_name = 'agentfs_run_id'
  ) THEN
    ALTER TABLE codex_runs ADD COLUMN agentfs_run_id TEXT;
  END IF;
END$$;

-- Create index for agentfs queries (idempotent)
CREATE INDEX IF NOT EXISTS codex_runs_agentfs_idx
  ON codex_runs(agentfs_db_path)
  WHERE agentfs_db_path IS NOT NULL;

-- Note: We keep poof columns for historical data.
-- They are deprecated but not dropped to preserve audit trail of historical runs.
-- New runs should use agentfs_db_path instead of poof_upper_dir.

-- Add comment to mark poof columns as deprecated
COMMENT ON COLUMN codex_runs.poof_upper_dir IS 'DEPRECATED: Use agentfs_db_path instead. Kept for historical data.';
COMMENT ON COLUMN codex_runs.poof_profile IS 'DEPRECATED: No longer used. Kept for historical data.';
