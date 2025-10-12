-- Assistant indexes for scheduler and list queries
CREATE INDEX IF NOT EXISTS assistant_tasks_user_status_idx
  ON assistant_tasks (user_id, status);

CREATE INDEX IF NOT EXISTS assistant_tasks_user_due_idx
  ON assistant_tasks (user_id, due_at);

CREATE INDEX IF NOT EXISTS assistant_reminders_user_due_fired_idx
  ON assistant_reminders (user_id, due_at, fired);

CREATE INDEX IF NOT EXISTS assistant_timers_user_end_completed_idx
  ON assistant_timers (user_id, end_at, completed);
