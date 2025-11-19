-- Migration 0020: Workflow indexes and retention
-- Add composite indexes for common query patterns and retention policy support

-- Composite index for listing workflows by workflow_id, status, and creation time
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_status_created_idx
  ON workflow_runs (workflow_id, status, created_at DESC);

-- Composite index for filtering events by run_id and event_type
CREATE INDEX IF NOT EXISTS workflow_events_run_type_idx
  ON workflow_events (run_id, event_type, timestamp DESC);

-- Index for retention policy queries (old runs)
CREATE INDEX IF NOT EXISTS workflow_runs_created_status_idx
  ON workflow_runs (created_at, status)
  WHERE status IN ('completed', 'failed', 'cancelled');

-- Index for retention policy queries (old events)
-- Note: Removed WHERE clause because NOW() is not IMMUTABLE and cannot be used in index predicates
CREATE INDEX IF NOT EXISTS workflow_events_timestamp_idx
  ON workflow_events (timestamp);

-- Add retention policy function (to be called by scheduler)
CREATE OR REPLACE FUNCTION prune_old_workflow_data(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(deleted_runs INTEGER, deleted_events INTEGER) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  runs_deleted INTEGER;
  events_deleted INTEGER;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete events older than retention period (cascade will handle run cleanup if needed)
  DELETE FROM workflow_events
  WHERE timestamp < cutoff_date;
  GET DIAGNOSTICS events_deleted = ROW_COUNT;
  
  -- Delete completed/failed/cancelled runs older than retention period
  DELETE FROM workflow_runs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < cutoff_date;
  GET DIAGNOSTICS runs_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT runs_deleted, events_deleted;
END;
$$ LANGUAGE plpgsql;

