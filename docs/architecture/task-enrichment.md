# Task Enrichment Architecture

Owner: runtime

> For the unified view of all learning mechanisms, see [Learning System Overview](learning-system.md).

## Purpose

Enable executor runs to become progressively smarter by capturing failure contexts, propagating learnings, and enriching subsequent tasks with historical insights.

## Key Components

### Types (`@alfred/type/enrichment.ts`)

- `FailureContext` - Aggregates tool errors, loop detections, escalations, review failures
- `StructuredHandoff` - Rich wave-to-wave context with decisions, blockers, tools to avoid
- `RetryResolution` - Links failure to successful fix with delta description
- `TaskEnrichment` - Combined enrichment data injected into tasks
- `LiveError` - Real-time error streaming between sibling agents

### AgentFS Layer (`@alfred/agent/agentfs/`)

- `keys.ts` - Centralized KV key conventions
- `enrichment.ts` - Persist/query helpers for failure contexts, handoffs, resolutions
- `stream.ts` - Live error emission and aggregation

### Plan Layer (`@alfred/plan/enrich/`)

- `index.ts` - Query enrichment from DB, apply to tasks, generate resolution deltas
- `propagate.ts` - Upstream failure propagation through dependencies

### Runtime Layer (`@alfred/runtime/orchestrator/`)

- `handoff.ts` - Build structured handoffs from wave outcomes
- `waves.ts` - Integrate handoff building after wave completion
- `outcome.ts` - Finalize outcomes with failure context

### DB Layer (`@alfred/db/repo/codex-learning.ts`)

- `findSimilarByEmbedding()` - pgvector similarity search
- `findSimilarWithFallback()` - Embedding + keyword fallback
- `createHeuristicFromFailure()` - Provenance-tracked heuristics
- `recordCodexExecution()` - Execution recording for future similarity

## Data Flow

```
Agent Execution
      │
      ▼
Tool Errors ──► buildFailureContext() ──► AgentFS KV
      │                                        │
      ▼                                        ▼
Wave Complete ──► buildStructuredHandoff() ──► AgentFS KV
      │                                        │
      ▼                                        ▼
Retry Success ──► createRetryResolution() ──► AgentFS KV
                                               │
                                               ▼
New Task ◄────── queryTaskEnrichment() ◄────── DB + KV
      │
      ▼
applyEnrichmentToTask() ──► Enriched requirement text
```

## Metrics

16 Prometheus metrics in `@alfred/metrics/enrichment.ts`:

- Query counts (success/failure)
- Tasks enriched with sources breakdown
- Failure contexts created by status
- Handoffs built
- Retry resolutions recorded
- Upstream propagation counts
- Embedding search hits/misses
- Live error emissions

## Usage

```typescript
// Enrich a task before decomposition
const enrichment = await queryTaskEnrichment(task, {
  runId: 'run-123',
  resource: 'repo/name',
});
const enrichedTask = applyEnrichmentToTask(task, enrichment);

// Create retry resolution after successful retry
await createRetryResolution(agent, {
  taskId: 'task-1',
  runId: 'run-123',
  attempt: 2,
  failureContext: priorFailure,
  successContext: { toolsUsed: [...], filesChanged: [...], durationMs: 5000 },
  delta: await generateResolutionDelta(priorFailure, successContext),
});
```

## Runtime status mapping

- Runtime `AgentOutcome.status` values are mapped to enrichment statuses for persistence:
  - `completed` → `success`
  - `failed` → `failure`
  - `stuck` → `stuck`
  - `timeout` → `timeout`
  - `escalated` → `escalated`

## Production readiness

- **Schema compatibility.** Persisted enrichment payloads include `schemaVersion`/`createdAt`; reads validate and ignore incompatible data.
- **PII/secret safety.** Persisted text and params are redacted and truncated using `redactSecrets()`/`redactObject()` plus `enrichCaps`.
- **Non-blocking + bounded.** Enrichment persistence/query paths are gated behind `ALFRED_ENRICHMENT=1` and wrapped in short timeouts.
- **Retention.** DB history cleanup is scheduled behind `SCHED_ENRICH_CLEANUP=1` with `ALFRED_ENRICHMENT_DB_RETENTION_DAYS` (default 30).
- **Similarity hardening.** Embedding search validates dimensions/finite values, clamps limits/similarity, and filters low-similarity matches.

## Testing

- DB integration (pgvector): `RUN_DB_TESTS=1 bun test packages/db/test/codex-learning.integration.test.ts`
- AgentFS KV integration (Docker + image): `bun test packages/agent/test/agentfs-enrichment.integration.test.ts`
- Two-run E2E: `RUN_DB_TESTS=1 bun test tests/enrichment.integration.test.ts`
