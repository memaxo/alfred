CREATE INDEX IF NOT EXISTS user_facts_embedding_hnsw
  ON user_facts USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);
