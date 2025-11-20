-- Migration 0028: Assistant notes full-text search and missing indexes
-- Add full-text search for assistant_notes and indexes for assistant_events and assistant_bookmarks

-- Full-text search for assistant_notes
-- Add tsvector column for full-text search (sparse/hybrid search)
ALTER TABLE assistant_notes
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS assistant_notes_content_gin
  ON assistant_notes
  USING gin (content_tsvector);

-- Index for assistant_events queries by user and start time
CREATE INDEX IF NOT EXISTS assistant_events_user_id_start_idx 
  ON assistant_events(user_id, start_at DESC);

-- Index for assistant_bookmarks deduplication queries
CREATE INDEX IF NOT EXISTS assistant_bookmarks_user_id_url_idx 
  ON assistant_bookmarks(user_id, url);

