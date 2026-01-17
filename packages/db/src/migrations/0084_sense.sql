-- Migration 0084: Sense
-- Capture inbox primitives: captures, bundles, receipts, workingset

CREATE TABLE IF NOT EXISTS sense_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source_device TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS sense_captures_user_created_idx
  ON sense_captures (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sense_captures_user_status_idx
  ON sense_captures (user_id, status);

CREATE TABLE IF NOT EXISTS sense_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES sense_captures(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  entities JSONB,
  route_candidates JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sense_bundles_capture_id_unique
  ON sense_bundles (capture_id);

CREATE TABLE IF NOT EXISTS sense_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES sense_captures(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT 'route',
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence REAL NOT NULL DEFAULT 0.5,
  corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sense_receipts_capture_id_unique
  ON sense_receipts (capture_id);

CREATE TABLE IF NOT EXISTS sense_workingsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  focus JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sense_workingsets_user_id_unique
  ON sense_workingsets (user_id);

