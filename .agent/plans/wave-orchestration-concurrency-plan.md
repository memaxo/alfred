# Wave Orchestration Concurrency And Resource Controls

This ExecPlan is a living document and must be maintained per `.agent/PLANS.md`. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date while implementing the plan.

## Purpose / Big Picture

Today each wave claims to launch multiple agents in parallel yet `packages/runtime/src/orchestrator/waves.ts` iterates sequentially, so `maxParallel` merely caps wave size without impacting runtime concurrency. That mismatched behavior confuses operators, hides resource contention, and prevents us from throttling workloads based on actual system pressure. This plan introduces true per-wave parallelism with explicit backpressure and metrics so we can prove how many agents run simultaneously, pause launches when CPU or memory are constrained, and expose wave durations in Prometheus. After completion, a run with `maxParallel=3` will actually execute up to three agents at once, queue additional agents when `ResourceGate` reports high load, and emit observability showing concurrency levels and resource ratios.

## Progress

- [x] (2025-11-26T18:20:00Z) Captured current sequential behavior, confirmed requirements, and authored this ExecPlan.
- [ ] Parallelize per-wave agent execution via a semaphore plus completion-order dispatcher so events stream as each agent finishes.
- [ ] Add resource backpressure (memory + CPU thresholds) and wire metrics for concurrency, wave duration, and resource utilization.
- [ ] Update runtime tests/docs to reflect the new concurrency model and run targeted `bun test` suites.
- [ ] (2025-11-26T18:32:00Z) Baseline `bun test packages/runtime/test/waves.execution.test.ts` run failed because Bun attempted to load `packages/agent/src/orchestrator/tool/codex/exec.js` before mocks, raising `buildTurnOptions` export errors; will investigate while updating tests.

## Surprises & Discoveries

- Observation: Baseline runtime wave test currently fails with `SyntaxError: Export named 'buildTurnOptions' not found` when Bun loads `packages/agent/src/orchestrator/tool/codex/exec.js` despite `mock.module` stubs.
  Evidence: `bun test packages/runtime/test/waves.execution.test.ts` on 2025-11-26 emitted the error before any specs ran; will need to ensure mocks register before imports (likely due to ESM export drift) while touching the test harness.

## Decision Log

- Decision: Treat `maxParallel` as the desired concurrency for both wave sizing and execution, implementing real parallelism instead of renaming variables.
  Rationale: Aligns with existing configuration, avoids breaking callers, and fulfills the documented promise of `planWaves`.
  Date/Author: 2025-11-26 / coding agent

## Outcomes & Retrospective

- Pending completion of implementation and validation.

## Context and Orientation

The orchestrator decomposes the user requirement into subtasks, groups them into waves (`planWaves` in `packages/agent/src/orchestrator/multi/spawn.ts`), and then iterates each agent spec in `packages/runtime/src/orchestrator/waves.ts`. Despite `maxParallel` implying concurrency, the current `for (const spec ...) { await toolCodex.execute(...) }` loop runs agents sequentially, so waves merely enforce dependency ordering. No resource-aware throttling exists, and metrics only cover phase- or AI-level operations. `packages/runtime/src/metrics.ts` hosts Prometheus counters/histograms used throughout runtime; we will add new gauges/histograms there. Tests live under `packages/runtime/test`, notably `waves.execution.test.ts` that mocks Codex. We need new coverage demonstrating concurrency/backpressure decisions.

## Plan of Work

1. **Document intent inside `waves.ts`.** Add a module-level comment clarifying that waves now execute in parallel up to `maxParallel`, describe the semaphore/backpressure strategy, and note how partial failures propagate.
2. **Introduce a reusable `ResourceGate`.** Create `packages/runtime/src/orchestrator/resource-gate.ts` housing a small class that samples `process.memoryUsage()` and `os.loadavg()`, compares against configurable thresholds (env-backed with safe defaults), emits resource-usage gauges, and exposes `waitForCapacity(signal)` plus `recordSample(state)` helpers. Add focused unit tests to validate threshold logic by mocking samplers.
3. **Add new metrics.** In `packages/runtime/src/metrics.ts`, define `runtimeWaveConcurrentAgents` (Gauge), `runtimeWaveDurationSeconds` (Histogram), and `runtimeResourceUsageRatio` (Gauge with `resource`/`state` labels) so instrumentation stays centralized. Export them for use in orchestrator modules.
4. **Refactor `runWaves` execution loop.**
   - Instantiate a `Semaphore` (from `@alfred/agent/utils/rate-limiter`) sized by `maxParallel` per run, plus the new `ResourceGate`.
   - Extract the existing per-agent body into `async function executeAgent(spec): Promise<AgentExecution>`, returning events, tracker deltas (already applied inline), and outcome metadata.
   - Before launching heavy work, call `resourceGate.waitForCapacity(signal)`; once admitted, acquire the semaphore and increment `runtimeWaveConcurrentAgents` gauge. Release/decrement in `finally`.
   - Launch all agents for the wave immediately, collecting promises. Use a helper to await them in completion order (so events flush as soon as each agent finishes) and accumulate `agentOutcomes` just like today. On rejection, guard so one agent error does not crash the wave; record status as failed, capture reason, and continue unless escalation heuristics already break.
   - Replace the sequential `for` loop with the completion-order dispatcher, ensuring we still respect `signal.aborted`, escalate on `ESCALATION-*` files, and append ExecPlan progress updates.
5. **Handle partial failures explicitly.** Ensure that `Promise.allSettled`/dispatcher results differentiate between agent-level failures versus orchestrator aborts. Bubble fatal errors (e.g., `AbortError`) but continue processing other agents, marking `stuck`/`failed` states appropriately and logging.
6. **Add backpressure telemetry.** Whenever `ResourceGate` forces a wait, record the sample through `runtimeResourceUsageRatio` (labels `resource=cpu|memory`, `state=current|blocked`) and log structured notices so operators can correlate throttling with run IDs.
7. **Expand tests and docs.** Update `packages/runtime/test/waves.execution.test.ts` (and add a dedicated `waves.parallel.test.ts` if needed) to assert that multiple agents enter execution when `maxParallel>1`, that `toolCodex.execute` gets scheduled concurrently (via timestamp comparisons or mocked latches), and that the resource gate pauses launches when thresholds are exceeded. Refresh inline documentation/comments to describe the concurrency/backpressure contract.

## Concrete Steps

1. From repo root, run `bun test packages/runtime/test/waves.execution.test.ts` to ensure the current baseline passes before changes.
2. Implement metrics additions plus the new `ResourceGate`, then run `bun test packages/runtime/test/resource.gate.test.ts` (new) to validate threshold logic in isolation.
3. Refactor `runWaves` to use the semaphore + resource gate, update tests (`waves.execution.test.ts`, new concurrency-focused spec), and finish with `bun test packages/runtime` to cover the full runtime suite.

## Validation and Acceptance

- Running `bun test packages/runtime/test/waves.parallel.test.ts` must demonstrate that two mocked agents overlap in time when `maxParallel=2` and that throttling kicks in when environment variables force low CPU/memory thresholds.
- `bun test packages/runtime` should pass end-to-end, showing the orchestration changes integrate cleanly.
- When manually running the orchestrator with `ORCHESTRATOR_MAX_PARALLEL=3`, Prometheus metrics must expose `runtime_wave_concurrent_agents` rising above 1 while a wave executes, and `runtime_wave_duration_seconds` should emit one observation per wave with status labels reflecting success vs. partial.

## Idempotence and Recovery

The semaphore/resource-gate loop must tolerate restarts: sampling is read-only, and throttling merely waits, so rerunning the phase is safe. Workspace checkpoints continue to guard against agent crashes. If a run aborts mid-wave, the same hydration logic will skip completed waves on retry, so no irreversible steps are introduced by this change.

## Artifacts and Notes

- Capture new Prometheus metric names and their labels in inline comments so observers understand how to scrape them.
- Note in the module header comment that `maxParallel` has dual roles (wave sizing and concurrency cap) and reference the resource gate for clarity.

## Interfaces and Dependencies

- `packages/runtime/src/orchestrator/resource-gate.ts` exports `ResourceGate` plus `ResourceSample` so other runtime phases can reuse it if needed.
- `packages/runtime/src/metrics.ts` exports three new metrics: `runtimeWaveConcurrentAgents`, `runtimeWaveDurationSeconds`, and `runtimeResourceUsageRatio`.
- `packages/runtime/src/orchestrator/waves.ts` now imports `Semaphore` from `@alfred/agent/utils/rate-limiter` and the new metrics/resource gate, so ensure those modules remain tree-shakeable and server-friendly.

Document revisions must be noted in this plan’s `Decision Log` and `Progress` as milestones finish.
