-- Migration 0005: Personalization
-- Create user profiles, preferences, facts, events, autonomy, and feedback tables

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  avatar TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_key_unique UNIQUE (user_id, key);

-- User Facts (with vector embeddings)
CREATE TABLE IF NOT EXISTS user_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  category TEXT,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Events
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS user_events_user_id_timestamp_idx 
  ON user_events(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS user_events_user_id_type_idx 
  ON user_events(user_id, type);

-- User Autonomy Settings
CREATE TABLE IF NOT EXISTS user_autonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  level TEXT NOT NULL,
  require_biometric BOOLEAN DEFAULT FALSE,
  max_tool_calls INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_autonomy
  ADD CONSTRAINT user_autonomy_user_action_unique UNIQUE (user_id, action);

-- User Feedback
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  rating INTEGER,
  comment TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
