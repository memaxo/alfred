# Mindscape Droid Execution Node

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Target: ALFRED core UI. Mindscape currently lets the user chat, manage workflows, and inspect artifacts, but there is no place to run the policy-gated `droid` executor with obligation-aware streaming. After this change, users can spawn a dedicated Droid node inside Mindscape, enter prompts, watch stdout/stderr in real time, satisfy biometric obligations when policy demands them, and resume the same stream without leaving the canvas. The flow matches the server-side `droid.stream` behaviour described in `docs/reference/droid-resume.md`. Acceptance is visible by starting the web app (`bun run dev:web`), navigating to `/mindscape`, spawning the Droid node via ⌘K, kicking off a run, seeing live log lines, and observing a biometric dialog when the mock stream emits an obligation event.

## Progress

- [x] (2025-11-24 18:25Z) Captured scope, documented context, and chose Mindscape node placement.
- [x] (2025-11-24 20:05Z) Added `droid` schemas/types, spawn affordances, command palette metadata, and a shared TRPC client so the node can be instantiated anywhere.
- [x] (2025-11-24 20:45Z) Built the `DroidNode` UI, expanded `subscribeToDroidStream`, and wired `useBiometricResume` + the biometric dialog.
- [x] (2025-11-24 21:10Z) Landed a Bun test that simulates stdout, obligation, resume, and exit to cover the suspend/resume loop deterministically.
- [ ] Add Playwright e2e covering suspend → biometric → resume.
- [ ] Run `bun test` (targeted web suites) + `bunx playwright test --config apps/web/playwright.config.ts --project=e2e` and update Outcomes.

## Surprises & Discoveries

- Observation: `apps/web/src/components/mindscape/command-palette.tsx` only contained placeholder comments for `createActions`, which meant ⌘K never listed any nodes.
  Evidence: After wiring a real metadata table (chat, workflow, droid, etc.), the palette immediately surfaced the entries and the new Droid node became discoverable again.

## Decision Log

- Decision: Host the droid execution UI as a singleton Mindscape node (`type: "droid"`) accessible from the command palette.
  Rationale: Droid executions are long-running, policy-gated tasks similar to workflows/terminal sessions. A dedicated node keeps the experience consistent with other cognitive tools, allows spatial persistence, and avoids burying the feature behind ephemeral chat actions.
  Date/Author: 2025-11-24 / Codex
- Decision: Auto-spawn a Droid node during Mindscape initialization (once per session) so the executor is reachable even if the palette is unavailable.
  Rationale: Until the palette metadata was restored, users could not create the node manually; seeding a singleton prevents a locked-out experience while respecting deletions within the same session.
  Date/Author: 2025-11-24 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Mindscape renders graph nodes via `apps/web/src/components/mindscape/canvas.tsx`, using zustand state from `apps/web/src/store/mindscape.ts` and schemas in `apps/web/src/store/mindscape.schemas.ts`. Node implementations live under `apps/web/src/components/mindscape/nodes`. Streaming workflows already use `trpc.workflow.stream.useSubscription` in `apps/web/src/components/mindscape/monitor.tsx`, and workflow form logic sits in `workflow-node.tsx`. Droid transport lives on the API side (`packages/api/src/routers/droids.ts`) with a `droid.stream` subscription that may emit `type: "obligation"` payloads requiring biometric elevation before resuming. The web app has a helper `apps/web/src/lib/droid/stream-client.ts`, a biometric flow hook `apps/web/src/hooks/use-biometric-resume.ts`, and token helper `apps/web/src/lib/token.ts`, but no UI currently consumes `subscribeToDroidStream`. Tests are split between component/route tests under `apps/web/src/tests` (Bun) and Playwright suites under `apps/web/tests`.

## Plan of Work

1. **Data model + spawning (files: `apps/web/src/store/mindscape.schemas.ts`, `apps/web/src/store/mindscape.ts`, `apps/web/src/components/mindscape/spawn.ts`, `apps/web/src/components/mindscape/command-palette.tsx`, `apps/web/src/components/mindscape/canvas.tsx`).**
   - Define `droidNodeDataSchema` with fields for `prompt`, `auto`, `out`, `status`, `log`, `lastRunId`, and optional `error`/`history` entries. Extend `artifactDataSchema`, `ArtifactType`, and `getNodeDataSchema` to include `droid`.
   - Add `droid` to `mindscapeSpawnTypes`, provide a default node (label "Droid Exec", idle status, default auto `low`, out `text`). Mark as singleton so only one node exists by default.
   - Insert a command palette entry (icon, label, description) so ⌘K → "Droid" spawns the node.
   - Register `droid` in `nodeTypes` (canvas) referencing the soon-to-be-created component.

2. **Shared TRPC proxy client + helper upgrades (files: `apps/web/src/lib/trpc-client.ts` new, `apps/web/src/router.tsx`, `apps/web/src/lib/droid/stream-client.ts`).**
   - Extract the existing link configuration (split between batch + `unstable_httpSubscriptionLink`) into a reusable factory; export both the React client (for providers) and a proxy client for imperative use in the Droid node.
   - Update `subscribeToDroidStream` to accept optional callbacks `onEvent`, `onError`, `onComplete`; normalize obligation/resume payloads; and forward every event (stdout/stderr/exit) so consumers can update logs without duplicating parse logic.

3. **DroidNode component (new file `apps/web/src/components/mindscape/nodes/droid-node.tsx`).**
   - UI shell: follow `MindscapeNode` conventions with LOD states, header title, prompt textarea, autonomy selector, output viewer (scrolling mono log), run/stop buttons, status badges, and optionally recent history list.
   - Logic: use `useMindscapeStore` to persist node data; request tool tokens via `getToolToken` scoped to `droid.exec`; lazily instantiate the proxy client (memoized) and call `subscribeToDroidStream` on run.
   - Manage local state for `log` entries, `status`, and `suspendedRunId`. Append stdout/stderr text, mark completion when `exit` event arrives, and handle errors via `toast`.
   - Wire `useBiometricResume({ runId: suspendedRunId, target: "droid" })`, triggering it when `onObligation` fires and clearing when `onResume` arrives. Surface the existing `BiometricChallengeDialog` by feeding it `isOpen/pendingRunId`, or, if that dialog remains unused elsewhere, document the reason and rely on the hook's built-in passkey prompts.
   - Clean up subscriptions on unmount or when starting a new run; expose a stop button that cancels the observable subscription.

4. **Testing (unit + e2e).**
   - Add a Bun test (e.g., `apps/web/src/components/__tests__/droid-node.e2e.test.tsx`) mocking `subscribeToDroidStream`, `getToolToken`, and `useBiometricResume` to assert: (a) prompt submission requests tokens and starts streams, (b) obligation event flips to suspended and calls the biometric trigger, (c) resume continues and exit flushes logs.
   - Create a Playwright spec `apps/web/tests/droid-resume.e2e.spec.ts` that intercepts `/api/trpc/droid.stream` to emit an obligation chunk followed by resume/stdout/exit, intercepts `/api/trpc/droid.resume` to succeed, and asserts the Mindscape UI surfaces the prompt, logs, and resume badge. Use a mock user session via `signUpTestUser` and expose deterministic store setup (e.g., auto-spawn droid node via `window.__MINDSCAPE_STORE__`).

5. **Validation + documentation updates.** Ensure README/docs mention the new node if needed (likely covered by UI). Capture any surprises in the plan, mark progress, and summarize outcomes once tests pass.

## Concrete Steps

1. `cd apps/web && bun test` (targeted file paths) to validate component/unit tests once written.
2. `bunx playwright test --config apps/web/playwright.config.ts --project=e2e --grep "droid"` to run the new suspend/resume scenario.
3. `bun run test:mindscape:e2e` if broader regression confidence is needed after wiring the Playwright spec.
4. `bun run typecheck --filter web` (or `cd apps/web && bun run typecheck`) to keep TypeScript references aligned after schema changes.

## Validation and Acceptance

- From `/mindscape`, spawning "Droid Exec" shows the node with prompt input, autonomy selector, run button, and log panel.
- Running a prompt displays streaming stdout/stderr text inside the node and transitions status badges (`running → suspended → running → completed`).
- When the mocked `droid.stream` emits an obligation, the biometric dialog (or at minimum the passkey prompt from `useBiometricResume`) opens, and the same stream continues after resume without resetting logs.
- Playwright spec `droid-resume.e2e.spec.ts` passes, proving the suspend → biometric → resume loop.
- `bun test` suites covering the node logic pass, ensuring deterministic coverage of obligations and exit handling.

## Idempotence and Recovery

All UI changes are additive. Re-running `bun test` or the Playwright spec is safe because mocked network handlers reset per test. The Droid node stores its state in zustand, so leaving/reloading `/mindscape` persists data without migration. If the stream fails mid-run, the subscription cleanup logic tears down the observable; rerunning the prompt spawns a new stream. No migrations or destructive operations are involved.

## Artifacts and Notes

- None yet. Capture notable diffs (e.g., proxy client extraction) or stream transcripts here after implementation if they aid future readers.

## Interfaces and Dependencies

- `apps/web/src/lib/droid/stream-client.ts`: extend `subscribeToDroidStream(options)` so `options` includes `{ onEvent?: (event: DroidStreamEvent) => void; onObligation?: ...; onResume?: ... }` and it returns an object with `.unsubscribe()`.
- `apps/web/src/components/mindscape/nodes/droid-node.tsx`: expose internal helpers only through the node component; keep functions pure where possible and under 50 lines by extracting log formatting helpers to local functions.
- `droidNodeDataSchema`: shape `{ prompt?: string; auto?: "read"|"low"|"medium"|"high"; out?: "text"|"json"|"debug"; status?: "idle"|"running"|"suspended"|"completed"|"failed"; log?: Array<{ id: string; channel: "stdout"|"stderr"; text: string; at: string }>; lastRunId?: string; error?: string }`.
- Tests should import the node via `MindscapeNode` registry to stay close to production and mock TRPC/token helpers via `mock.module`.
