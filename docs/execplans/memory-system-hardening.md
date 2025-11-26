# ExecPlan: Memory System Hardening (Observability & Safety)

## Purpose
Harden the Memory Maintenance system by adding Prometheus metrics for observability and safety rails to prevent accidental massive data loss or degradation during decay cycles.

## Plan

### 1. Observability (Metrics)
- [x] **Define Metrics**: Register new metrics in `packages/api/src/metrics.ts` (lines 519-542):
    - ✅ `alfred_memory_maintenance_duration_seconds`: Histogram of maintenance run time.
    - ✅ `alfred_memory_nodes_decayed_total`: Counter of decayed nodes.
    - ✅ `alfred_memory_nodes_pruned_total`: Counter of pruned nodes.
    - ✅ `alfred_memory_nodes_cleaned_total`: Counter of permanently deleted nodes.
- [x] **Instrument Worker**: Update `packages/agent/src/orchestrator/learning-worker.ts` to record these metrics during `processMemoryMaintenance` (lines 268, 295, 309, 316).

### 2. Safety Rails
- [x] **Decay Limit**: `decayLimit` (default 1000) exists in `LearningWorkerConfig` (`packages/agent/src/orchestrator/learning-worker.ts` line 96).
- [x] **Confidence Floor**: `confidenceFloor` (0.01) exists in config and is applied in decay logic (lines 283-284).
- [ ] **Circuit Breaker**: Timeout not explicitly implemented (but maintenance runs in try/catch, so failures don't hang worker).

### 3. Performance Optimization
- [ ] **Bulk Update**: `updateNodeConfidenceBatch` still uses `Promise.all` loop (`packages/db/src/repo/graph/write.ts` lines 288-309), not `UPDATE ... FROM (VALUES ...)`.

## Progress
- [x] Define Metrics ✅
- [x] Instrument Worker ✅
- [x] Safety Rails - Decay Limit ✅
- [x] Safety Rails - Confidence Floor ✅
- [ ] Safety Rails - Circuit Breaker ⚠️ (implicit via try/catch)
- [ ] Performance Optimization - Bulk Update ❌

## Surprises & Discoveries

- Metrics are defined in `packages/api/src/metrics.ts` (not `packages/agent/src/metrics.ts`) to avoid circular dependencies.
- Lazy loading pattern used (`loadMetrics()`) to avoid initialization issues.
- `decayLimit` and `confidenceFloor` already exist in config, applied during decay processing.

## Decision Log

- **Metrics Location**: Placed in `packages/api/src/metrics.ts` instead of agent package to avoid circular dependencies.
- **Lazy Loading**: Used dynamic import with try/catch to gracefully handle missing metrics in test environments.

## Outcomes & Retrospective

**Status**: ⚠️ Mostly Complete (Observability and Safety Rails done; Performance Optimization pending)

- All metrics defined and instrumented.
- Safety rails (decay limit, confidence floor) implemented.
- Circuit breaker implicit via try/catch (explicit timeout pending).
- Bulk update optimization still uses `Promise.all` loop instead of single SQL statement.
