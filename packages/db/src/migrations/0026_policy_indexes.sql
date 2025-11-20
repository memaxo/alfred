-- Migration 0026: Policy table indexes
-- Add missing indexes for audit_logs, approvals, and user_events queries
-- These indexes are critical for meeting the <10ms (p99) performance budget

-- Audit Logs Indexes
-- Index for user audit trail queries (most common pattern)
CREATE INDEX IF NOT EXISTS audit_logs_user_id_timestamp_idx 
  ON audit_logs(user_id, timestamp DESC);

-- Index for trace correlation queries (partial index to reduce size)
CREATE INDEX IF NOT EXISTS audit_logs_trace_id_idx 
  ON audit_logs(trace_id) 
  WHERE trace_id IS NOT NULL;

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS audit_logs_action_idx 
  ON audit_logs(action);

-- Approvals Indexes
-- Index for pending approval queries by user
CREATE INDEX IF NOT EXISTS approvals_user_id_status_idx 
  ON approvals(user_id, status);

-- Index for expiry cleanup queries (partial index to reduce size)
CREATE INDEX IF NOT EXISTS approvals_expires_at_status_idx 
  ON approvals(expires_at, status) 
  WHERE expires_at IS NOT NULL;

-- User Events Indexes
-- Index for user event timeline queries
CREATE INDEX IF NOT EXISTS user_events_user_id_timestamp_idx 
  ON user_events(user_id, timestamp DESC);

-- Index for filtering events by type
CREATE INDEX IF NOT EXISTS user_events_user_id_type_idx 
  ON user_events(user_id, type);

