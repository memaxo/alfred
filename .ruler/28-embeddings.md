# Embeddings Standards

1. **Dimension consistency.** Always use `EMBEDDING_DIM` from `@alfred/embed` as single source of truth. Schema files (`packages/db/src/schema/*.ts`) must import and use `EMBEDDING_DIM`, never hardcode dimensions.

2. **HNSW indexes.** Use `m=16, ef_construction=100` for production HNSW indexes. Always create with `IF NOT EXISTS` for idempotency. Drop indexes before `ALTER COLUMN TYPE` on vector columns.

3. **Dimension changes.** When changing vector dimensions: (1) drop existing HNSW index, (2) alter column type, (3) recreate index with `IF NOT EXISTS`, (4) document that existing embeddings become NULL and will regenerate.

4. **Validation.** Validate embedding dimensions match `EMBEDDING_DIM` before database writes. Reject embeddings with wrong dimensions—log error and skip chunk rather than corrupting data.

5. **Model selection.** Use KaLM-Embedding-Gemma3-12B-2511 with MRL truncation to 1024 dimensions. MRL truncation retains 93-95% quality while reducing storage by 33% vs OpenAI's 1536 dimensions.

6. **Schema alignment.** Vector columns in Drizzle schemas must use `vector("embedding", { dimensions: VECTOR_DIM })` where `VECTOR_DIM = EMBEDDING_DIM`. Never hardcode dimension values in schema files.

