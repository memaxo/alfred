-- Migration 0043: User events and autonomy indexes (Phase 8/9)
-- Adds performance indexes for user_events timeline queries and user_autonomy uniqueness

-- Index for user events timeline queries (ordered by timestamp DESC)
CREATE INDEX IF NOT EXISTS user_events_user_timestamp_idx
  ON user_events(user_id, timestamp DESC);

-- Index for user events type filtering
CREATE INDEX IF NOT EXISTS user_events_user_type_idx
  ON user_events(user_id, type);

-- Unique index for user autonomy settings (one setting per user+action)
CREATE UNIQUE INDEX IF NOT EXISTS user_autonomy_user_action_idx
  ON user_autonomy(user_id, action);
