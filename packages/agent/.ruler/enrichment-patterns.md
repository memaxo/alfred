# Task Enrichment Patterns

## Core Principle

Execution outcomes (failures, fixes, patterns) enrich subsequent runs on related tasks. The system becomes progressively smarter through closed-loop learning.

## Rules

1. **Type foundation.** Define enrichment types in `@alfred/type/enrichment.ts` using Zod schemas. Export all types from the package index.

2. **KV key conventions.** Centralize AgentFS KV keys in `agentfs/keys.ts` with prefixes: `failure:`, `live-error:`, `retry:`, `handoff:`, `learnings:`, `decisions:`.

3. **Failure context capture.** Build failure context from AgentFS audit trail using `buildFailureContext()`. Include tool errors, loop detections, escalations, and review failures.

4. **Structured handoffs.** Wave-to-wave handoffs include: files modified/created/deleted, decisions with rationale, tools to avoid, blockers, and open questions.

5. **Embedding similarity.** Use pgvector `<=>` operator for semantic similarity search with keyword fallback via `findSimilarWithFallback()`.

6. **Upstream propagation.** Propagate failures transitively through task dependencies. Collect tools to avoid from all upstream failures.

7. **Heuristic provenance.** Track `sourceRunId`, `sourceTaskId`, `sourceError`, `sourceStatus` when creating heuristics from failures for full traceability.

8. **Retry resolution.** Link failures to successful fixes with `failureContext`, `successContext`, and `delta` describing what changed.

9. **Live error streaming.** Emit errors to AgentFS KV for sibling agent awareness. Use `isToolFailing()` to detect repeated failures.

10. **Resolution delta.** Use LLM to generate human-readable fix summaries with `generateResolutionDelta()`. Provide heuristic fallback when offline.

11. **Metrics coverage.** Emit Prometheus metrics for: queries, enriched tasks, failure contexts, handoffs, retry resolutions, upstream propagation, embedding searches, live errors.

12. **Non-blocking persistence.** Enrichment persistence (handoffs, failure contexts) should be fire-and-forget to avoid slowing the critical path.

13. **Runtime status mapping.** Persist enrichment failure contexts only for non-success outcomes; map runtime statuses to enrichment statuses (`completed→success`, `failed→failure`, `stuck→stuck`, `timeout→timeout`, `escalated→escalated`).

14. **Integration test gating.** Postgres-backed suites must be gated behind `RUN_DB_TESTS=1`; Docker-backed AgentFS suites must `skipIf` Docker/image are unavailable.
