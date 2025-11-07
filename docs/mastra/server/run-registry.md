# Run Registry Multi-Instance Plan

## Current Behaviour

- `packages/api/src/run-registry.ts` exports `MemoryRunRegistry`, a per-process map from `runId` to `{ resume, cancel, abortController }`.
- `packages/api/src/routers/workflow.ts` registers workflow runs with their handlers when `workflow.start` launches, and removes them on completion or cancellation.
- A `workflow.resume` mutation resolves the run handle by `runId` and invokes `resume`. When the run is not present in the local map the API returns `run_not_found`.

This design assumes that follow-up requests (resume, cancel) land on the same API instance that launched the run. Horizontal replicas, process restarts, or hot reloads drop the in-memory entry and make resumption impossible.

## Multi-Instance Failure Modes

- **Stateless load balancers:** Subsequent resume calls may hit a different replica, which lacks the in-memory entry and returns `run_not_found`.
- **Process restart / deploy:** In-flight runs lose their handles, so resumes fail even if routed back to the original host.
- **Replica crash mid-run:** The abort controller is garbage collected. Clients receive no signal about the lost run.
- **Hot reload in dev:** Vite HMR disposes the module, clearing the registry and aborting active runs without a resumable handle.

Short-term mitigation is to force sticky sessions or single-instance operation, but this constrains production scaling.

## Redis Registry Roadmap

### Goals

1. Allow any replica to accept resume requests while delivering them to the owning instance.
2. Provide bounded-lifetime metadata so orphaned runs clean up automatically.
3. Surface explicit status when a run’s owning instance disappears.

### Instance Identity

- Each API worker publishes a stable `instanceId` (e.g. `${hostname}:${pid}:${bootTime}`) and stores it in local memory.
- On process start we register a heartbeat key `run:workers:<instanceId>` with an expiry (e.g. 30 s) and refresh it every 10 s via `PEXPIRE`.

### Run Registration

When a run starts:

1. Keep the existing in-memory Map for fast local lookups.
2. `SET run:meta:<runId> JSON.stringify({ instanceId, createdAt, expiresAt, status: "running" })` with `EX <timeout>` (default 15 minutes).
3. Add the run to a Redis set `run:active:<instanceId>` with the same TTL to support crash detection.

### Resume Delivery

1. `workflow.resume` first reads `run:meta:<runId>`.  
   - If missing, return `run_not_found` immediately.  
   - If the stored `instanceId` matches the local worker, handle synchronously via the in-memory registry.
2. Otherwise publish to a channel `run:resume:<instanceId>` with payload `{ runId, payload, traceId }`.
3. Each worker subscribes to `run:resume:<instanceId>` on boot. On message:
   - Verify the run is still present in the local Map.
   - Invoke `resume` and respond via `PUBLISH run:resume:ack:<traceId>` if the caller expects confirmation.
4. The public API call blocks on the ack channel (with timeout), returning success on ack, `run_not_found` if the owning instance no longer has the handle, or `run_expired` if Redis metadata expired.

### Completion & Expiry

- On normal completion unregister locally, delete `run:meta:<runId>`, and `SREM run:active:<instanceId> <runId>`.
- If the owning instance crashes (heartbeat key expires), a maintenance worker scans `run:active:<instanceId>` and marks their metadata as `status: "lost"` so resume callers receive `run_lost`.
- TTL expiry implies the run has exceeded its retention window; resume requests should return `run_expired`.

### Cancel Propagation

- Mirror the resume flow: publish to `run:cancel:<instanceId>` with the same ack semantics to trigger `cancel()` on the owning worker.

## Implementation Checklist

1. Introduce a `RedisRunRegistry` implementing the existing `RunRegistry` contract and switch `workflowRouter` to use it when `RUN_REGISTRY_URL` (or equivalent) is configured.
2. Add process-level heartbeat management and graceful shutdown cleanup for active runs.
3. Extend the resume/cancel mutations to publish and await acknowledgements for cross-instance deliveries.
4. Update observability: expose metrics for `run_registry_active`, `run_registry_misses_total`, and `run_registry_redis_latency_seconds`.
5. Use Bun’s native Redis client (`import { redis, RedisClient } from "bun"`) for low-latency pub/sub inside the API runtime.
6. Document deployment requirements: Redis with keyspace notifications enabled for the subscribed channels, plus recommended TTL values.

Until the Redis registry lands, operate the workflow API in a single-instance configuration (or ensure sticky routing) to avoid dropped resumes.
