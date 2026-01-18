-- Migration 0085: Embedding Model Registry
-- Purpose: Track embedding models for heterogeneous embedding support
-- Reference: Qwen3-VL-Embedding migration plan

-- Create embedding models registry table
CREATE TABLE IF NOT EXISTS embedding_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  supports_text BOOLEAN NOT NULL DEFAULT true,
  supports_image BOOLEAN NOT NULL DEFAULT false,
  supports_video BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing KaLM model (current default)
INSERT INTO embedding_models (id, name, dimensions, supports_text, supports_image, supports_video, is_default, config)
VALUES (
  'kalm-12b-1024',
  'tencent/KaLM-Embedding-Gemma3-12B-2511',
  1024,
  true,
  false,
  false,
  true,
  '{"mrl_truncation": true, "native_dimensions": 3840}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Seed Qwen3-VL model (future default, multimodal)
INSERT INTO embedding_models (id, name, dimensions, supports_text, supports_image, supports_video, is_default, config)
VALUES (
  'qwen3-vl-2b-1024',
  'Qwen/Qwen3-VL-Embedding-2B',
  1024,
  true,
  true,
  true,
  false,
  '{"mrl_truncation": true, "native_dimensions": 2048, "context_length": 32768}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Index for finding default model
CREATE INDEX IF NOT EXISTS embedding_models_default_idx
  ON embedding_models (is_default) WHERE is_default = true;

COMMENT ON TABLE embedding_models IS 'Registry of embedding models for heterogeneous embedding support';
COMMENT ON COLUMN embedding_models.id IS 'Unique model identifier (e.g., kalm-12b-1024)';
COMMENT ON COLUMN embedding_models.dimensions IS 'Output embedding dimensions (after MRL truncation if applicable)';
COMMENT ON COLUMN embedding_models.config IS 'Model-specific configuration (native dimensions, context length, etc.)';
