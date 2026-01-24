# Next Logical Steps (Phase 5.3+)

With the Self-Healing Architecture (Brainstem, Physiology, Arbiter) successfully implemented and verified, the focus shifts to **Visualization**, **Refinement**, and **Production Readiness**.

## 1. UI: The "Brain Monitor"

The backend now has rich physiological state (`energy`, `boredom`, `frustration`), but the user cannot see it.

- **Goal**: Create a real-time visualization in the Mindscape or a dedicated debug panel.
- **Tasks**:
  - Create `useCognitivePhysiology` hook in `apps/web` to poll/stream the new metrics.
  - Render a "HUD" showing the Agent's Energy (Battery), Frustration (Heat Gauge), and Entropy (Waveform).
  - Visualize "Interrupts" (Brainstem triggers) as events in the chat stream.

## 2. Arbiter: Verification Loop

The Arbiter currently resolves merge conflicts and commits. It does **not** verify that the resolution actually compiles or passes tests.

- **Goal**: Ensure the Arbiter doesn't commit broken code.
- **Tasks**:
  - Update `conflict.ts`: After Arbiter execution, run `bun test` (or relevant project test command) in the worktree.
  - If tests fail, ask Arbiter to fix (Multi-turn arbitration).
  - Only return `status: "resolved"` if tests pass.

## 3. Supervisor: Dynamic Thresholds

The `BrainstemSupervisor` currently uses fixed thresholds (60s heartbeat, 0.85 entropy).

- **Goal**: Adapt thresholds to the task context.
- **Tasks**:
  - Allow `toolCodex` to pass a `heartbeatHint` (e.g., `npm install` -> 300s).
  - Scale entropy threshold based on `autonomy` level (High autonomy = allowed to be more repetitive/thorough).

## 4. Advanced Dreaming: Heuristic Validation

The `learning-worker` generates heuristics from error clusters but doesn't validate them.

- **Goal**: Reduce "hallucinated" heuristics.
- **Tasks**:
  - When a heuristic is generated ("Use --no-cache"), spin up a sandbox to _reproduce_ the error and verify the fix.
  - Only promote verified heuristics to the Knowledge Graph.

## 5. E2E: "The Gauntlet"

Run a long-duration stress test.

- **Goal**: Prove stability over 24 hours.
- **Tasks**:
  - Create a script that continuously feeds the agent conflicting/loop-prone tasks.
  - Measure "Mean Time Between Failures" (MTBF) and "Self-Recovery Rate".

## Task Tracker (Ordered by Importance)

1. **Linear failure parity** – Teach the orchestrator’s failure path to call the same Linear lifecycle helpers as the success path so tickets move to a “blocked/failed” state and receive an error summary comment whenever runs abort or crash.
2. **Linear auth + ticket validation** – Harden `ensureLinearTicket` by covering team/authz edge cases (session-only inputs, workspace-scoped tokens) and add unit tests to prove ticket creation skips gracefully when reuse is expected.
3. **Review coverage policy** – Extend `ReviewGate` so Linear-triggered workflows cannot complete with an empty checklist; surface policy knobs to force at least one automated validation (tests, lint, or smoke) before completion.
4. **Webhook completion feedback** – Ensure webhook-driven runs (start/cancel) reuse the completion/failure comment helpers so Linear’s activity log stays consistent even when runs originate outside the UI.
5. **Manual Linear E2E validation** – Execute the documented end-to-end test sequence against a real Linear workspace (start, success, failure, cancel) and record outcomes in `docs/execplans/linear-integration.md` so we have empirical proof beyond unit tests.
6. **Mindscape SSR dynamic imports** – Vite still logs warnings for dynamic imports in `initial-frame.server.ts`, `/api/metrics`, `/api/trpc`, etc. (see the Bun dev output during Playwright runs). Annotate those imports with `/* @vite-ignore */` or replace them with explicit module maps so SSR bundling stops relying on runtime heuristics—otherwise future Mindscape SSR tests can regress silently when the bundler can’t resolve the package names.
7. **Workflow obligation helper rollout** – ✅ Shared `createWorkflowSuspension` now drives both transports, emits `resumeEvents`, records metrics, and comes with a cleanup worker plus `workflow:cleanup` script.
8. **SSE resume E2E harness** – ⚠️ Added a test harness + Playwright spec for the cautious-execute pause/resume happy path; running it is blocked until TanStack Start ignores `apps/web/src/routes/api/__tests__`.
9. **Docs + helper tests** – ✅ Documented the new `workflow-event` shape, updated the ExecPlan, and added `packages/api/test/workflow.suspension.test.ts` to keep the helper contract locked down.
