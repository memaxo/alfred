# RAG Patterns

1. **Chunking.** Use sentence-aware chunking with max 512 tokens per chunk. Preserve context with headers (file paths, section titles). Store chunks with `order` field for document reconstruction.

2. **Embedding integration.** Always use `EMBEDDING_DIM` from `@alfred/embed` for dimension validation. Process embeddings in batches (max 1000 chunks). Handle embedding failures gracefully—log errors but continue processing remaining batches.

3. **Retrieval.** Use vector similarity search via HNSW indexes. Apply threshold filtering (default 0.7) both server-side and client-side for correctness. Use `fetchLimit = k * 3` to account for threshold filtering.

4. **Hybrid search.** Combine vector search with full-text search (GIN indexes on `tsvector` columns) for better recall. Use `rag_chunks.content_tsvector` for sparse search, vector embeddings for semantic search.

5. **Deduplication.** Check `rag_documents.source` before ingestion to avoid duplicate documents. Use `rag_documents_source_idx` for fast lookups.

6. **Cognitive Context.** Context retrieval must be hybrid: Semantic (Vector) for topic relevance + Structural (Graph) for dependency awareness. Use 2-hop traversal for sparse graphs.

7. **Reranking.** Perform reranking in the Engine layer (`KnowledgeEngine`), not the Repo layer. Repositories should be pure data access; complex ML orchestration and external API calls belong in Engines.

