# Migration Review

## Critical Issues

### 1. Missing Indexes for Policy Tables (Migration 0006)

**Issue**: Migration `0006_policy_audit.sql` creates `audit_logs` and `approvals` tables but never adds the promised indexes.

**Impact**: 
- Slow queries on `audit_logs` by `user_id`, `trace_id`, or `action`
- Slow queries on `approvals` by `user_id + status` or `expires_at + status`
- Missing indexes violate `.ruler/04-database.md` requirement: "All repo queries must complete in <10ms (p99)"

**Fix Required**: Create migration `0026_policy_indexes.sql`:
```sql
-- Migration 0026: Policy table indexes
-- Add missing indexes for audit_logs and approvals queries

CREATE INDEX IF NOT EXISTS audit_logs_user_id_timestamp_idx 
  ON audit_logs(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS audit_logs_trace_id_idx 
  ON audit_logs(trace_id) 
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_action_idx 
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS approvals_user_id_status_idx 
  ON approvals(user_id, status);

CREATE INDEX IF NOT EXISTS approvals_expires_at_status_idx 
  ON approvals(expires_at, status) 
  WHERE expires_at IS NOT NULL;
```

### 2. Vector Dimension Mismatch: user_facts Still Uses 1536

**Issue**: Migration `0024_embed_local.sql` updates `rag_chunks.embedding` from 1536 to 1024 dimensions, but `user_facts.embedding` still uses 1536 dimensions (defined in `0005_personalization.sql`).

**Impact**:
- Schema inconsistency: `packages/db/src/schema/user.ts` defines `VECTOR_DIM = 1536` while `packages/db/src/schema/rag.ts` uses `EMBEDDING_DIM` (1024)
- `user_facts` table cannot use local embeddings (KaLM-Embedding-Gemma3-12B-2511) which outputs 1024 dimensions
- Existing HNSW index on `user_facts_embedding_hnsw` (created in `0010_vector_index.sql`) expects 1536 dimensions

**Fix Required**: Create migration `0027_user_facts_embedding_dimension.sql`:
```sql
-- Migration 0027: Update user_facts embedding dimension to 1024
-- Aligns with local embedding model (KaLM-Embedding-Gemma3-12B-2511)

-- Drop existing HNSW index
DROP INDEX IF EXISTS user_facts_embedding_hnsw;

-- Update embedding column dimension from 1536 to 1024
ALTER TABLE user_facts 
  ALTER COLUMN embedding TYPE vector(1024);

-- Rebuild HNSW index with optimized parameters for 1024 dimensions
CREATE INDEX user_facts_embedding_hnsw 
  ON user_facts 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 100);

-- Add comment documenting the dimension change
COMMENT ON COLUMN user_facts.embedding IS 
  'KaLM-Embedding-Gemma3-12B-2511 embeddings (1024 dimensions via MRL truncation, local model)';
```

**Schema Update Required**: Update `packages/db/src/schema/user.ts`:
```typescript
// Change from:
export const VECTOR_DIM = 1536;

// To:
import { EMBEDDING_DIM } from "@alfred/embed";
export const VECTOR_DIM = EMBEDDING_DIM;
```

## Performance Issues

### 3. Missing Indexes for User Events (Migration 0005)

**Issue**: Migration `0005_personalization.sql` creates `user_events` table but never adds indexes.

**Impact**: Slow queries filtering by `user_id + timestamp` or `user_id + type`.

**Fix Required**: Add to migration `0026_policy_indexes.sql` or create separate migration:
```sql
CREATE INDEX IF NOT EXISTS user_events_user_id_timestamp_idx 
  ON user_events(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS user_events_user_id_type_idx 
  ON user_events(user_id, type);
```

### 4. Missing Full-Text Search Index for assistant_notes (Migration 0003)

**Issue**: Migration `0003_assistant.sql` creates `assistant_notes` table with a TODO for full-text search index that was never implemented.

**Impact**: Slow text search queries on note content.

**Fix Required**: Create migration `0028_assistant_notes_fts.sql`:
```sql
-- Migration 0028: Full-text search for assistant_notes

-- Add tsvector column for full-text search
ALTER TABLE assistant_notes
  ADD COLUMN IF NOT EXISTS content_tsvector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS assistant_notes_content_gin
  ON assistant_notes
  USING gin (content_tsvector);
```

### 5. Missing Index for assistant_events (Migration 0003)

**Issue**: Migration `0003_assistant.sql` creates `assistant_events` table but never adds the promised index.

**Impact**: Slow queries filtering by `user_id + start_at`.

**Fix Required**: Add to migration `0028_assistant_notes_fts.sql`:
```sql
CREATE INDEX IF NOT EXISTS assistant_events_user_id_start_idx 
  ON assistant_events(user_id, start_at DESC);
```

### 6. Missing Index for assistant_bookmarks (Migration 0007)

**Issue**: Migration `0007_assistant_productivity.sql` creates `assistant_bookmarks` table but never adds the promised index for deduplication.

**Impact**: Slow deduplication queries and potential duplicate bookmarks.

**Fix Required**: Add to migration `0028_assistant_notes_fts.sql`:
```sql
CREATE INDEX IF NOT EXISTS assistant_bookmarks_user_id_url_idx 
  ON assistant_bookmarks(user_id, url);
```

### 7. Missing Index on rag_documents.source

**Issue**: Schema `packages/db/src/schema/rag.ts` has a TODO for index on `source` column but no migration exists.

**Impact**: Slow deduplication queries when checking if a document already exists.

**Fix Required**: Create migration `0029_rag_documents_source_index.sql`:
```sql
-- Migration 0029: Index for rag_documents.source deduplication

CREATE INDEX IF NOT EXISTS rag_documents_source_idx 
  ON rag_documents(source);
```

## Idempotency Issues

### 8. Migration 0024 Creates Index Without IF NOT EXISTS

**Issue**: Migration `0024_embed_local.sql` creates index `rag_chunks_embedding_idx` without `IF NOT EXISTS`, making it non-idempotent.

**Impact**: Running migration twice will fail with "relation already exists" error.

**Fix Required**: Update migration `0024_embed_local.sql`:
```sql
-- Change from:
CREATE INDEX rag_chunks_embedding_idx ON rag_chunks 

-- To:
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx ON rag_chunks 
```

### 9. Migration 0018 Drops Index Without IF EXISTS Check

**Issue**: Migration `0018_rag_optimize.sql` uses `DROP INDEX IF EXISTS` which is correct, but the pattern is inconsistent with other migrations.

**Status**: Actually correct - `DROP INDEX IF EXISTS` is idempotent. No fix needed.

### 10. Migration 0014 Uses DO Block for Constraint Drop

**Issue**: Migration `0014_linear_workspace.sql` uses a DO block to conditionally drop a constraint, which is correct but verbose.

**Status**: Correct approach for conditional constraint dropping. No fix needed.

## Schema Consistency Issues

### 11. Missing Index on rag_chunks.document_id

**Issue**: Migration `0001_init.sql` has a TODO for `rag_chunks_document_id_idx` that was never implemented. Migration `0018_rag_optimize.sql` adds a composite index `rag_chunks_document_order_idx` but not the single-column index.

**Impact**: Queries filtering only by `document_id` (without `order`) may be slower.

**Status**: The composite index `(document_id, order)` can be used for `document_id`-only queries, but a dedicated index would be more efficient. Consider adding:
```sql
CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx 
  ON rag_chunks(document_id);
```

## Recommendations

1. **Immediate Priority**: Fix vector dimension mismatch (#2) - breaks local embedding support
2. **High Priority**: Add missing policy indexes (#1) - violates performance budget
3. **Medium Priority**: Add missing user/assistant indexes (#3, #4, #5, #6) - performance degradation
4. **Low Priority**: Add rag_documents.source index (#7) - minor performance improvement

## Migration Order

Create migrations in this order:
1. Fix `0024_embed_local.sql` - Add `IF NOT EXISTS` to index creation (idempotency fix)
2. `0026_policy_indexes.sql` - Fix critical missing indexes
3. `0027_user_facts_embedding_dimension.sql` - Fix vector dimension mismatch
4. `0028_assistant_notes_fts.sql` - Add missing assistant indexes
5. `0029_rag_documents_source_index.sql` - Add source deduplication index

## Best Practices Validation

Based on PostgreSQL and Drizzle ORM best practices:

### ✅ Idempotency (Correctly Implemented)

- **Pattern**: Use `CREATE INDEX IF NOT EXISTS` and `DROP INDEX IF EXISTS` for idempotent migrations
- **Status**: Most migrations follow this pattern correctly
- **Exception**: Migration `0024_embed_local.sql` creates index without `IF NOT EXISTS` (Issue #8)

### ✅ Atomic Migrations

- **Best Practice**: Each migration should represent a single, atomic change
- **Status**: All migrations follow this pattern - each file addresses one concern
- **Validation**: Migrations are well-separated by feature/concern

### ✅ Partial Indexes (Correctly Used)

- **Best Practice**: Use `WHERE` clauses in indexes to reduce index size and improve performance
- **Examples Found**:
  - `workflow_events_step_id_idx` uses `WHERE step_id IS NOT NULL` ✅
  - `workflow_runs_webhook_idx` uses `WHERE webhook_url IS NOT NULL` ✅
  - `conversations_workflow_idx` uses `WHERE workflow_id IS NOT NULL` ✅
- **Recommendation**: Apply partial indexes to `audit_logs_trace_id_idx` and `approvals_expires_at_status_idx` (already included in fixes)

### ✅ Index Naming Conventions

- **Pattern**: `{table}_{columns}_{suffix}_idx` format
- **Status**: Consistent naming throughout migrations
- **Examples**: `workflow_runs_user_status_idx`, `messages_conversation_created_idx`

### ✅ Composite Indexes (Correctly Ordered)

- **Best Practice**: Order columns in composite indexes by selectivity (most selective first) or query pattern
- **Status**: Indexes follow query patterns correctly:
  - `(user_id, status)` - filters by user first, then status ✅
  - `(conversation_id, created_at ASC)` - filters by conversation, then orders by time ✅
  - `(workflow_id, status, created_at DESC)` - filters by workflow/status, then orders by time ✅

### ⚠️ Vector Dimension Changes (Requires Care)

- **Best Practice**: When changing vector dimensions, existing embeddings become invalid
- **Current Approach**: Migration `0024_embed_local.sql` correctly:
  - Drops index before altering column ✅
  - Documents that existing embeddings will be NULL ✅
  - Notes regeneration pattern ✅
- **Recommendation**: Apply same pattern to `user_facts` migration (Issue #2)

### ✅ HNSW Index Parameters

- **Current Parameters**: `m=16, ef_construction=100` (for 1024 dimensions)
- **Best Practice**: 
  - `m=16`: Good balance for 1024 dimensions (pgvector default is 16)
  - `ef_construction=100`: Higher quality index (default is 64) - appropriate for production
- **Status**: Parameters are well-tuned for production use ✅

### ⚠️ Missing Index Analysis

- **Best Practice**: Indexes should match query patterns from repository code
- **Gap**: Missing indexes identified in review match TODOs in migrations, indicating planned but not implemented
- **Recommendation**: Complete all TODO indexes before production deployment

### ✅ Transaction Safety

- **Best Practice**: Drizzle migrations run in transactions automatically
- **Status**: All migrations are safe for transactional execution ✅
- **Note**: `ALTER COLUMN TYPE` operations (vector dimension changes) may require table locks

### ✅ Documentation

- **Best Practice**: Document migration purpose, changes, and special considerations
- **Status**: Most migrations include comments explaining purpose ✅
- **Enhancement**: Add comments to new migrations explaining why indexes are needed

## Drizzle ORM Best Practices

### ✅ Migration File Management

- **Best Practice**: Use Drizzle Kit to generate migrations (`drizzle-kit generate`)
- **Current Approach**: Manual SQL migrations (custom migration runner)
- **Status**: Custom approach is valid, but ensure:
  - ✅ Migration files are version-controlled (Git)
  - ✅ Migration history is never manually modified
  - ✅ Migrations are tested before production

### ✅ Schema Consistency

- **Best Practice**: Keep Drizzle schema files (`packages/db/src/schema/*.ts`) in sync with migrations
- **Current Issues**:
  - ⚠️ `user.ts` defines `VECTOR_DIM = 1536` but migrations use 1024 (Issue #2)
  - ⚠️ `rag.ts` correctly uses `EMBEDDING_DIM` from `@alfred/embed`
- **Recommendation**: Update `user.ts` to use `EMBEDDING_DIM` for consistency

### ✅ Query Pattern Alignment

- **Best Practice**: Indexes should match Drizzle query patterns from repositories
- **Validation Needed**: Review repository queries to ensure indexes match:
  - `packages/api/src/repos/policy.ts` - verify `audit_logs` and `approvals` query patterns
  - `packages/api/src/repos/user.ts` - verify `user_events` query patterns
  - `packages/api/src/repos/assistant.ts` - verify `assistant_notes`, `assistant_events`, `assistant_bookmarks` patterns

### ✅ Type Safety

- **Best Practice**: Use Drizzle's inferred types (`typeof table.$inferSelect`)
- **Status**: Schema files use proper Drizzle types ✅
- **Note**: Vector dimension changes require schema updates to maintain type safety

### ⚠️ Migration Runner Considerations

- **Best Practice**: Drizzle Kit tracks migration state automatically
- **Current Approach**: Custom migration runner (`packages/db/scripts/migrate.ts`)
- **Recommendation**: Ensure custom runner:
  - ✅ Tracks applied migrations (prevents duplicate execution)
  - ✅ Supports rollback (if needed)
  - ✅ Validates migration order

## Testing Checklist

After applying fixes:
- [ ] Verify all indexes are created: `\d+ table_name` in psql
- [ ] Run `EXPLAIN ANALYZE` on common queries to verify index usage
- [ ] Verify `user_facts.embedding` column accepts 1024-dimensional vectors
- [ ] Verify `rag_chunks.embedding` column accepts 1024-dimensional vectors
- [ ] Test full-text search on `assistant_notes.content`
- [ ] Verify policy queries complete in <10ms (p99)
- [ ] Verify partial indexes reduce index size: `SELECT pg_size_pretty(pg_relation_size('index_name'))`
- [ ] Test migration idempotency by running migrations twice
- [ ] Verify HNSW index parameters: `SELECT * FROM pg_indexes WHERE indexname LIKE '%hnsw%'`

