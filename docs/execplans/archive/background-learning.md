# Constant Background Learning

This ExecPlan is maintained in accordance with `.agent/PLANS.md`; all sections reflect the current state so future contributors can rely on it as the single source of truth.

## Purpose / Big Picture

Enable ALFRED to "dream" in the background by continuously extracting knowledge from completed workflows without impacting interactive latency. A resilient worker polls persisted runs, filters ones that have not been learned, and writes structured knowledge into the hypergraph.

## Progress

- [x] (2025-05-18 04:20Z) Added `learned_at` column/migration in `packages/db/src/schema/workflow.ts` so runs can be marked as processed.
- [x] (2025-06-02 19:10Z) Implemented `packages/agent/src/orchestrator/learning-worker.ts` with polling, extraction via `@alfred/knowledge`, and `upsertNodes`/`upsertEdges` persistence.
- [x] (2025-06-05 15:45Z) Integrated the worker via `startLearningWorker()` inside `packages/api/src/init.ts`, gated by `ENABLE_LEARNING_WORKER`.
- [x] (2025-06-05 16:00Z) Documented the toggle in `config/env.example` and defaulted it to `0`.
- [x] (2025-06-07 21:30Z) Added `packages/agent/test/learning-worker.integration.test.ts` to validate end-to-end extraction and pruning behavior.

## Surprises & Discoveries

- Observation: Polling directly off `workflow_runs` was reliable but introduced back-pressure when large batches existed; batching at 10 runs with exponential backoff eliminated lock contention.
  Evidence: `packages/agent/test/learning-worker.integration.test.ts` exercises the batching logic with mocked delays.

## Decision Log

- Decision: Adopt a pull-based worker that queries the DB instead of an event bus.
  Rationale: Ensures durability—if the API pod restarts, the worker simply resumes at the last unlearned row.
  Date/Author: 2025-05-12 / Memory Team.

## Outcomes & Retrospective

- The background worker now keeps the knowledge graph in sync without needing manual commands. Latency-sensitive assistants remain unaffected because extraction happens out-of-band. The remaining work for this initiative is operational tuning rather than core implementation, so this ExecPlan is considered complete.

## Context and Orientation

- **Source of Truth**: `workflow_runs` captures every workflow including assistant chats; the worker updates each record's `learned_at` to avoid duplicate learning.
- **Extraction Logic**: `packages/knowledge/src/extractor.ts` plus `toKnowledge` convert transcripts to nodes/edges.
- **Worker Host**: Implementation lives in `packages/agent`, but it is started from `packages/api/src/init.ts` so it shares the same lifecycle as the API server.

## Plan of Work (Completed)

1. Extend the workflow schema to record `learned_at` timestamps and migrate the database.
2. Implement the learning worker with batching, knowledge extraction, and persistence helpers.
3. Wire the worker into API startup behind `ENABLE_LEARNING_WORKER` and expose configuration in `config/env.example`.
4. Write integration tests that insert completed runs, run the worker, and assert graph mutations plus `learned_at` updates.

## Validation and Acceptance

- `bun test packages/agent/test/learning-worker.integration.test.ts` passes and fails before the worker change.
- With `ENABLE_LEARNING_WORKER=1`, starting the API results in automatic learning (observable via logs and by checking `workflow_runs.learned_at IS NOT NULL`).

## Revision Note

- (2025-11-24) Marked all work items complete, captured the actual implementation details, and prepared this ExecPlan for archival so it no longer conflicts with the shipped worker.
