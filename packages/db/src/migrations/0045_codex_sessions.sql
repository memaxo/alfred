CREATE TABLE IF NOT EXISTS codex_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id varchar(255) UNIQUE NOT NULL,
  thread_id varchar(255) NOT NULL,
  user_id varchar(255) NOT NULL,
  working_directory text NOT NULL,
  status varchar(50) NOT NULL,
  linear_issue_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS codex_sessions_session_id_key
  ON codex_sessions (session_id);

CREATE INDEX IF NOT EXISTS codex_sessions_user_idx
  ON codex_sessions (user_id);

CREATE INDEX IF NOT EXISTS codex_sessions_expires_idx
  ON codex_sessions (expires_at);
