# Linear Activity Rate Limiting

This ExecPlan is a living document. Maintain it according to `.agent/PLANS.md`; keep Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective sections updated as work proceeds.

## Purpose / Big Picture

Linear currently receives a Codex activity for every event, so long runs can generate hundreds of requests and overwhelm the API. This plan introduces per-session sliding-window rate limiting, execution-wide caps, and batching so that Mindscape and Linear captures stay readable while preserving observability. After implementation, an operator can run any workflow and observe that no session emits more than 10 activities per minute or 50 per execution, bursts collapse into concise summaries, and metrics/logs show when backpressure occurs.

## Progress

- [x] (2025-11-26 05:52Z) Draft ExecPlan, capture context, and outline implementation steps.
- [x] (2025-11-26 06:06Z) Implement sliding-window + execution cap state in `codex-linear.ts` and wire it into event mapping.
- [x] (2025-11-26 06:06Z) Add batching/debouncing logic with 2s window (configurable for tests) and summarization for duplicate event types.
- [x] (2025-11-26 06:06Z) Surface graceful degradation: log dropped events, emit summary activity when rate limited, and track metrics.
- [x] (2025-11-26 06:06Z) Add/update metrics counters and ensure they are exported + tested (unit tests or integration harness).
- [x] (2025-11-26 06:07Z) Validate via focused tests (`packages/agent/test/codex-linear.test.ts`) and manual reasoning walkthrough; update docs/plan outcomes.

## Surprises & Discoveries

- Observation: Deleting per-session limiter state after every flush prevented the sliding window counters from persisting, so rate limiting never triggered until activityCount was retained between batches.  
  Evidence: Early test runs showed 12 emissions in <200 ms despite a 10/minute cap; retaining state until the total cap is exhausted fixed the issue and the tests now assert two dropped events with `linear_activity_rate_limited` logs (see `packages/agent/test/codex-linear.test.ts`).
- Observation: Bun's `vi` helpers do not expose fake timers yet, so deterministic batching tests required configurable timing rather than relying on `useFakeTimers`.  
  Evidence: Added `setCodexLinearTimingConfig` to shrink batch/window durations during tests; the suite now completes in ~3 s instead of waiting for real 2 s/60 s windows.

## Decision Log

- Decision: Keep per-session limiter state in memory until the execution cap is exhausted (instead of clearing it after each flush) so sliding windows and total counts persist.  
  Rationale: The initial cleanup deleted state after every emission, which reset the counters and made rate limits ineffective.  
  Date/Author: 2025-11-26 / codex-linear-rate-limit
- Decision: Add `setCodexLinearTimingConfig` to override batch/window durations for tests instead of relying on fake timers that Bun does not yet implement.  
  Rationale: Needed deterministic, fast tests without waiting 2 s per batch or 60 s for summaries.  
  Date/Author: 2025-11-26 / codex-linear-rate-limit
- Decision: Extend `configureCodexLinearMetrics` to accept optional counters for emitted/dropped/batch states so API routers can wire Prometheus metrics alongside the existing latency histogram.  
  Rationale: Requirements call for new metrics, and keeping configuration centralized prevents import cycles in agent packages.  
  Date/Author: 2025-11-26 / codex-linear-rate-limit

## Outcomes & Retrospective

- Implemented sliding-window (10/min) and execution (50/run) guards with graceful summaries so Linear stays readable even during long Codex workflows. State now persists per `linearSessionId` until the run exhausts its quota, ensuring limits are enforced consistently. Metrics counters (`codex_linear_activities_emitted_total`, `_dropped_total`, `_activity_batches_total`) expose visibility into batching vs. rate limiting, and the API router wires them automatically. The focused `bun test packages/agent/test/codex-linear.test.ts` suite proves batching, window caps, and total limits all behave as intended. Remaining follow-up: consider long-lived session cleanup once we have a lifecycle signal from the orchestrator.

## Context and Orientation

`packages/agent/src/orchestrator/tool/codex-linear.ts` maps `AlfredCodexEvent` objects (thought/command/output/artifact) into Linear activities via `emitLinearActivity`. No rate limiting exists; each call immediately posts. `CodexToolInput` supplies `linearSessionId`, `linearSpace`, and `linearAuthz`. Metrics currently capture only latency histograms. We must add in-memory state per `linearSessionId` to enforce both a sliding window (≤10 per minute) and execution total (≤50). These limits should persist across all events in a given orchestrator run so the Linear session is never overwhelmed.

Existing utilities:

- `emitLinearActivity(type, payload)` handles the actual Linear API call; we can wrap it with new batching/rate limiting without editing the helper.
- `logger` from `@alfred/metrics` is used for warnings; we can extend logs here for dropped/batched events.
- Metrics registry already exports histograms; we will add counters/histograms as needed via `configureCodexLinearMetrics`.

## Plan of Work

1. Extend module-level state to track per-session data: a `Map<string, { activityCount: number; windowStart: number; totalEmitted: number; pending: BatchedEvent[]; timer?: NodeJS.Timeout }>` keyed by `linearSessionId`. Expose helpers to fetch and reset state per execution (using optional exported `resetLinearActivityLimiter` for tests).
2. Implement a sliding-window check: when an event arrives, prune counts older than 60s using `windowStart` timestamp; if the minute window is full (>=10) or total emitted >=50, mark the event as rate-limited. Rate-limited events append to an aggregation buffer with reason.
3. Introduce a 2-second debounce window per session: queue events (with timestamps and event metadata) and flush via `setTimeout`. When flushing, group consecutive events of the same `event.type` (and for commands include status/command string) to produce summary payloads (e.g., “3 thoughts in last 2s” plus concatenated highlights). Emit a single Linear activity per batch respecting the limits.
4. When rate limits trigger, craft a summary activity describing how many events were dropped and why (window or total cap). Ensure we still increment totals for actual emitted summaries but not for suppressed events.
5. Add metrics using `@alfred/metrics` counters (e.g., `codexLinearActivitiesEmitted`, `codexLinearActivitiesRateLimited`, `codexLinearActivityBatches`). Extend `configureCodexLinearMetrics` to accept these counters (or create a composite struct) and wire increments when activities emit, when batches flush, and when drops happen.
6. Update logging: for every dropped event, log `linear_activity_rate_limited` with session ID, event type, and reason. For batches, log `linear_activity_batch_emit` summarizing counts.
7. Create or update tests under `packages/agent/src/orchestrator/tool/__tests__/codex-linear.test.ts` to validate:
   - Sliding window respects 10/min using fake timers.
   - Total cap of 50 halts further emissions.
   - Debounce merges rapid events and produces aggregated activity bodies.
   - Rate-limited summaries still emit once and log metrics.
   These tests can mock `emitLinearActivity` and metrics to avoid real network calls.
8. Document new helpers (inline comments) and ensure exports stay pure for other modules; expose reset helper for tests.

## Concrete Steps

1. Update `codex-linear.ts` per Plan of Work; add necessary helper types and counters.
2. Extend `packages/agent/test/codex-linear.test.ts` and run `bun test packages/agent/test/codex-linear.test.ts`, using `setCodexLinearTimingConfig` overrides to keep batches/windows short while still exercising limits.
3. (Optional) Run the broader `bun test packages/agent` suite if time permits; for this iteration we validated via the focused codex-linear suite.

## Validation and Acceptance

- Start from repo root.
- Run `bun test packages/agent/test/codex-linear.test.ts` and expect the new limiter specs to pass (they fail prior to the implementation).
- Simulate a Codex workflow (unit test) to assert no more than 10 events per minute per session; confirm summarization output in test snapshots/matchers.
- Confirm logs (spied via mock logger) fire for dropped events.
- Inspect metrics counters via mocks to ensure increments line up with acceptance criteria.

## Idempotence and Recovery

All state resides in-memory per process; `resetLinearActivityLimiter` helper will clear maps between tests. The limiter logic is additive and guards emissions; no destructive changes occur. If errors occur during batching, the code should fallback to immediate logging and skip emission while preserving future batches (add try/catch around flush logic).

## Artifacts and Notes

(Add excerpts such as sample summary payload once available.)

## Interfaces and Dependencies

- `emitLinearActivity(type, payload)` remains the emission surface.
- Introduce new internal helper `getSessionLimiter(sessionId)` returning the tracked state.
- Add exported `configureCodexLinearMetrics` signature updates to accept counters: `activitiesEmitted`, `activitiesDropped`, `activityBatches`, plus the existing histogram. Provide default no-op implementations when not configured.
- Unit tests should mock `emitLinearActivity` via `vi.mock("../linear")` and intercept metrics via local stubs.
