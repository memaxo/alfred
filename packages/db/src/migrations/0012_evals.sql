-- Migration 0012: Evaluation System
-- Adds eval definitions, datasets, datapoints, runs, and scores tables.

CREATE TABLE IF NOT EXISTS eval_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  agent TEXT NOT NULL,
  title TEXT,
  description TEXT,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  def_id UUID NOT NULL REFERENCES eval_defs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES eval_datasets(id) ON DELETE CASCADE,
  input JSONB NOT NULL,
  target JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  def_id UUID NOT NULL REFERENCES eval_defs(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES eval_datasets(id) ON DELETE CASCADE,
  variant TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES eval_points(id) ON DELETE CASCADE,
  scorer TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  reason JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_runs_def_dataset_idx ON eval_runs(def_id, dataset_id, started_at);
CREATE INDEX IF NOT EXISTS eval_scores_run_point_scorer_idx ON eval_scores(run_id, point_id, scorer);
CREATE INDEX IF NOT EXISTS eval_points_dataset_idx ON eval_points(dataset_id, created_at);
CREATE INDEX IF NOT EXISTS eval_datasets_def_idx ON eval_datasets(def_id, created_at);
