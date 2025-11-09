-- Migration 0021: Add event_id to workflow_events for stable deduplication
-- Adds a UUID event_id with a unique index and a composite index for common queries.

-- Ensure the UUID generator exists (pgcrypto provides gen_random_uuid)
-- Note: this is idempotent and safe if already installed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE workflow_events 
  ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Unique index for direct lookups and to enforce identity constraints
CREATE UNIQUE INDEX IF NOT EXISTS workflow_events_event_id_idx 
  ON workflow_events (event_id);

-- Composite index to optimize replay queries by run and type while preserving event order via event_id
CREATE INDEX IF NOT EXISTS workflow_events_run_type_event_id_idx
  ON workflow_events (run_id, event_type, event_id);

