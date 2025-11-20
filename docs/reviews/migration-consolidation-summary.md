# Migration Consolidation Summary

## Consolidated Migrations (Pre-v1 Cleanup)

The following migrations have been consolidated into earlier migrations and can be deleted:

### Deleted Migrations

1. **0008_indexes.sql** → Consolidated into:
   - `0003_assistant.sql` (assistant_tasks indexes)
   - `0007_assistant_productivity.sql` (reminders, timers indexes)

2. **0009_uniques.sql** → Consolidated into:
   - `0005_personalization.sql` (user_preferences, user_autonomy constraints)
   - `0002_linear.sql` (now uses final schema, no constraint needed)

3. **0014_linear_workspace.sql** → Consolidated into:
   - `0002_linear.sql` (final workspace-centric schema)

4. **0015_deployments_enhancements.sql** → Consolidated into:
   - `0004_deployments.sql` (columns and indexes)

5. **0016_graph_indexes.sql** → Consolidated into:
   - `0001_init.sql` (graph traversal indexes)

6. **0026_policy_indexes.sql** → Consolidated into:
   - `0006_policy_audit.sql` (audit_logs and approvals indexes)

7. **0028_assistant_notes_fts.sql** → Consolidated into:
   - `0003_assistant.sql` (full-text search for assistant_notes)

8. **0029_rag_documents_source_index.sql** → Consolidated into:
   - `0001_init.sql` (rag_documents.source index)

### Remaining Migrations

These migrations remain separate due to sequential changes:
- **0010_vector_index.sql** - Creates initial HNSW indexes (1536 dims)
- **0018_rag_optimize.sql** - Recreates HNSW with tuned params, adds tsvector
- **0024_embed_local.sql** - Changes dimension from 1536 to 1024
- **0027_user_facts_embedding_dimension.sql** - Changes user_facts dimension to 1024
- **0030_rag_chunks_document_id.sql** - Additional index (kept separate)

## Impact

- **Before**: 31 migrations
- **After**: 23 migrations (8 deleted)
- **Reduction**: 26% fewer migrations

## Next Steps

1. Delete consolidated migration files
2. Reset `_migrations` table if starting fresh
3. Update migration runner if needed
4. Test migrations against fresh database

