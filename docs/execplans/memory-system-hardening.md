# ExecPlan: Memory System Hardening (Observability & Safety)

## Purpose
Harden the Memory Maintenance system by adding Prometheus metrics for observability and safety rails to prevent accidental massive data loss or degradation during decay cycles.

## Plan

### 1. Observability (Metrics)
- [ ] **Define Metrics**: Register new metrics in `packages/agent/src/metrics.ts` (create if missing) or `packages/api/src/metrics.ts`:
    - `alfred_memory_maintenance_duration_seconds`: Histogram of maintenance run time.
    - `alfred_memory_nodes_decayed_total`: Counter of decayed nodes.
    - `alfred_memory_nodes_pruned_total`: Counter of pruned nodes.
    - `alfred_memory_nodes_cleaned_total`: Counter of permanently deleted nodes.
- [ ] **Instrument Worker**: Update `packages/agent/src/orchestrator/learning-worker.ts` to record these metrics during `processMemoryMaintenance`.

### 2. Safety Rails
- [ ] **Decay Limit**: Add `MAX_DECAY_PER_CYCLE` (default 1000) to configuration to throttle massive updates.
- [ ] **Confidence Floor**: Modify `updateNodeConfidence` query to ensure confidence never drops below `0.01` unless pruned.
- [ ] **Circuit Breaker**: Add a timeout (e.g., 30s) to the maintenance function to prevent it from hanging the worker loop indefinitely.

### 3. Performance Optimization
- [ ] **Bulk Update**: Refactor `updateNodeConfidenceBatch` in `packages/db/src/repo/graph.ts` to use a single SQL `UPDATE ... FROM (VALUES ...)` statement instead of `Promise.all` loop. This significantly reduces DB roundtrips.

## Progress
- [ ] Define Metrics
- [ ] Instrument Worker
- [ ] Safety Rails - Decay Limit
- [ ] Safety Rails - Confidence Floor
- [ ] Safety Rails - Circuit Breaker
- [ ] Performance Optimization - Bulk Update

## Surprises & Discoveries
*(To be filled during execution)*

## Decision Log
*(To be filled during execution)*

## Outcomes & Retrospective
*(To be filled upon completion)*
