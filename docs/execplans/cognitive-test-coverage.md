# Cognitive Pipeline Test Coverage

This ExecPlan is a living document. Maintain every section per `.agent/PLANS.md` so a newcomer can complete and continue the effort autonomously.

## Purpose / Big Picture

The cognitive pipeline currently has unit tests for physiology and reasoning but no assurance that real event streams, persistence, orchestrator flows, or UI entry points behave correctly. This plan delivers layered coverage so we can replay a synthetic conversation end-to-end, assert cognitive state transitions, and detect regressions before they reach production. After completion, a developer can run targeted Bun test suites plus an orchestration verification script to watch inputs propagate from the UI through runtime, API, and persistence with metrics proving success.

## Progress

- [x] (2025-11-24 18:30Z) Captured current gaps and authored this ExecPlan so work can proceed in tracked milestones.
- [x] (2025-11-24 19:10Z) Milestone 1 — Extracted pure `applyTransition` helper, updated runtime instrumentation, and added `packages/cognitive/test/state-transitions.test.ts` (12 total tests now pass via `bun test packages/cognitive/test`).
- [x] (2025-11-24 20:05Z) Milestone 2 — Added `packages/runtime/test/cognitive-loop.integration.test.ts` with sqlite-backed fixtures plus `packages/runtime/test/utils/cognitive-fixtures.ts`, ensuring `runCognitiveLoop` persists events, replays history, and responds to entropy interrupts (run via `bun test packages/runtime/test/cognitive-loop.integration.test.ts`).
- [x] (2025-11-24 21:00Z) Milestone 3 — Added policy-gated `packages/api/src/routers/cognitive.ts`, its Bun tests (`packages/api/test/cognitive.router.test.ts`), and the verification script `scripts/verify-cognitive-pipeline.ts`; run `bun test packages/api/test/cognitive.router.test.ts` and `bun scripts/verify-cognitive-pipeline.ts` to validate cognitive feedback propagation end-to-end.
- [x] (2025-11-24 22:00Z) Milestone 4 — Introduced Playwright coverage (`apps/web/tests/cognitive-flow.e2e.spec.ts`) that drives the cognitive feedback endpoint from a browser context with request interception, plus telemetry smoke test `scripts/verify-cognitive-health.ts` that ensures the Prometheus metrics output contains cognitive gauges via `OPENAI_API_KEY=dummy DATABASE_URL=sqlite::memory: bun scripts/verify-cognitive-health.ts`.

## Surprises & Discoveries

- Observation: `createTestDb` assumes a live Postgres endpoint via `DATABASE_URL`, but local `bun test` runs rely on sqlite fallbacks and no PG server is running, causing `ECONNREFUSED`.
  Evidence: Failing `DELETE FROM cognitive_events` during early integration-test attempts (Bun output at 2025-11-24 19:45Z). Resolved by forcing `DATABASE_URL=sqlite::memory:` within the test and lazily importing `@alfred/db` so the sqlite-backed drizzle client is used.
- Observation: Router tests mock the entire `@alfred/runtime` module; omitting the unused `createRuntime` export caused import errors when helper utilities loaded the package.
  Evidence: `SyntaxError: Export named 'createRuntime' not found` while running the initial `cognitive.router.test.ts`. Fix: extend the mock to provide both `runCognitiveLoop` and `createRuntime`.
- Observation: Playwright fetches from `about:blank` lack an origin, so relative `/api/trpc/*` requests fail to resolve; using a synthetic host (`http://cognitive.test`) with request interception keeps the test serverless yet still exercises the HTTP layer.
  Evidence: `TypeError: Failed to execute 'fetch' ... Failed to parse URL from /api/trpc/...` during the first Playwright run. Fix: issue absolute requests and update the interception pattern accordingly.

## Decision Log

- Decision: Extracted `applyTransition` into `packages/cognitive/src/transition.ts` and moved metrics emission to the runtime loop to keep the helper pure and testable.
  Rationale: Enables Bun unit tests to simulate event sequences without `@alfred/api` dependencies while preserving observability in production.
  Date/Author: 2025-11-24 / Codex
- Decision: Runtime integration tests now override `DATABASE_URL` to `sqlite::memory:` and import `@alfred/db` lazily, since Postgres is unavailable in the test harness; `resetCognitiveTables` truncates tables via drizzle deletes instead of `createTestDb`.
  Rationale: Keeps tests deterministic without requiring external infrastructure while still exercising the real repository code paths (drizzle + cognitiveRepo).
  Date/Author: 2025-11-24 / Codex
- Decision: Added a dedicated cognitive router with `cognitive.feedback` policy enforcement plus the verification script to drive `runCognitiveLoop` with mocked AI so evidence/obligations can be tested headlessly.
  Rationale: Provides an API touchpoint for cognitive evidence while enabling Bun tests and scripts to catch regressions without a live orchestrator runtime.
  Date/Author: 2025-11-24 / Codex
- Decision: Playwright coverage leverages request interception against a fake host and data-only page to keep the test hermetic, while telemetry verification reuses the metrics registry instead of hitting a live `/api/metrics` server.
  Rationale: Maintains deterministic UI/E2E checks without requiring the full app to run, yet still asserts that HTTP consumers would see the expected Prometheus gauges.
  Date/Author: 2025-11-24 / Codex

## Outcomes & Retrospective

- To be filled after each milestone to summarize behavior gains and residual risk.

## Context and Orientation

`packages/cognitive/src/state.ts` defines pure factories (`idle`, `thinking`, `reflecting`) and physiology/autonomy math. `packages/runtime/src/loops/cognitive.ts` replays stored events via `cognitiveRepo` (`packages/db/src/repo/cognitive.ts`) and calls `applyTransition` inline; no export exists for direct testing. API entry points in `packages/api/src/routers/assistant.ts` and `/routers/voice.ts` enqueue cognitive events via runtime helpers, while UI routes (`apps/web/src/routes/api/assistant-agent/$.ts`, Playwright specs under `apps/web/tests/`) trigger the same pipeline. Existing tests cover physiology (`packages/cognitive/test/physiology.test.ts`), reasoning capture (`packages/cognitive/test/reasoning-flow.test.ts`), and runtime plan runner logic, but nothing asserts multi-event transitions, repo persistence, or API/UX flows. Metrics for physiology live in `packages/api/src/metrics.ts`, exposed through `/api/metrics`. Scripts such as `scripts/verify-orchestrator.ts` prove the runtime loop can execute a simple plan, yet they bypass reasoning capture and reflection logic.

## Plan of Work

Start by extracting a pure transition helper so we can deterministically simulate `CognitiveState` + `Event` pairs. Create `packages/cognitive/src/transition.ts` exporting `applyTransition` (currently inline inside the runtime loop) and re-export from `packages/cognitive/src/index.ts`; update the runtime loop to import the shared helper. Build a Bun test file `packages/cognitive/test/state-transitions.test.ts` that enumerates canonical sequences: idle→thinking on `input`, thinking→reflecting on `complete`, reflecting→idle, entropy interrupts adjusting physiology, and feedback events updating autonomy evidence. Use fixtures for `Event` objects with timestamps to exercise deterministic paths, verifying physiology gauges stay clamped.

Next, craft integration tests for the runtime loop. Introduce a helper `packages/runtime/test/utils/cognitive-fixtures.ts` that seeds `createTestDb` (already exposed via `packages/api/test/utils/db.js`, re-export or add TS helper) with a temporary schema, inserts starter events via `cognitiveRepo`, and tears down after each case. Write `packages/runtime/test/cognitive-loop.integration.test.ts` to mock `@alfred/api/metrics`, run `runCognitiveLoop` with sequences (input + feedback + complete), assert that `cognitiveRepo.appendEvent` receives payloads, and ensure reflections persist the computed `error` from `calculateError`. Cover failure scenarios (interrupt events, repeated completions) to guarantee idempotence.

For orchestrator/API coverage, create a new verification script `scripts/verify-cognitive-pipeline.ts` modeled after `scripts/verify-orchestrator.ts` but focusing on reasoning capture: feed a mock `input`, simulate `runtime.run()` until a reflection event occurs, and assert the knowledge capture facts plus metrics increments. Parallel to the script, add `packages/api/test/cognitive.router.test.ts` using Bun's test runner and `createTestDb` to call the cognitive-related tRPC router (likely `packages/api/src/routers/assistant.ts` or a new router) through `appRouter.createCaller`. Mock `requirePolicy` and ensure biometric obligations propagate by inspecting the response. These tests should confirm `feedback` events call `updateAutonomy` with proper evidence.

Finally, extend UI and observability coverage. Add a Playwright spec `apps/web/tests/cognitive-flow.e2e.spec.ts` (mirroring existing specs) that drives the chat or Mindscape command palette to send a prompt, waits for reasoning traces to appear, and asserts the `/api/metrics` cognitive counters increment via a REST call inside the test. Supplement with `scripts/verify-cognitive-health.ts`, a small Bun script that posts a synthetic event through the API and then polls `/api/metrics` to confirm gauges increased, failing if not.

## Concrete Steps

1. `cd /Users/jackmazac/Development/alfred` then `bun test packages/cognitive/test` to confirm current baseline (should pass 7 tests).
2. Extract `applyTransition` into `packages/cognitive/src/transition.ts`, update imports, and add new unit tests under `packages/cognitive/test/state-transitions.test.ts`; run `bun test packages/cognitive/test` expecting the new suite to fail before implementation and pass after.
3. Create runtime integration helpers under `packages/runtime/test/utils/` and implement `packages/runtime/test/cognitive-loop.integration.test.ts`; run `bun test packages/runtime/test/cognitive-loop.integration.test.ts`.
4. Author `scripts/verify-cognitive-pipeline.ts` plus `packages/api/test/cognitive.router.test.ts`; run `bun test packages/api/test/cognitive.router.test.ts` and `bun scripts/verify-cognitive-pipeline.ts`.
5. Add Playwright spec `apps/web/tests/cognitive-flow.e2e.spec.ts`; run `bun test apps/web/tests/cognitive-flow.e2e.spec.ts` (or the Playwright runner configured via `bun test apps/web/tests --filter cognitive-flow`).
6. Add telemetry script `scripts/verify-cognitive-health.ts` and update documentation (`docs/observability/cognitive-testing.md`) describing how to run both verification scripts.

## Validation and Acceptance

- Unit level: `bun test packages/cognitive/test` now includes `state-transitions.test.ts` with deterministic snapshots and must pass locally and in CI.
- Integration level: `bun test packages/runtime/test/cognitive-loop.integration.test.ts` should show events persisted and reflections emitted; tests should fail on regressions in `runCognitiveLoop`.
- API level: `bun test packages/api/test/cognitive.router.test.ts` must assert policy enforcement and evidence propagation; failure indicates router regressions.
- Script level: `bun scripts/verify-cognitive-pipeline.ts` should log creation of capture facts, a reflecting state, and success message; `bun scripts/verify-cognitive-health.ts` should exit 0 after confirming `/api/metrics` counters moved.
- UI level: `bun test apps/web/tests/cognitive-flow.e2e.spec.ts` must complete, proving end-to-end flow from user input to reflected outcome.

## Idempotence and Recovery

All new tests run against ephemeral fixtures: cognitive transition tests use pure functions; runtime integration tests rely on unique schemas via `createTestDb` and truncate tables between cases; API and script verifications use mock models and ephemeral tokens; Playwright spec cleans up created chat data through existing test helpers. If a step fails mid-run, re-run the same Bun command—fixtures recreate their state on each execution. No persistent migrations or destructive commands are introduced.

## Artifacts and Notes

- Record notable logs (e.g., `cognitive-loop.integration` test output) inside future revisions of this plan when diagnosing issues.
- Capture diffs for extracted transition helper and mention them in `Surprises & Discoveries` if large refactors are required.

## Interfaces and Dependencies

- New module `packages/cognitive/src/transition.ts` exposes:

    export type TransitionResult = { state: CognitiveState; autonomy: AutonomyGradient };
    export function applyTransition(state: CognitiveState, autonomy: AutonomyGradient, event: Event): TransitionResult;

  Update `packages/cognitive/src/index.ts` to export this helper.

- Runtime integration tests import `runCognitiveLoop` from `packages/runtime/src/loops/cognitive.ts`, `cognitiveRepo` from `@alfred/db`, and `createTestDb` from `packages/api/test/utils/db.js` (or a new TS helper) for fixture setup.

- API router tests instantiate `appRouter` from `packages/api/src/routers/index.ts`, seeding context with mock auth, policy, and DB clients.

- Playwright spec depends on existing helpers in `apps/web/tests/helpers/auth.ts` for login and uses API routes under `apps/web/src/routes/api/assistant/$.ts` to submit prompts.

- Verification scripts rely on `@alfred/runtime`, `@alfred/auth/token`, `@alfred/api/metrics`, and the same mock AI model structure used in `scripts/verify-orchestrator.ts`.

---
Revision 2025-11-24: Marked Milestone 1 complete after extracting `applyTransition`, relocating metrics instrumentation to the runtime loop, and adding the new transition unit tests.
Revision 2025-11-24: Marked Milestone 2 complete with sqlite-backed runtime integration tests, documented the Postgres limitation, and added the lazy-DB decision.
Revision 2025-11-24: Marked Milestone 3 complete after adding the cognitive router, Bun tests, and verification script; captured the runtime mock export surprise and associated decision.
Revision 2025-11-24: Marked Milestone 4 complete with Playwright coverage and telemetry health script, documenting the absolute-URL requirement for fetch interception.
