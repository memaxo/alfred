-- Migration 0039: Assistant schema performance indexes
-- Addresses assistant TODOs for tasks, notes, reminders, bookmarks, and timers

-- Index for filtering tasks/notes by user and status
CREATE INDEX IF NOT EXISTS assistant_tasks_user_status_idx 
  ON assistant_tasks(user_id, status);

-- Index for due date queries on tasks/notes
DROP INDEX IF EXISTS assistant_tasks_user_due_idx;
CREATE INDEX IF NOT EXISTS assistant_tasks_user_due_idx 
  ON assistant_tasks(user_id, due_at) 
  WHERE due_at IS NOT NULL;

-- Full-text search column on note content to support GIN
ALTER TABLE assistant_notes
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content, ''))) STORED;

-- Full-text search index on note content
DROP INDEX IF EXISTS assistant_notes_content_gin;
CREATE INDEX IF NOT EXISTS assistant_notes_content_gin_idx
  ON assistant_notes
  USING gin (content_tsvector);

-- Index for calendar queries on timers (start date)
CREATE INDEX IF NOT EXISTS assistant_timers_user_start_idx 
  ON assistant_timers(user_id, start_at) 
  WHERE start_at IS NOT NULL;

-- Index for active timer queries (focuses on unfinished timers)
CREATE INDEX IF NOT EXISTS assistant_timers_active_idx 
  ON assistant_timers(user_id, end_at, completed) 
  WHERE completed = false AND cancelled = false;

-- Index for scheduler queries on reminders (due date and fired status)
DROP INDEX IF EXISTS assistant_reminders_user_due_fired_idx;
CREATE INDEX IF NOT EXISTS assistant_reminders_user_due_fired_idx 
  ON assistant_reminders(user_id, due_at, fired) 
  WHERE due_at IS NOT NULL;

-- Unique index for bookmark deduplication by user and URL
DROP INDEX IF EXISTS assistant_bookmarks_user_id_url_idx;
CREATE UNIQUE INDEX IF NOT EXISTS assistant_bookmarks_user_url_idx 
  ON assistant_bookmarks(user_id, url) 
  WHERE url IS NOT NULL;
