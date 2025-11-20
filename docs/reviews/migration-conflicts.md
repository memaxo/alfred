# Migration Conflicts Analysis

## Critical Conflict: rag_chunks Index Name Mismatch

**Issue**: Migration `0024_embed_local.sql` uses wrong index name.

- `0010_vector_index.sql` creates: `rag_chunks_embedding_hnsw` ✅
- `0018_rag_optimize.sql` drops/recreates: `rag_chunks_embedding_hnsw` ✅
- `0024_embed_local.sql` drops: `rag_chunks_embedding_idx` ❌ (wrong name!)
- `0024_embed_local.sql` creates: `rag_chunks_embedding_idx` ❌ (wrong name!)

**Impact**: Migration 0024 will fail if run after 0018 because it tries to drop a non-existent index.

**Fix**: Update `0024_embed_local.sql` to use `rag_chunks_embedding_hnsw` instead of `rag_chunks_embedding_idx`.

## Consolidation Opportunities (Pre-v1 Cleanup)

Since ALFRED is pre-v1, we can consolidate migrations:

### 1. Vector Index Migrations (0010, 0018, 0024, 0027)
**Current**: 4 separate migrations for vector indexes
**Consolidate to**: Single migration that creates indexes with correct dimensions (1024) and parameters

### 2. Index TODOs (0003, 0005, 0006, 0007)
**Current**: Tables created with commented-out index TODOs, then indexes added later
**Consolidate to**: Create indexes in same migration as tables (or immediately after)

### 3. Linear Installations Refactor (0002, 0009, 0014)
**Current**: Create table → add constraint → refactor schema
**Consolidate to**: Create table with final schema

### 4. Deployments Indexes (0004, 0015)
**Current**: Table created, indexes added later
**Consolidate to**: Create indexes with table

## Recommended Pre-v1 Consolidation

1. **Fix 0024 index name** (critical bug)
2. **Consolidate vector migrations** into single migration with final state
3. **Move index creation** to same migration as table creation (or next sequential)
4. **Remove commented TODOs** - they're now implemented

## Migration Consolidation Plan

### Option A: Minimal (Fix Only)
- Fix `0024_embed_local.sql` index name
- Keep all migrations as-is

### Option B: Moderate (Fix + Clean TODOs)
- Fix `0024_embed_local.sql` index name
- Remove commented TODOs from migrations (they're implemented)
- Keep migration structure

### Option C: Aggressive (Full Consolidation)
- Fix `0024_embed_local.sql` index name
- Consolidate vector index migrations (0010, 0018, 0024, 0027) → single migration
- Move index creation to table creation migrations
- Consolidate linear_installations migrations (0002, 0009, 0014) → single migration
- Consolidate deployments migrations (0004, 0015) → single migration
- Result: ~15 migrations instead of 31

## Recommendation

**Option B (Moderate)** - Fix the bug and clean up TODOs, but keep migration history for now. Full consolidation can happen if we reset migration history before v1.

