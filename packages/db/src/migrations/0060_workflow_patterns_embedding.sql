-- packages/db/migrations/0060_workflow_patterns_embedding.sql
ALTER TABLE workflow_patterns ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Index for vector search
CREATE INDEX IF NOT EXISTS idx_patterns_embedding ON workflow_patterns USING hnsw (embedding vector_cosine_ops);
