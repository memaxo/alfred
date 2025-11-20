-- Migration 0000: Extensions
-- Enable required PostgreSQL extensions

-- pgcrypto for UUID generation and encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- vector extension for pgvector (embeddings)
CREATE EXTENSION IF NOT EXISTS vector;
