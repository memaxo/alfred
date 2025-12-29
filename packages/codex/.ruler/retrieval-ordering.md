# Retrieval Ordering Patterns

## Core Principle

Retrieval orders by confidence and recency. Combine structured search (graph) and vector similarity. Use 2-hop traversal.

## Rules

1. **Confidence scoring.** Sort retrieval results by confidence descending. Use confidence primary, secondary metrics as tiebreakers.

2. **Recency boost.** Apply positive weight to recently accessed memories. Boost by 0.02-0.05 within last hour.

3. **Semantic ordering.** Use `cosineSimilarity` from `@alfred/embed` for embedding-based similarity. Never duplicate implementations.

4. **Graph traversal.** Retrieve via 2-hop graph traversal from query nodes. Return structured relations (explains, depends).

5. **Hybrid retrieval.** Combine semantic search (vector) and structural search (graph). Merge results with weighted scoring.

6. **Fetch limit accounting.** Use `fetchLimit = k * 3` to account for threshold filtering. Return at most k results after filtering.

7. **Entity fact filtering.** Use `parseEntityFactLabel` from `@alfred/knowledge/entity` for entity extraction. Never duplicate parsing logic.

8. **Scoped retrieval.** Fetch user-scoped and `runtime:<id>` resources first. Fall back to global nodes only when no scoped results exist.

9. **Archive exclusion.** Exclude archived nodes from retrieval by default. Include only when explicitly requested.

10. **Result deduplication.** Deduplicate results by node ID. Never return same memory multiple times.

## See Also

- `.ruler/29-knowledge-graph.md` for knowledge graph patterns
