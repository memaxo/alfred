-- Migration 0007: Assistant Productivity Features
-- Create reminders, bookmarks, and timers tables

-- TODO: [Phase 6] Add indexes after table creation

-- Reminders
CREATE TABLE IF NOT EXISTS assistant_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  fired BOOLEAN DEFAULT FALSE,
  fired_at TIMESTAMPTZ,
  recurring TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- TODO: [Phase 6] Add index for scheduler queries
-- CREATE INDEX assistant_reminders_user_id_due_fired_idx ON assistant_reminders(user_id, due_at, fired);

-- Bookmarks
CREATE TABLE IF NOT EXISTS assistant_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- TODO: [Phase 5] Add index for deduplication
-- CREATE INDEX assistant_bookmarks_user_id_url_idx ON assistant_bookmarks(user_id, url);

-- Timers
CREATE TABLE IF NOT EXISTS assistant_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  label TEXT,
  duration_seconds INTEGER NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  cancelled BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TODO: [Phase 6] Add index for active timer queries
-- CREATE INDEX assistant_timers_user_id_end_completed_idx ON assistant_timers(user_id, end_at, completed);
