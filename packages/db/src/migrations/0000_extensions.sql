-- Migration 0000: Extensions
-- Enable required PostgreSQL extensions

-- TODO: [Phase 3] Run this migration first to enable extensions

-- pgcrypto for UUID generation and encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- vector extension for pgvector (embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- TODO: [Phase 3] Verify extensions are loaded
-- SELECT * FROM pg_extension WHERE extname IN ('pgcrypto', 'vector');
