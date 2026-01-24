# Memory System Architecture

## Overview

The ALFRED memory system is designed to mimic human cognitive processes, specifically the accumulation of knowledge (Learning) and the gradual fading of unused information (The Forgetting Curve). This ensures the knowledge graph remains relevant, performant, and focused on active concepts.

## Components

### 1. Learning Worker

The Learning Worker (`packages/agent/src/orchestrator/learning-worker.ts`) is a background process that runs alongside the API. It has two primary responsibilities:

- **Ingestion**: Polls for completed workflow runs, extracts facts/insights, and upserts them into the knowledge graph with embeddings.
- **Maintenance**: Periodically applies decay and pruning rules to the graph.

### 2. Knowledge Graph

The underlying storage is a property graph where:

- **Nodes** represent concepts (Facts, Insights, Patterns).
- **Edges** represent relationships.
- **Confidence** (0.0-1.0) indicates the strength/certainty of a memory.
- **Embeddings** allow for semantic retrieval (RAG).

## The Forgetting Curve (Memory Maintenance)

To prevent the graph from becoming stale or bloated, a decay algorithm runs periodically:

1.  **Decay**: Nodes that haven't been updated (touched/reinforced) within `MEMORY_DECAY_THRESHOLD_MS` have their confidence multiplied by `MEMORY_DECAY_FACTOR`.
2.  **Prune**: Nodes with confidence falling below `MEMORY_PRUNE_CONFIDENCE` are soft-deleted (archived).
3.  **Cleanup**: Archived nodes older than `MEMORY_CLEANUP_AGE_MS` are permanently deleted.

## Active Recall (Reinforcement)

To counteract decay, the system implements **Active Recall**:

- When a memory node is retrieved via Semantic Search (RAG), Graph Traversal, Knowledge Queries, or Visualization, it is "touched".
- **Touching** (`touchNodes()`) updates the `updated_at` timestamp (resetting the decay timer) and boosts `confidence` by `0.05` (capped at 1.0).
- **Access Tracking** (`recordAccess()` / `recordAccessBatch()`) increments `access_count` and updates `last_accessed_at` for analytics.
- This ensures that useful, frequently accessed memories remain fresh and high-confidence, while irrelevant noise fades away.

**Implementation Status:** ✅ Complete

- Integrated in: Knowledge Router (`visualize`), Knowledge Tool (`executeQuery`), RAG Retrieval (`retrieve`), Knowledge Engine (`retrieveContext`), Graph Router (`runQuery`)
- Functions: `touchNodes()`, `recordAccess()`, `recordAccessBatch()` in `packages/db/src/repo/graph/`

## Policy Integration

Memory confidence is exposed to the Policy Decision Point (PDP) via the `context.memoryConfidence` field. You can write policies to block high-risk actions (e.g., `deploy.create`) if they rely on low-confidence memories.

See `docs/guides/policy-confidence.md` for rule examples.

## Observability (Metrics)

Prometheus metrics exposed on `/api/metrics`:

- `memoryMaintenanceDurationSeconds` - Histogram of maintenance run time
- `memoryNodesDecayedTotal` - Counter of decayed nodes
- `memoryNodesPrunedTotal` - Counter of pruned nodes
- `memoryNodesCleanedTotal` - Counter of permanently deleted nodes

**Location:** `packages/api/src/metrics.ts` (lazy-loaded to avoid circular dependencies)

**Usage:** Monitor memory maintenance performance and identify decay/pruning patterns.

## Safety Rails

To prevent accidental massive data loss during decay cycles:

1. **Decay Limit**: Maximum nodes decayed per cycle (default: 1000)
   - Prevents runaway decay operations
   - Configurable via `decayLimit` in learning worker config

2. **Confidence Floor**: Minimum confidence threshold (default: 0.01)
   - Ensures confidence never drops below floor unless pruned
   - Applied during decay processing

3. **Circuit Breaker**: Implicit via try/catch error handling
   - Maintenance failures don't crash the API server
   - Errors logged with structured context

**Implementation:** `packages/agent/src/orchestrator/learning-worker.ts` lines 96-97

## Performance Optimization

### Current Implementation (Optimized)

Memory maintenance uses a set-based bulk update for confidence decay:

- `updateNodeConfidenceBatch` uses a single `UPDATE ... FROM (VALUES ...)` statement per chunk
- Avoids per-row DB roundtrips

```typescript
// ✅ OPTIMIZED: Single SQL statement
await db
  .update(memoryNodes)
  .set({
    properties: sql`
      CASE
        WHEN memory_nodes.properties IS NULL THEN jsonb_build_object('confidence', v.confidence)
        ELSE jsonb_set(memory_nodes.properties, '{confidence}', to_jsonb(v.confidence))
      END
    `,
    updated: sql`NOW()`,
  })
  .from(
    sql`(VALUES ${sql.join(
      updates.map((u) => sql`(${u.id}::uuid, ${u.confidence})`),
      sql`, `
    )}) AS v(id, confidence)`
  )
  .where(sql`memory_nodes.id = v.id`);
```

**Status:** Implemented in `packages/db/src/repo/graph/write.ts`.

**Reference:** `.ruler/19-drizzle-patterns.md` rule 10

## Configuration

The memory system is tunable via environment variables to support different "memory profiles" (e.g., photographic memory vs. fleeting attention).

| Variable                    | Default            | Description                                                                              |
| :-------------------------- | :----------------- | :--------------------------------------------------------------------------------------- |
| `MEMORY_DECAY_ENABLED`      | `true`             | Master switch for the maintenance loop. Set to `false` to disable all decay/pruning.     |
| `MEMORY_DECAY_INTERVAL_MS`  | `3600000` (1h)     | How often the maintenance job runs.                                                      |
| `MEMORY_DECAY_THRESHOLD_MS` | `86400000` (24h)   | The "grace period" before a memory starts decaying.                                      |
| `MEMORY_DECAY_FACTOR`       | `0.95`             | The multiplier applied to confidence during each decay cycle. Lower = faster forgetting. |
| `MEMORY_PRUNE_CONFIDENCE`   | `0.2`              | Confidence level at which a memory is considered "forgotten" and archived.               |
| `MEMORY_CLEANUP_AGE_MS`     | `2592000000` (30d) | How long to keep archived memories before permanent deletion.                            |

## Tuning Guide

### Scenario: High Retention (Photographic Memory)

To make ALFRED remember almost everything for a long time:

- `MEMORY_DECAY_FACTOR=0.99` (Very slow decay)
- `MEMORY_DECAY_THRESHOLD_MS=604800000` (1 week grace period)
- `MEMORY_PRUNE_CONFIDENCE=0.1` (Keep even faint memories)

### Scenario: High Focus (Short-term Context)

To make ALFRED focus only on recent, active context:

- `MEMORY_DECAY_FACTOR=0.80` (Fast decay)
- `MEMORY_DECAY_THRESHOLD_MS=43200000` (12h grace period)
- `MEMORY_PRUNE_CONFIDENCE=0.4` (Aggressive pruning)
