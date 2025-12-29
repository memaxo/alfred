# Query Optimization Patterns

## Core Principle

Recursive CTEs for traversal. Indexes on frequently accessed fields. Push logic to database for performance.

## Rules

1. **Recursive CTEs.** Use PostgreSQL Recursive CTEs for all graph traversals (pathfinding, propagation). Write traversal logic in SQL not application code.

2. **HNSW indexes.** Create HNSW indexes with `m=16, ef_construction=100`. Always drop before `ALTER COLUMN TYPE` on vector columns. Recreate with `IF NOT EXISTS`.

3. **GIN indexes.** Create GIN indexes on `tsvector` columns for full-text search. Use `rag_chunks.content_tsvector` for sparse search.

4. **Index discipline.** Match composite indexes to query predicates. Add indexes when new queries added. Include frequently filtered columns.

5. **Hot query tests.** Write regression tests for every hot path query. Seed deterministic `memory_nodes`. Clean up after each run. Assert ordering.

6. **Query timeout.** All knowledge queries must complete <10ms (p99). Instrument queries before optimizing.

7. **JSON filtering.** Use SQL-level JSON filtering in queries: `json_extract(properties, '$.source')`. Avoid in-memory JSON filtering.

8. **Resource scoping.** Prefix node IDs with resource scope: `"runtime:<runId>"`. Filter by scope for isolation.

9. **Query batching.** Batch multiple graph queries when possible. Use single round-trip for related operations.

10. **Visualization routers.** Router must: extract entities, persist via `upsertNodes`/`upsertEdges`, filter with SQL JSON filtering, return bounded subgraph.

## See Also

- `.ruler/29-knowledge-graph.md` for graph patterns
- `.ruler/28-embeddings.md` for embedding standards
