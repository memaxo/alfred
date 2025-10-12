-- Migration 0003: Assistant Core
-- Create assistant tasks, notes, and events tables

-- TODO: [Phase 5] Add indexes after table creation

-- Assistant Tasks
CREATE TABLE IF NOT EXISTS assistant_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- TODO: [Phase 5] Add indexes
-- CREATE INDEX assistant_tasks_user_id_status_idx ON assistant_tasks(user_id, status);
-- CREATE INDEX assistant_tasks_user_id_due_idx ON assistant_tasks(user_id, due_at);

-- Assistant Notes
CREATE TABLE IF NOT EXISTS assistant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- TODO: [Phase 5] Add full-text search index on content
-- CREATE INDEX assistant_notes_content_fts_idx ON assistant_notes USING gin(to_tsvector('english', content));

-- Assistant Events
CREATE TABLE IF NOT EXISTS assistant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- TODO: [Phase 6] Add index on (user_id, start_at)
-- CREATE INDEX assistant_events_user_id_start_idx ON assistant_events(user_id, start_at);
