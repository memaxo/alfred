# Mindscape Workflow SSE Convergence (Run mindscape-workflow-sse)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows the ExecPlan methodology defined in `.agent/PLANS.md` and must be maintained in accordance with those requirements.

## Purpose / Big Picture

ALFRED's Mindscape view currently relies on the TRPC WebSocket stream (`workflow.stream`) while the orchestrator tab already uses HTTP Server-Sent Events (SSE). This plan unifies workflow streaming so that both low-level `WorkflowEvent`s and assistant-style `UIMessage`s come from a single backend surface powered by `@alfred/agent/workflow/orchestrator.orchestrateWorkflowStream`. Mindscape will switch to an SSE transport exposed at `/api/workflow/stream`, eliminating its dependency on TRPC subscriptions. After this change, a user can open Mindscape, trigger a workflow node, and observe real-time graph updates plus chat-style breadcrumbs over the same SSE channel that still enforces workflow policies, audit logging, preference refreshes, and Linear side effects.

## Progress

- [x] (2025-11-24 18:20Z) Captured baseline context and authored the initial ExecPlan skeleton.
- [x] (2025-11-24 18:55Z) Updated `@alfred/agent` and `@alfred/runtime` orchestrators to expose `emitUiMessages`, plus regression test `packages/agent/src/workflow/orchestrator.test.ts`.
- [x] (2025-11-24 19:00Z) Added shared policy/rate-limit helper `packages/api/src/workflow/access.ts` with coverage in `packages/api/test/workflow.access.test.ts`.
- [x] (2025-11-24 19:20Z) Added `/api/workflow/stream` SSE route plus tests in `apps/web/src/routes/api/__tests__/workflow.stream.route.test.ts`.
- [x] (2025-11-24 19:40Z) Added `useWorkflowSseStream`, migrated Mindscape monitor to SSE, and updated hook/component tests.
- [x] (2025-11-24 19:50Z) Validation run via targeted `bun test` suites for agent/api/web hooks and SSE route.

## Surprises & Discoveries

- Observation: Mindscape's SSE UI-message handler reused the initial `data.messages` prop, so follow-up messages overwrote earlier ones instead of appending.
  Evidence: `updateArtifactData` always spread `data.messages`, which is fixed at mount time; store snapshots confirmed only seed messages persisted after SSE playback.

## Decision Log

- Decision: Use a dedicated helper `packages/api/src/workflow/access.ts` so both TRPC and SSE surfaces share policy/rate-limit semantics without duplicating middleware logic.
  Rationale: Keeps obligations and audit logging centralized per Scope Clarity and Workflow Runtime rules.
  Date/Author: 2025-11-24 / Codex.
- Decision: Implement a reusable React hook (`useWorkflowSseStream`) to encapsulate SSE parsing so Mindscape components stay declarative.
  Rationale: Multiple Mindscape panels may eventually subscribe to workflow SSE; a hook prevents duplicated buffering/error handling.
  Date/Author: 2025-11-24 / Codex.

## Outcomes & Retrospective

- Completed the workflow streaming convergence: orchestrator emits UI messages, policy enforcement is shared, `/api/workflow/stream` serves SSE, and Mindscape now consumes the stream via `useWorkflowSseStream` with reliable message accumulation and error cleanup. Targeted Bun tests cover agent, API, hook, and Mindscape monitor flows.

## Context and Orientation

This work touches ALFRED itself (not a generated app). Key files today:

- `packages/agent/src/workflow/orchestrator.ts` is the single source of truth for workflow streaming. It persists every `WorkflowEvent` and currently derives `UIMessage`s solely for persistence, not for transports.
- `packages/api/src/routers/workflow.ts` exposes TRPC procedures. The `stream` procedure wraps `orchestrateWorkflowStream` via WebSockets and handles policy enforcement using `rateLimit` + `requirePolicy` middleware.
- Mindscape renders via `apps/web/src/components/mindscape/monitor.tsx`, which uses `trpc.workflow.stream.useSubscription` to listen for events and contains a placeholder `eventToUiMessages` shim.
- `/api/orchestrator` (TanStack Start route in `apps/web/src/routes/api/orchestrator/$.ts`) already exposes SSE semantics for the chat orchestrator by delegating to `apps/web/src/lib/api/stream-handler.ts`.
- There is no shared helper for enforcing `workflow.plan` policy outside TRPC. `packages/api/src/trpc.ts` holds the only rate limit implementation.
- Tests relevant to this change live under `packages/api/test/workflow.*` (router + policy) and `apps/web/src/components/__tests__/mindscape.monitor.test.tsx` (Mindscape store updates).

## Plan of Work

1. **Extend orchestrator callbacks to stream UI messages.** Update both `packages/agent/src/workflow/orchestrator.ts` and the mirror in `packages/runtime/src/workflow/orchestrator.ts` so `OrchestratorCallbacks` includes an optional `emitUiMessages` delegate. Inside the executor loop, after persisting derived `UIMessage`s, invoke `callbacks.emitUiMessages?.(...)` with metadata `{ runId, eventId, eventType, originalEvent }`. Ensure persistence runs first so transports never block DB writes, and keep `emitUiMessages` fire-and-forget. Add unit coverage that stubs `eventToUiMessages` to return data and asserts the callback fires when present.

2. **Share policy + rate limit enforcement outside TRPC.** Extract the rate-limit bucket logic from `packages/api/src/trpc.ts` into a new exported helper (e.g., `consumeRouteRateLimit(userId, path, type)`). Create `packages/api/src/workflow/access.ts` with `enforceWorkflowPlanPolicy({ request, session, input })` that:
   - Validates the user session, calls `consumeRouteRateLimit` with the same key TRPC uses (`workflow.stream` + `subscription`), and evaluates the `workflow.plan` action via `@alfred/policy` just like `requirePolicy`.
   - Records policy audit logs / metrics, forwards obligations, and throws structured errors (include `statusCode` for HTTP).
   - Returns `{ obligations: string[] }` so callers can pass them into `orchestrateWorkflowStream` contexts.
   Add focused tests that mock `@alfred/policy` + `policyRepo` to cover “allow”, “deny”, and “obligation” paths, satisfying the Workflow Runtime testing rule for success/escalation scenarios.

3. **Implement `/api/workflow/stream` SSE route.** Add `apps/web/src/routes/api/workflow/stream.ts` (TanStack Start file route) exporting both the handler and `Route`. Responsibilities:
   - Accept POST JSON body validated by `workflowInput`. Attach the authenticated session via `auth.api.getSession`.
   - Call `enforceWorkflowPlanPolicy`, capture returned obligations, and construct `OrchestratorCallbacks` that reuse `triggerPreferenceRefresh`, `ensureObligations`, and pass `{ policy: { obligations } }` as `context`.
   - Translate orchestrator callbacks into SSE: `workflow-event` for `emitNext`, `ui-message` for `emitUiMessages`, `error` for failures, and `complete` when `emitComplete` fires. Use `ReadableStream` + `TextEncoder`, flush heartbeats if idle, and honor `request.signal` for cleanup.
   - Write regression tests (e.g., `apps/web/src/routes/api/__tests__/workflow.stream.route.test.ts`) that mock orchestrator + helper modules. Cover (a) successful stream piping both event types, (b) policy denial (403), and (c) rate limit overflow (429 / error) to satisfy the “normal / escalation / safeguards” rule.

4. **Author `useWorkflowSseStream` hook.** Create `apps/web/src/hooks/use-workflow-sse-stream.ts` with the API described in the objective. It should:
   - Take `input` plus `onWorkflowEvent`, `onUiMessages`, and `onError` callbacks.
   - When `input` is non-null, `fetch` `/api/workflow/stream` (POST) and parse SSE chunks via a buffered parser. Expose status (`idle | connecting | open | closed | error`) and store the latest error.
   - Handle `workflow-event`, `ui-message`, `error`, and `complete` event names; ignore unknowns. Abort the request when the component unmounts or `input` resets.
   - Ship tests in `apps/web/src/hooks/__tests__/use-workflow-sse-stream.test.ts` that mock `global.fetch` with a controllable `ReadableStream`, verifying chunk parsing, error propagation, and reconnection logic.

5. **Wire Mindscape monitor to the new hook.** Update `apps/web/src/components/mindscape/monitor.tsx` so `WorkflowSubscription`:
   - Replaces the TRPC subscription with `useWorkflowSseStream`, passes the prepared stream input, and handles callbacks by updating the store (statuses, runId, errors, and aggregated `UIMessage`s coming from SSE meta).
   - Removes the local `eventToUiMessages` stub (now provided by backend). Keep existing `dispatchMindscapeEvent` pulses and processed-event deduplication.
   - Update `apps/web/src/components/__tests__/mindscape.monitor.test.tsx` to mock the new hook instead of TRPC. Simulate SSE callbacks to assert context-cache handling and ensure preference logic still runs when `complete` arrives. Tests should cover both success and failure signals (error callback) to respect the workflow testing rule.

6. **Validation + smoke tests.** After coding:
   - Run targeted Bun tests covering agent, API, and web areas mentioned above. Ensure new tests fail before changes (verify by temporarily skipping new callbacks if feasible) and pass after updates.
   - Optionally issue a local `curl` or `bun test` harness that posts to `/api/workflow/stream` with mocked modules to confirm SSE output shape. Document the commands and expected outputs under `Concrete Steps` / `Validation`.

## Concrete Steps

1. Use `rg`/`sed` to inspect `packages/agent/src/workflow/orchestrator.ts` and duplicate updates into `packages/runtime/src/workflow/orchestrator.ts` as needed.
2. Refactor `packages/api/src/trpc.ts` to expose `consumeRouteRateLimit` and update existing middleware to call it.
3. Create `packages/api/src/workflow/access.ts` with policy enforcement logic and add companion tests under `packages/api/test/workflow.access.test.ts`.
4. Implement `apps/web/src/routes/api/workflow/stream.ts` plus tests under `apps/web/src/routes/api/__tests__/workflow.stream.route.test.ts` (ensure TanStack Start route exports handler for testing).
5. Add `apps/web/src/hooks/use-workflow-sse-stream.ts` + tests under `apps/web/src/hooks/__tests__/use-workflow-sse-stream.test.ts`.
6. Refactor `apps/web/src/components/mindscape/monitor.tsx` and its test to use the new hook; update any related exports/imports.
7. Run `bun test packages/agent/src/workflow/orchestrator.test.ts packages/api/test/workflow.access.test.ts apps/web/src/hooks/__tests__/use-workflow-sse-stream.test.ts apps/web/src/components/__tests__/mindscape.monitor.test.tsx` (adjust paths for the actual Bun test runner) and review output for regressions.

## Validation and Acceptance

- **Backend streaming:** Run `bun test packages/agent/src/workflow/orchestrator.test.ts` to ensure UI-message callbacks trigger when events emit. Acceptance: the new test fails without `emitUiMessages` wiring and passes afterward.
- **Policy helper:** Run `bun test packages/api/test/workflow.access.test.ts` covering allow/deny/obligation cases; expect deterministic 3-pass output.
- **SSE route:** Run `bun test apps/web/src/routes/api/__tests__/workflow.stream.route.test.ts` to verify SSE events for success, policy rejection, and rate limiting.
- **Frontend hook + Mindscape:** Run `bun test apps/web/src/hooks/__tests__/use-workflow-sse-stream.test.ts apps/web/src/components/__tests__/mindscape.monitor.test.tsx` to ensure SSE parsing and store updates function. Optionally start the dev server (`bun run dev` in `apps/web`) and issue `curl -N -X POST http://localhost:3000/api/workflow/stream -d '{"requirement":"hello","auto":"low"}'` with a valid session header to observe `workflow-event` and `ui-message` SSE frames.

## Idempotence and Recovery

All changes are additive. Running the plan multiple times is safe because:
- The SSE endpoint and hook are new files; reruns simply overwrite code via git.
- Rate limit helper refactor keeps existing buckets, so re-running tests has no side-effects besides in-memory counter resets.
- If a Bun test fails mid-way, rerun the same command after fixing code; no persistent DB writes occur because repo functions are mocked.

## Artifacts and Notes

Keep short snippets demonstrating SSE output for docs/testing, e.g.:

    event: workflow-event
    data: {"type":"run","eventId":"wf_123","id":"wf_123"}

    event: ui-message
    data: {"messages":[{"role":"assistant","parts":[{"type":"text","text":"Planning"}]}],"meta":{"eventId":"wf_123"}}

Store any longer transcripts in test fixtures rather than this plan.

## Interfaces and Dependencies

- `packages/agent/src/workflow/orchestrator.ts`: define `emitUiMessages?: (messages: UIMessage[], meta: { runId: string; eventId: string; eventType: string; originalEvent: WorkflowEvent }) => void` inside `OrchestratorCallbacks` and call it after persisting UI messages.
- `packages/api/src/trpc.ts`: export `consumeRouteRateLimit(userId: string | null, path?: string, type?: string): Promise<void>` and update `rateLimit` middleware to delegate to it.
- `packages/api/src/workflow/access.ts`: export `async function enforceWorkflowPlanPolicy({ request, session, input }: { request?: Request; session: Awaited<ReturnType<typeof auth.api.getSession>>; input: WorkflowInputPayload; }): Promise<{ obligations: string[] }>`.
- `apps/web/src/routes/api/workflow/stream.ts`: export `async function handleWorkflowStreamRequest(request: Request): Promise<Response>` and register it via `createFileRoute` at `/api/workflow/stream`.
- `apps/web/src/hooks/use-workflow-sse-stream.ts`: export `useWorkflowSseStream(options: { input: WorkflowStreamInput | null; onWorkflowEvent?: (event: WorkflowEvent) => void; onUiMessages?: (messages: UIMessage[], meta: { eventId: string; eventType: string; runId: string }) => void; onError?: (error: Error) => void; }): { status: Status; error: Error | null }`.
- `apps/web/src/components/mindscape/monitor.tsx`: import the hook via `@/hooks/use-workflow-sse-stream` and remove `trpc.workflow.stream` usage.

---

Change log:
- 2025-11-24: Initial ExecPlan drafted to cover backend callback updates, shared policy enforcement, SSE route, React hook, and Mindscape refactor.
