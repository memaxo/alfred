# ExecPlan: Learning Worker Integration Tests

## Purpose

Verify the reliability and correctness of the memory maintenance loop (Confidence Decay, Pruning, Cleanup) implemented in the Learning Worker, ensuring it functions correctly alongside the standard learning loop without regression.

## Plan

- [ ] **Refactor Test Harness**: Update `packages/agent/test/learning-worker.integration.test.ts` to allow mocking of the new database repository methods (`findNodesForDecay`, `updateNodeConfidenceBatch`, etc.).
- [ ] **Test Maintenance Trigger**: Verify that `processMemoryMaintenance` is called only after the configured `maintenanceIntervalMs` elapses.
- [ ] **Test Decay Logic**: Simulate stale nodes and assert that `updateNodeConfidenceBatch` is called with correctly calculated decayed values.
- [ ] **Test Pruning Logic**: Simulate nodes below the confidence threshold and assert `archiveNodes` is called with the correct IDs.
- [ ] **Test Cleanup Logic**: Simulate archived nodes past the retention period and assert `deleteArchivedNodes` is called.
- [ ] **Concurrency Check**: Ensure maintenance tasks do not block or interfere with the primary `processUnlearnedRuns` loop.

## Progress

- [x] Refactor Test Harness
- [x] Test Maintenance Trigger
- [x] Test Decay Logic
- [x] Test Pruning Logic
- [x] Test Cleanup Logic
- [x] Concurrency Check

## Surprises & Discoveries

- The existing test harness was mostly sufficient but needed updating to use the correct import path (`@alfred/db/repo/graph/index`) matching the recent refactor.
- The concurrency test relies on the fact that async operations in the worker (processing runs and maintenance) happen sequentially in the event loop tick but within the same `setInterval` callback. We verified that _both_ effects occur.

## Decision Log

- Decided to use simple `setTimeout` delays to allow the worker loop to tick, which is effective for integration testing without mocking `setInterval` excessively.

## Outcomes & Retrospective

- All maintenance logic (Decay, Prune, Cleanup) is now covered by integration tests.
- Verified that maintenance respects the interval configuration.
- Confirmed that maintenance does not block the primary learning loop (both can execute).
