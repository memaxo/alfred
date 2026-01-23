# Cognitive Feedback UI Integration

This ExecPlan is a living document. Maintain every section per `.agent/PLANS.md` so a newcomer can complete the effort unaided.

## Purpose / Big Picture

Users currently have no affordance inside Chat/Mindscape/Voice to submit explicit outcome feedback, so the new `cognitive.feedback` API never receives real signals. This plan wires tangible UI controls (chat reactions, Mindscape task review, voice session summary) to that endpoint so the cognitive loop can learn from success/failure without console scripts. After implementation, a user can click thumbs up/down (or short form), optionally edit the expected result, and watch the UI confirm that reflection data was recorded.

## Progress

- [x] (2025-11-24 22:30Z) Captured scope and authored the plan so UI + API work can proceed in phases.
- [x] (2025-11-24 23:45Z) Milestone 1 — Added `useCognitiveFeedback`, per-message controls (`CognitiveFeedbackControls`), and a shared dialog so assistant messages now expose thumbs up/down actions that POST to `cognitive.feedback` (covered by new hook + chat container tests).
- [x] (2025-11-25 00:50Z) Milestone 2 — Added Mindscape feedback affordances (detail panel + workflow drawer) backed by store-level tracking, plus a Playwright spec that intercepts `cognitive.feedback` during drawer interactions.
- [x] (2025-11-25 02:15Z) Milestone 3 — Voice session telemetry now includes recent session transcripts, and the Voice Admin console renders inline feedback controls that submit via `useCognitiveFeedback`.
- [x] (2025-11-25 03:05Z) Milestone 4 — Added the `cognitive_feedback_submissions_total` counter, updated the health script to assert it, and documented verification workflows in `docs/observability/cognitive-testing.md`.

## Surprises & Discoveries

- The shared Chat component in `@alfred/ui` needed an extension point for per-message UI, so we introduced an optional `renderMessageActions` prop to keep the upstream component flexible while avoiding a fork in the app.
- Playwright’s login helper still expects a running app server; when executing single-file tests locally, `/login` navigation fails. The new drawer test still exercises the feedback call by intercepting `/api/trpc/cognitive.feedback`, but running it requires the same dev server as the existing Mindscape suite.
- Voice stats previously excluded per-session data, so `VoiceRegistry.getStats()` now surfaces `recentSessions` snapshots derived from live sessions (session id, user id, transcript, last activity). This enabled the admin UI to render feedback controls without adding a new API.

## Decision Log

- Decision: Added `useCognitiveFeedback` (fetch helper + state machine), `CognitiveFeedbackDialog`, and `CognitiveFeedbackControls` so all surfaces can reuse the same hook and UI primitives.
  Rationale: Centralizing network + modal logic keeps future Mindscape/Voice affordances consistent and makes it trivial to plug the same UX into other contexts.
  Date/Author: 2025-11-24 / Codex
- Decision: Extended `@alfred/ui`’s `Chat` with `renderMessageActions` to append affordances without reimplementing message rendering or duplicating BEM styles.
  Rationale: Keeps message layout owned by the UI package while enabling downstream apps to slot in additional components (feedback, debugging badges, etc.).
  Date/Author: 2025-11-24 / Codex
- Decision: VoiceRegistry now exposes `recentSessions` (session id, user id, transcript, lastActivity) so the Voice Admin console can present inline feedback prompts without additional queries.
  Rationale: Centralizing session summaries in the registry keeps the API stateless while letting the UI ingest real data for feedback.
  Date/Author: 2025-11-25 / Codex
- Decision: The cognitive feedback API tracks submissions via the new `cognitive_feedback_submissions_total` counter labeled by `surface`, enabling telemetry to report how users submit corrections (chat vs. mindscape vs. voice).
  Rationale: Surface-level metrics make it easy to spot underused affordances and validate the new UI quickly.
  Date/Author: 2025-11-25 / Codex
- Decision: Added `feedbackByNode` + `recordFeedback` in the Mindscape store so detail panels and workflow drawers can render optimistic badges (e.g., “Marked accurate · 2m ago”) without re-querying the server.
  Rationale: Maintaining the last-submitted intent client-side provides immediate confirmation and avoids duplicate submissions while staying consistent across Mindscape surfaces.
  Date/Author: 2025-11-25 / Codex

## Outcomes & Retrospective

- Populate after each milestone to record behavioral impact and remaining gaps.

## Context and Orientation

- API endpoint: `cognitive.feedback` (tRPC) in `packages/api/src/routers/cognitive.ts` accepts `{ streamId, expected, actual }` and returns the updated cognitive state.
- Front-end surfaces: Chat lives in `apps/web/src/components/chat-container.tsx` (messages, composer, tool output), while Mindscape nodes/renderers sit in `apps/web/src/components/mindscape/*` with focus state managed via `apps/web/src/store/mindscape.ts`. Streaming routes live under `apps/web/src/routes/api/assistant/$.ts` and `apps/web/src/routes/api/orchestrator/$.ts` (tests under `apps/web/tests/*`).
- Voice admin/session UI is under `apps/web/src/routes/admin/voice.tsx`, while live voice runtime stores transcripts via `packages/voice/src/server/session.ts`.
- Feedback should reuse existing fetch utilities (`apps/web/src/lib/api/stream-handler.ts`) or add a small helper `postCognitiveFeedback(input)` so multiple surfaces stay consistent.
- Tests: Chat has RTL specs under `apps/web/src/hooks/__tests__` and component tests; Mindscape uses Playwright specs in `apps/web/tests/*`; cognitive API already has Bun tests; telemetry scripts live in `scripts/`.

## Plan of Work

Milestone 1 focuses on chat: add a `useCognitiveFeedback` hook (`apps/web/src/hooks/use-cognitive-feedback.ts`) that wraps the fetch/post logic, optimistic state, and toast messaging. Inject this hook into `chat-container.tsx` so each assistant message renders thumbs up/down icons. Clicking opens a lightweight modal (component under `apps/web/src/components/cognitive-feedback/dialog.tsx`) prefilled with `expected` (message text) and `actual` (user correction). Submit triggers the hook, sets a loading state, and confirms via toast.

Milestone 2 extends the hook into Mindscape: create a store action (`apps/web/src/store/mindscape.ts`) that records the latest feedback per node/workflow. Update node detail panels and workflow drawer headers to show “Mark accurate / Needs revision” buttons, reusing the modal component or inline form. When a workflow run completes, default `streamId` to `runId`, `expected` to the plan summary, and `actual` to the observed outcome. Add Playwright coverage similar to `cognitive-flow.e2e.spec.ts`, but this time clicking the actual buttons in Mindscape after mocking `/api/trpc/cognitive.feedback`.

Milestone 3 targets voice: after a voice session ends, display a summary card with new buttons. On the backend, extend `packages/voice/src/server/session.ts` (or relevant service) to craft a `streamId` (session id) and send feedback automatically when the admin UI button is clicked. The front-end route posts via the shared hook; server-side streaming endpoints should emit SSE events so the UI can confirm submission. Add Bun tests to `packages/voice/test` verifying server helpers call the new feedback client.

Milestone 4 handles observability: increment a Prometheus counter (e.g., `cognitive_feedback_submissions_total`) in the API router, and add a new Playwright smoke test that submits from each surface while intercepting requests (Chat, Mindscape, Voice). Update `scripts/verify-cognitive-health.ts` to assert the new metric exists. Document the workflow in `docs/observability/cognitive-testing.md` with run commands and acceptance checks.

## Concrete Steps

1. `cd /Users/jackmazac/Development/alfred`.
2. Create `apps/web/src/hooks/use-cognitive-feedback.ts` with fetch helper (uses `/api/trpc/cognitive.feedback`).
3. Add chat UI components and tests; run `bun test apps/web/src/components/__tests__/command-palette.test.tsx` (existing suite) plus new hook tests via `bun test apps/web/src/hooks/__tests__/use-cognitive-feedback.test.tsx`.
4. Extend Mindscape components + drawer, update Playwright specs (`npx playwright test apps/web/tests/cognitive-flow.e2e.spec.ts apps/web/tests/mindscape.workflow-drawer.e2e.spec.ts`).
5. Wire voice UI and server helpers; run `bun test packages/voice/test/tts-pool-streaming.test.ts` (regression) plus new unit tests.
6. Add Prometheus counter in `packages/api/src/metrics.ts`, increment in router, update `scripts/verify-cognitive-health.ts`, and rerun telemetry + Playwright suites.

## Validation and Acceptance

- Chat: clicking thumbs up/down sends POST, disables controls, and shows “Feedback recorded” toast; snapshot test ensures the modal renders. Verified by `bun test` and a manual browser run hitting the dev server (documented in docs).
- Mindscape: Playwright test selects a node, clicks “Needs revision,” intercepts `/api/trpc/cognitive.feedback`, and asserts optimistic badge updates.
- Voice: after session completes, admin UI button posts feedback; Bun test stubs the server helper and asserts `cognitive.feedback` payload matches.
- Metrics: running `bun scripts/verify-cognitive-health.ts` after submissions shows `cognitive_feedback_submissions_total` in output.

## Idempotence and Recovery

- Feedback hook handles duplicate clicks by disabling controls and allowing retries after failure.
- Store updates remain optimistic but rollback on API errors, showing inline error message.
- Playwright specs mock network responses, so repeated runs stay deterministic.

## Artifacts and Notes

- Capture screenshots (optional) for documentation once UI is polished.
- Log any future surprises (e.g., auth requirements) in the sections above.

## Interfaces and Dependencies

- New hook signature:

    export function useCognitiveFeedback(): {
        submit(input: { streamId: string; expected: string; actual: string }): Promise<void>;
        status: "idle" | "pending" | "success" | "error";
    };

- Router metric update: increment `cognitive_feedback_submissions_total` with labels `{ surface: "chat" | "mindscape" | "voice" }` based on an optional query param.
- Shared modal props:

    type CognitiveFeedbackDialogProps = {
      defaultExpected: string;
      defaultActual?: string;
      streamId: string;
      surface: "chat" | "mindscape" | "voice";
    };
