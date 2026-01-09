-- Migration 0079: Assistant Project Scoping
-- Add project_id to assistant_tasks, assistant_notes, assistant_events, assistant_reminders, assistant_bookmarks, assistant_timers

-- Assistant Tasks
ALTER TABLE assistant_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_tasks_project_id_idx ON assistant_tasks (project_id);

-- Assistant Notes
ALTER TABLE assistant_notes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_notes_project_id_idx ON assistant_notes (project_id);

-- Assistant Events
ALTER TABLE assistant_events ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_events_project_id_idx ON assistant_events (project_id);

-- Assistant Reminders
ALTER TABLE assistant_reminders ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_reminders_project_id_idx ON assistant_reminders (project_id);

-- Assistant Bookmarks
ALTER TABLE assistant_bookmarks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_bookmarks_project_id_idx ON assistant_bookmarks (project_id);

-- Assistant Timers
ALTER TABLE assistant_timers ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assistant_timers_project_id_idx ON assistant_timers (project_id);
