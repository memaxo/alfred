# UI Testing Coverage Improvements

This ExecPlan is a living document maintained under `.agent/PLANS.md`. Update every section—especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`—as work proceeds.

## Purpose / Big Picture

ALFRED users need confidence that every critical screen in `apps/web` renders, talks to real hooks, and exercises the same tRPC flows they rely on in production. Today, heavy mocking means regressions in the notes, reminders, and chat flows slip through until manual QA. After implementing this plan, smoke suites will fail fast when a screen stops rendering, integration suites will run real hooks against mocked tRPC boundaries, the notes CRUD flow will have deterministic coverage, and a reusable E2E harness will exist so we can add reminders/workflows coverage without re-inventing infrastructure. Verification is observable: run the new smoke/integration suites and watch real components render; run the notes flow tests and see CRUD mutations update the UI; boot the E2E harness to hit tRPC over HTTP with authenticated sessions.

## Progress

- [x] (2025-11-20 18:05Z) Reviewed `.agent/PLANS.md` and `docs/investigations/ui-testing-coverage-analysis.md`, captured scope, and authored this ExecPlan.
- [x] (2025-11-20 20:07Z) Milestone 1 — Added `renderRoute`/test TRPC client helpers plus smoke suite covering login, ai, note, remind, and profile routes.
- [x] (2025-11-20 21:45Z) Milestone 2 — Swapped hook-level mocks for an AI SDK streaming mock (`apps/web/src/test/mock-assistant-chat.ts`), refactored `chat-container` integration specs to use the real `useAssistantStream`, and added hook-level send tests.
- [ ] Milestone 3 — Notes CRUD flow tests (create/read/update/delete + optimistic rollback) using the new integration harness.
- [ ] Milestone 4 — Foundational E2E harness (`createTestServer`, `createTestClient`, `createTestSession`, streaming helpers) wired into Vitest.
- [ ] Milestone 5 — Reminders and workflow regression tests leveraging the E2E harness (coverage gated on time).

## Surprises & Discoveries

- Observation: Running focused Bun test files does not preload `@testing-library/jest-dom`, so matchers like `toBeInTheDocument` are undefined.
  Evidence: `bun test apps/web/src/routes/__tests__/smoke-critical.test.tsx` at 2025-11-20 20:03Z failed with `TypeError: expect(...).toBeInTheDocument is not a function` until assertions were rewritten to basic DOM checks.
- Observation: TanStack agent toggles render with `role="tab"` (not `button`), so RTL queries must target tabs directly when switching between assistant and orchestrator states.
  Evidence: `chat-container.integration.test.tsx` failed at 2025-11-20 21:32Z with “Unable to find an accessible element with the role "button" and name `/orchestrator/i`” until the test queried `role="tab"` instead.

## Decision Log

- Decision: Stage work in five milestones that mirror the investigation priorities (smoke → real hook integration → notes flow → E2E harness → reminders/workflows) to keep each outcome independently verifiable.
  Rationale: Aligns with the gap analysis ordering and ensures earlier suites unblock later flow tests.
  Date/Author: 2025-11-20 / Codex
- Decision: Source all infrastructure utilities from `apps/web/src/test/` so front-end suites can import them without touching backend-only packages.
  Rationale: Keeps TanStack Start build graph clean while still reusing `packages/api/test` helpers via explicit imports.
  Date/Author: 2025-11-20 / Codex
- Decision: `renderRoute` ships a handler-based TRPC test client (custom link + observable) instead of per-suite module mocks so future tests can supply deterministic responses while exercising real `trpc` hooks.
  Rationale: Keeps hooks/providers unchanged, supports progressive realism, and avoids brittle global mocks that previously interfered with other suites.
  Date/Author: 2025-11-20 / Codex
- Decision: Added `apps/web/src/test/mock-assistant-chat.ts` to mock AI SDK streaming (`@ai-sdk/react` + `DefaultChatTransport`) rather than mocking `useAssistantStream` directly, pairing it with `assistantChatMock` helpers for deterministic send/error assertions.
  Rationale: `useAssistantStream` talks to the AI SDK, not tRPC, so mocking the transport preserves real hook logic (deriveActions, clear/hydrate) while keeping tests hermetic.
  Date/Author: 2025-11-20 / Codex

## Outcomes & Retrospective

(To be filled after major checkpoints and at completion. Include what shipped, what remains, and lessons for future UI test initiatives.)

## Context and Orientation

`apps/web` hosts TanStack Start routes (`apps/web/src/routes/*.tsx`), shared hooks (`apps/web/src/hooks`), and UI primitives. Existing tests live under `apps/web/src/components/__tests__`, `apps/web/src/hooks/__tests__`, and `apps/web/src/routes/__tests__` but rely on heavy mocking, especially for `@/utils/trpc` and `@/hooks/use-assistant-stream`. `docs/investigations/ui-testing-coverage-analysis.md` catalogs eight current UI tests, highlights the absence of smoke/E2E coverage, and pinpoints critical flows (login, chat, notes, reminders, workflows) that currently have no automated protection. Backend test harnesses already exist in `packages/api/test/utils/db.ts` (isolated Postgres) and `packages/api/test/utils/trpc.ts` (authenticated tRPC callers). We must bridge these with front-end-friendly utilities in `apps/web/src/test/` so UI suites can spin up real hooks, real HTTP servers, and authenticated sessions without re-implementing the backend logic.

## Plan of Work

### Milestone 1 — Smoke tests for critical screens (Priority 1)
Create a `apps/web/src/routes/__tests__/smoke-critical.test.tsx` suite that renders `login.tsx`, `ai.tsx`, `note.tsx`, `remind.tsx`, and `profile.tsx` using shared helpers. Introduce `apps/web/src/test/render-route.tsx` to wrap TanStack Start routes with providers (QueryClient, Router, auth context). Each smoke test loads the real route component, supplies the minimal loader data (stubbed via helper), and asserts the primary CTA or heading renders. Keep mocks minimal: only stub tRPC calls the route actually needs using lightweight utilities such as `createRouteTrpcMock({ noteList: [...] })`. Goal: catch missing imports, loader crashes, or regressions in the route composition.

### Milestone 2 — Real hook + mocked AI streaming integration (Priority 2)
Replace the bespoke `useAssistantStream` mocks with a shared AI SDK mock so the real hook (deriveActions, clear/hydrate, agent switching) can run end-to-end inside RTL. The helper lives at `apps/web/src/test/mock-assistant-chat.ts`, stubs `@ai-sdk/react`'s `useChat` + `ai`'s `DefaultChatTransport`, and exposes `assistantChatMock` APIs (`emitAssistantMessage`, `emitError`, `sendSpy`, etc.). Refactor `apps/web/src/components/__tests__/chat-container.integration.test.tsx` to rely on this helper (no hook-level mocks) and assert UI behaviour by emitting messages/errors through the mock. Extend `apps/web/src/hooks/__tests__/use-assistant-stream.integration.test.tsx` with a send test that proves `result.current.send()` forwards text to the mocked transport.

### Milestone 3 — Notes flow CRUD tests (Priority 3)
Author `apps/web/src/routes/__tests__/note-flow.integration.test.tsx` covering create/read/update/delete. Use the Milestone 2 helper so the route renders with real hooks/components while the tRPC boundary is mocked with deterministic responses plus latency toggles to test optimistic updates. Cover:
1. Rendering the note list from mocked `note.list` data.
2. Creating a note via `note.create.mutate`, asserting optimistic insertion, server confirmation, and error rollback.
3. Editing a note using `note.update.mutate`, confirming local state updates and server sync.
4. Deleting a note via `note.delete.mutate`, checking confirmation and final list state.
Add utility assertions around `trpc.useUtils().note.list.setData` to ensure cache updates happen exactly once per action. Document fallback behaviors (e.g., toast on failure) in the test file via inline comments so novices understand expected UX.

### Milestone 4 — E2E harness foundation (Priority 4)
Lay infrastructure under `apps/web/src/test/`:
- `server.ts`: `createTestServer`, `cleanupTestServer`, and `withTestServer` helpers that spin up `Bun.serve` with the real tRPC router (`@alfred/api/routers/index`). Wire it to a dedicated test database via `createTestDb` and ensure tables truncate between cases using `truncateTables`.
- `client.ts`: `createTestClient` returning a real `@trpc/client` instance configured with HTTP batch links pointing at the ephemeral test server.
- `auth.ts`: `createTestSession` and `authenticatedRender` that wrap components with session context matching what TanStack Start expects (reuse `createTestCaller` logic for claims), plus cookie injection helpers for fetch-based E2E calls.
- `stream.ts`: utilities for simulating SSE/EventSource streams and waiting for streaming payloads so we can later exercise chat workflows.
Integrate these helpers into Vitest by updating `apps/web/vitest.config.ts` (or local setup file) to allow `setupFilesAfterEnv` hooking to start/stop servers lazily. Provide documentation inside the helper files describing lifecycle expectations (start once per suite vs per test) and cleanup steps.

### Milestone 5 — Reminders & workflows coverage (Priority 5)
With the harness in place, create `apps/web/src/routes/__tests__/remind-flow.e2e.test.tsx` and (time permitting) `apps/web/src/routes/__tests__/workflow-flow.e2e.test.tsx`. These suites should:
- Use `withTestServer` to boot the real API + DB, seed fixtures via `dbFixtures` (e.g., create user, seed reminders/workflows).
- Call the real tRPC procedures through `createTestClient` to create/list/complete reminders and to start/monitor workflows.
- Render the corresponding routes with `authenticatedRender` and confirm UI state reflects live server changes (e.g., SSE-driven workflow updates appear in the DOM within timeouts).
These tests prove the entire pipeline works (component → hook → tRPC client → HTTP server → DB) and provide the template for future E2E flows.

## Concrete Steps

1. Milestone 1 execution:
    - Create `apps/web/src/test/render-route.tsx` exporting `renderRoute(Component, options)` that wraps React Testing Library’s `render` with QueryClientProvider, RouterContext, and optional loader data.
    - Add `apps/web/src/routes/__tests__/smoke-critical.test.tsx` with one `describe` per route. For data-dependent routes (notes/remind/profile), use `createTestTrpcClient` from `render-route` options to stub the required queries. Keep each test to “render + assert primary heading/CTA present”.
    - Run `bun test apps/web --filter=smoke-critical` and confirm five passing cases; ensure failure output clearly points to the broken screen.
2. Milestone 2 execution:
    - Add `apps/web/src/test/mock-assistant-chat.ts` that mocks `@ai-sdk/react`’s `useChat` + `DefaultChatTransport`, exports `assistantChatMock` helpers (send spy, emitAssistantMessage/error, status setters), and documents how suites should interact with it.
    - Refactor `apps/web/src/components/__tests__/chat-container.integration.test.tsx` to drop direct `useAssistantStream` mocks, import the helper, and focus on real hook behaviour (rendering stream updates, clear button, agent switching).
    - Extend `apps/web/src/hooks/__tests__/use-assistant-stream.integration.test.tsx` with a send test that asserts `result.current.send()` drives the mocked transport and appends the user message to hook state.
    - Run `bun test apps/web/src/components/__tests__/chat-container.integration.test.tsx` and `bun test apps/web/src/hooks/__tests__/use-assistant-stream.integration.test.tsx` (or `bun test apps/web --filter=assistant-stream`) to confirm the suites hit the live hook implementation.
3. Milestone 3 execution:
    - Create `apps/web/src/routes/__tests__/note-flow.integration.test.tsx` using `renderRoute` + `trpc-mock`.
    - Implement helper functions inside the test to mutate the mock cache (e.g., `getNoteListCacheCalls()`). Cover CRUD scenarios plus error rollback by having the mock mutate reject once; assert UI rolls back and surfaces toast text.
    - Document expectations inline (“When `note.create` rejects, the optimistic card disappears and toast shows ‘Try again’”).
    - Execute `bun test apps/web --filter=note-flow` after each scenario addition.
4. Milestone 4 execution:
    - Add `apps/web/src/test/server.ts`, `client.ts`, `auth.ts`, and `stream.ts` as described above. Each file needs docstrings referencing this ExecPlan for context.
    - Update `apps/web/vitest.setup.ts` (create if missing) to register global helpers, including aborting leftover servers in `afterAll`.
    - Add npm scripts (e.g., `"test:ui": "bun test apps/web"`) if missing so new contributors can run suites via a single command.
    - Prove the harness works by writing a minimal E2E test that starts the server, hits `client.health.ping.query()`, and asserts an OK response.
    - Run `bun test apps/web --filter=e2e-smoke` and record expected output under `Artifacts and Notes`.
5. Milestone 5 execution (time-permitting but scaffold instructions upfront):
    - Build `remind-flow.e2e.test.tsx` using `withTestServer` to seed reminders via real tRPC calls and verify the reminders route reflects DB updates.
    - Optionally add `workflow-flow.e2e.test.tsx` that streams workflow progress, using `stream.ts` utilities to wait for SSE events before asserting UI changes.
    - Ensure suites clean up DB tables via `truncateTables` in `afterEach` to keep runs isolated.

## Validation and Acceptance

- Smoke coverage: `bun test apps/web --filter=smoke-critical` must pass locally and in CI. A deliberate JSX import break in `apps/web/src/routes/ai.tsx` should cause the smoke suite to fail with a clear error message, proving catchability.
- Real hook integration: `bun test apps/web --filter=assistant-stream` should execute the real hook logic. Temporarily forcing `useAssistantStream` to throw should make the integration suite fail, demonstrating the suite hits the live implementation.
- Notes CRUD flow: `bun test apps/web --filter=note-flow` must pass. Commenting out the optimistic cache update in `note.tsx` should cause the “optimistic insert” assertion to fail, proving the test guards behavior.
- E2E harness: `bun test apps/web --filter=e2e-smoke` starts the server, issues a real HTTP call, and tears everything down without dangling handles. Killing the server mid-test should surface a helpful failure, confirming cleanup logic.
- Reminders/workflows coverage: once implemented, `bun test apps/web --filter=remind-flow` (and workflow equivalent) should pass and fail if the respective tRPC procedures regress.
- CI integration: add these suites to Turbo/Vitest pipelines so `bun run test:ui` executes them. Acceptance requires stable runs on the default CI runner (<5 minutes execution).

## Idempotence and Recovery

- Smoke/integration suites rely on deterministic mocks, so rerunning them is safe. Keep helper factories pure so tests don’t leak shared state.
- The E2E harness uses isolated DB connections; ensure `truncateTables` runs in `afterEach` and `closeTestDb` runs in `afterAll`. If a test crashes mid-run, rerun the suite after verifying no orphaned Bun servers remain (`lsof -i :<port>`).
- Infrastructure files must guard against double-starting servers. `createTestServer` should no-op if a server is already running for the current suite, and `cleanupTestServer` should swallow “already closed” errors so repeated teardown calls are safe.

## Artifacts and Notes

- Record the first successful run outputs inside this section once available, for example:
    - Smoke suite sample output:
        `bun test apps/web --filter=smoke-critical` → `5 tests passed (45 ms)`.
    - E2E harness sample log excerpt:
        `{ "level": "info", "msg": "test-server-start", "port": 43145 }`
- Note any helper-specific caveats (e.g., “renderRoute must be awaited because loader data is async”). Update this section whenever new suites add noteworthy debugging tips.

## Interfaces and Dependencies

- `apps/web/src/test/render-route.tsx`
    - Exports `renderRoute(Component, options?: { loaderData?: unknown; trpc?: TestTrpcClient; session?: TestSession })`.
    - Internally mounts QueryClientProvider, TanStack RouterContext, and the new `TestTrpcProvider` so routes behave as in production.
- `apps/web/src/test/trpc-mock.ts`
    - Provides `createTestTrpcClient(overrides?: Partial<MockShape>)` returning spies for every tRPC hook used in the suites, plus helpers like `recordCall('note.list.useQuery')` for assertions.
- `apps/web/src/test/mock-assistant-chat.ts`
    - Replaces `@ai-sdk/react` and `ai` transports with deterministic mocks. Exports `assistantChatMock` (`sendSpy`, `emitAssistantMessage`, `emitError`, `reset`) so integration and hook tests can exercise the real `useAssistantStream` without touching the network.
- `apps/web/src/test/server.ts`
    - Declares `type TestServer = { url: string; port: number; stop(): Promise<void>; db: NodePgDatabase }`.
    - Functions: `createTestServer`, `cleanupTestServer`, `withTestServer(async (ctx) => { ... })`.
- `apps/web/src/test/client.ts`
    - Exports `createTestClient(baseUrl: string, session: TestSession)` returning an `@trpc/client` bound to the HTTP test server with auth headers/cookies.
- `apps/web/src/test/auth.ts`
    - Defines `createTestSession(userOverrides?)` and `authenticatedRender(ui, session)` hooking into whatever SessionContext `apps/web` uses today.
- `apps/web/src/test/stream.ts`
    - Utilities: `createMockEventSource(events: StreamEvent[])`, `waitForStreamMessage(kind: string, timeoutMs?: number)`, `emitStreamError(error)`, ensuring chat/workflow E2E tests can assert SSE updates.
- Test suites:
    - `apps/web/src/routes/__tests__/smoke-critical.test.tsx`
    - `apps/web/src/components/__tests__/chat-container.integration.test.tsx` (refactored)
    - `apps/web/src/hooks/__tests__/use-assistant-stream.integration.test.tsx` (refactored)
    - `apps/web/src/routes/__tests__/note-flow.integration.test.tsx`
    - `apps/web/src/routes/__tests__/remind-flow.e2e.test.tsx`
    - `apps/web/src/routes/__tests__/workflow-flow.e2e.test.tsx` (stretch)
- Dependencies:
    - `@testing-library/react` + `@testing-library/user-event` for UI interaction
    - `@trpc/client` and `@trpc/server` (already in repo) for E2E harness
    - Existing backend helpers from `packages/api/test/utils/db.ts` and `packages/api/test/utils/trpc.ts`
    - `whatwg-fetch` polyfill (if not already in Vitest setup) so fetch-based clients work in node

Maintain this plan as implementation continues. Every milestone completion should update `Progress`, summarize discoveries, log decisions (e.g., chosen ports, retry strategies), and culminate in an `Outcomes & Retrospective` entry explaining the new testing guarantees.
