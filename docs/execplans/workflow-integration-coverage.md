# Workflow Streaming Integration Coverage Lift

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this plan in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

We need confidence that workflow streaming works end to end with real transports instead of mocked repos or auth layers. After implementing this plan, a developer will be able to run integration suites that spin up the workflow orchestrator against the test database, exercise both `/api/workflow/stream` (SSE) and the legacy `trpc.workflow.stream` subscription, and observe Linear-style side effects through a lightweight fake HTTP service. This provides user-visible proof that workflows emit UI messages, honor policy obligations, and recover from network errors exactly as production does.

## Progress

- [x] (2025-11-24 19:15Z) Mapped existing workflow tests (agent/api/apps) and recorded where mocks replace real orchestrator/auth/Linear, establishing concrete coverage gaps.
- [ ] (2025-11-24 21:00Z) Stand up a reusable integration harness that boots auth, DB, and HTTP routes with minimal mocks.
- [ ] (2025-11-24 23:00Z) Add SSE-focused integration tests covering happy path, auth failure, policy obligations, and abort handling.
- [ ] (2025-11-25 02:00Z) Add TRPC workflow stream regression tests sharing the same harness.
- [ ] (2025-11-25 04:00Z) Implement Linear fake service plus tests proving ticket state transitions (start, delegate, complete, cancel).
- [ ] (2025-11-25 05:00Z) Wire coverage reporting to fail CI on regression and document run commands.

## Surprises & Discoveries

- None yet. Update with evidence (test output snippets, logs) as work proceeds.

## Decision Log

- Decision: Pending.

## Outcomes & Retrospective

Populate once milestones land. Summaries must compare actual outcomes to the purpose stated above.

## Context and Orientation

Workflow execution lives under `packages/agent/src/workflow`, with `orchestrateWorkflowStream` producing `WorkflowEvent`s and `UIMessage`s. Two transports consume it:

1. `/api/workflow/stream` in `apps/web/src/routes/api/workflow/stream.ts`, exposed as Server-Sent Events and consumed by `useWorkflowSseStream`.
2. `trpc.workflow.stream` in `packages/api/src/routers/workflow.ts`, exposed over WebSockets to legacy clients.

Both rely on shared policy enforcement in `packages/api/src/workflow/access.ts`, preference refresh via `@alfred/api/preference/refresh`, and auth from `@alfred/auth`. Today, most automated coverage uses unit tests with heavy mocking. Integration gaps:

- No test spins up the SSE route with real orchestrator + DB writes.
- TRPC router suites mock the orchestrator rather than exercising it.
- Linear integrations are mocked at the module boundary, so we never prove that webhooks or ticket state transitions work.

Current coverage map (2025-11-24):

- `packages/agent/src/workflow/orchestrator.test.ts` proves UI messages emit but mocks repositories, audit, metrics, Linear integrations, and the workflow executor.
- `packages/api/test/workflow.router*.test.ts`, `workflow.runtime-*.integration.test.ts`, and `workflow.stream.rate-limit.test.ts` build TRPC callers yet replace the runner, registry, repos, and external services with module-level mocks, so no real workflow execution occurs.
- `apps/web/src/routes/api/__tests__/workflow.stream.route.test.ts` replaces `auth`, `enforceWorkflowPlanPolicy`, and `orchestrateWorkflowStream`, so the SSE handler never touches persistence or auth flows.
- `apps/web/src/components/__tests__/mindscape.monitor.test.tsx` and `apps/web/src/hooks/__tests__/use-workflow-sse-stream.test.ts` only simulate fetch/SSE data via mocked readers, not the actual `/api/workflow/stream` route.
- Linear-focused suites (`packages/agent/test/linear.test.ts`, voice tests, etc.) mock HTTP calls, so we do not validate real request sequencing.

The repository already provides helpers:

- `packages/api/test/utils/context.ts` (if present) typically builds a TRPC caller with real middlewares.
- `packages/api/test/utils/db.ts` exposes `createTestDb` and `closeTestDb`.
- `apps/web/src/test` directory offers DOM and hook harnesses but not HTTP servers; we must add one.

All new integration suites must default to real dependencies. Only external SaaS APIs (Linear) get replaced, and even then via HTTP fakes that look like the real API.

## Plan of Work

Describe the journey in narrative form so a newcomer can follow it without inventing steps.

1. **Coverage mapping**. Under `docs/testing` (or a new note inside this plan), list every current test path touching workflows: unit (orchestrator), component (Mindscape monitor), route tests (SSE), TRPC router tests, Linear tests. Note which rely on mocks. The goal is to target missing surfaces: SSE happy path, TRPC happy path, policy obligations, Linear side effects.

2. **Integration harness**. Create `packages/api/test/utils/workflow-server.ts` that exports helpers:

   - `startWorkflowTestServer(options)` that spins up:
     - A temporary Postgres schema via `createTestDb`.
     - The TanStack Start app using `apps/web` route handlers bound to a Bun HTTP server (or create a dedicated fetch handler that reuses the same request pipeline as `/api/workflow/stream`).
     - A TRPC caller pointing at the real router with an authenticated session stub (avoid mocking functions; instead, create a real session object with `auth.sessionFromUser` or similar).
   - `stopWorkflowTestServer(server)` to close HTTP servers and DB connections.

   This harness keeps references to the orchestrator so tests can await completion. It should also expose utilities for injecting fake Linear endpoints (see step 4).

3. **SSE integration tests**. Add `apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts` (or similar) that uses the harness to:

   - Issue a real HTTP POST to `/api/workflow/stream` with valid JSON body and session cookies.
   - Parse the streamed SSE bytes using the same parser as `useWorkflowSseStream`.
   - Assert that:
     - The first event is `workflow-event` with `type: "run"`.
     - UI messages arrive with the expected text from the orchestrator.
     - When the client aborts (`AbortController.abort()`), the server stops emitting events and the orchestrator cleanup runs.
     - When auth headers are missing, the response is HTTP 401.
     - When `enforceWorkflowPlanPolicy` returns obligations (simulated by flipping `requireBio`), the HTTP response is 412 (or whatever the transport returns) and the SSE stream never opens.

   Reuse the real orchestrator; the only mock allowed is the Linear HTTP fake. Persisted events should be verified by querying `workflowRepo.listEvents` after the stream finishes.

4. **Linear fake service**. Create `packages/agent/test/utils/linear-fake.ts` (or similar) that spins up a Bun server responding to the same endpoints the orchestrator hits:

   - `POST /thought`, `POST /delegate`, `POST /started`, `POST /completed`, `POST /cancelled`, `POST /session/external-url`.
   - Each endpoint records payloads into an in-memory log accessible by tests.

   Update integration tests to point `LINEAR_FAKE_URL` env vars at this fake. After each workflow run, assert that the expected endpoints were called in order and with the right data (issue ID, session ID, URL).

5. **TRPC regression suite**. Under `packages/api/test`, add `workflow.stream.integration.test.ts` that uses `toObservable(caller.workflow.stream(...))` but with the real orchestrator bound into the TRPC router (remove the orchestrator mock). The test should:

   - Create a workflow run request.
   - Consume events from the observable, verifying `WorkflowEvent` order, UI message bridging (if TRPC emits them), and completion behavior.
   - Induce a policy obligation to ensure TRPC clients surface errors identical to SSE.

   Update existing TRPC tests to share the new harness so we do not regress minimal-mock goals.

6. **Coverage enforcement**. Extend `package.json` scripts or Turbo pipelines with `bun run test:workflow-integration` that invokes the new suites. Update CI config (likely `turbo.json` or `.github/workflows/*`) to call the script. Add a coverage target in `TEST_COVERAGE_REPORT.md`, explaining that integration suites must remain green before merge.

Throughout the work, avoid module-level `mock.module` where possible; prefer real services. If a dependency must be replaced (e.g., external HTTP), do so via actual HTTP servers started inside tests to mimic production wiring.

## Concrete Steps

1. Mapping coverage.

   - Command: `rg -n "workflow" packages apps | sort` to list relevant tests.
   - Open `docs/testing.md` (or create it) to document current coverage. If the file does not exist, create `docs/testing.md` with a short section referencing this plan.

2. Harness creation.

   - File: `packages/api/test/utils/workflow-server.ts`.
   - Implement helper functions as described above, importing `createTestDb`, `auth`, `enforceWorkflowPlanPolicy`, and the route handlers.
   - Document how to use the helper inside this plan (Plan of Work section) and in the test files.

3. SSE tests.

   - File: `apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts`.
   - Use Bun’s `fetch` to POST to the server started by the harness.
   - Parse SSE text by reusing `useWorkflowSseStream` helper functions (extract `drainEvents`/`parseEvent` into a shared utility or reimplement inline).
   - Validate event ordering and DB persistence.

4. Linear fake.

   - File: `packages/agent/test/utils/linear-fake.ts`.
   - Export `startLinearFake()` returning `{ url, close, getLog }`.
   - Use Bun’s `serve` or `Bun.serve`.

5. TRPC tests.

   - File: `packages/api/test/workflow.stream.integration.test.ts`.
   - Use `toObservable` with the real router; assert event sequences.

6. CI wiring.

   - Update `package.json` with `"test:workflow-integration": "bun test apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts packages/api/test/workflow.stream.integration.test.ts"`.
   - In `turbo.json`, add the new script under the appropriate pipeline.
   - Document run command in `docs/testing.md`.

## Validation and Acceptance

After completing the implementation:

1. Run `bun test apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts` from the repo root; expect the SSE tests to stream real events and finish with all checks passing. Before this work, the test file does not exist, so the command fails.
2. Run `bun test packages/api/test/workflow.stream.integration.test.ts`; expect events to flow through TRPC using the real orchestrator and DB. Without the new tests, nothing verifies this path end to end.
3. Run `bun run test:workflow-integration`; expect Bun to report all suites passing. CI must invoke the same command.
4. Inspect the linear fake logs during tests (either via assertions or console output) to confirm the orchestrator hit the expected endpoints.

Acceptance criteria: both transports proven with real orchestrator, DB events asserted, policy obligations surfaced identically, Linear fake receives the right HTTP payloads, and coverage runs inside CI via the new script.

## Idempotence and Recovery

Integration tests create and drop temporary schemas or tables; ensure `createTestDb` uses unique schema names per run and `afterAll` cleans them up. The harness must guard against server reuse between tests; always call `await server.close()` in `afterAll`. If a test crashes mid-run, rerun `bun test ...` and it should succeed because schemas are ephemeral. For the Linear fake, ensure `close()` stops the HTTP server even when assertions fail (wrap in `try/finally`).

## Artifacts and Notes

Capture key evidence as the plan evolves. Examples to add later:

    bun test apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts
      workflow.stream.integration
        ✓ streams events over SSE (125 ms)
        ✓ aborts cleanly (64 ms)
        ✓ rejects missing auth (11 ms)

    bun test packages/api/test/workflow.stream.integration.test.ts
      workflow.stream.trpc.integration
        ✓ streams events via TRPC (142 ms)
        ✓ enforces policy obligations (38 ms)

These transcripts should be updated when the suites exist.

## Interfaces and Dependencies

The harness must expose:

    type WorkflowTestServer = {
      url: string;
      trpcCaller: ReturnType<typeof appRouter.createCaller>;
      db: Awaited<ReturnType<typeof createTestDb>>;
      stop: () => Promise<void>;
    };

`startWorkflowTestServer(opts?: { linearFake?: LinearFake })` should resolve to `WorkflowTestServer`.

The linear fake utility should expose:

    type LinearFake = {
      url: string;
      getCalls(): Array<{ path: string; body: unknown }>;
      close(): Promise<void>;
    };

Tests must import and use these helpers rather than reimplement servers inline.

---

Revision 2025-11-24 / Codex: Initial ExecPlan capturing scope, harness strategy, and milestones for raising workflow integration coverage with minimal mocks.  
Revision 2025-11-24 / Codex: Documented current workflow test coverage, noted heavy mock usage, and updated Progress.
