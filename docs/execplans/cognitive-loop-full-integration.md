# Cognitive loop full integration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Maintain this document in accordance with `.agent/PLANS.md`.

**Owner:** Runtime Architecture  
**Status:** In progress (partial cognitive plumbing shipped; “full integration” incomplete)  
**Created:** 2026-02-02  
**Related:** [Architecture Audit](../architecture/cognitive-architecture.md), [Cognitive Runtime Loop ExecPlan](./cognitive-runtime-loop.md), [Cognitive Package](../../packages/cognitive/)

## Purpose / Big Picture

Sir, the goal of this work is to make ALFRED’s cognitive loop a production steering system, not an isolated subsystem. After this ships, every workflow run and multi-agent pipeline run will:

- Maintain a durable cognitive stream (autonomy + physiology + state) tied to the run.
- Use that state to **change behavior** (plan shape, execution aggressiveness, and automatic suspend/escalation).
- Produce user-visible transparency: “what state is ALFRED in?”, “how autonomous is it right now?”, “why did it ask me?”, “what feedback changed it?”

How you will see it working (end state):

- Start a workflow from the web UI, watch the run stream, and see a cognitive badge (state + autonomy band) update during execution.
- When autonomy is low or physiology indicates strain (high frustration / loop interrupts), the run suspends with a clear reason and a single-click feedback affordance.
- After giving feedback, autonomy changes immediately and the next plan/run reflects that change (more/less approval gates, more/less parallelism, more/less conservative execution).

## Progress

- [x] (2026-02-02) Refreshed this file into the canonical ExecPlan skeleton per `.agent/PLANS.md` (prose-first, required living sections, no nested triple-backtick fences).
- [x] (2026-02-02) Verified “already shipped” cognitive plumbing exists and is exercised by tests/scripts:
  - `packages/runtime/src/loops/cognitive.ts` (event sourcing + autonomy updates + effects)
  - `packages/api/src/routers/cognitive.ts` (state/physiology queries + feedback mutation + learning metrics)
  - `packages/api/src/voice/assistant.ts` (voice → cognitive `input` events)
  - `packages/runtime/src/core.ts` (BrainstemSupervisor interrupts bridged into cognitive loop)
  - `packages/api/src/webhooks/cognitive-bridge.ts` (reminder → cognitive `input` events)
  - `packages/runtime/src/loops/plan-runner.ts` + `packages/runtime/src/loops/resume.ts` (step execution/resume scaffolding)
  - Integration/verification: `packages/api/test/integration/cognitive-full-pipeline.integration.test.ts`, `packages/api/test/integration/workflow-cognitive.integration.test.ts`, `scripts/verify-cognitive-pipeline.ts`, `scripts/verify-full-pipeline.ts`
- [x] (2026-02-02) Workflow runtime now emits cognitive `input` + terminal `complete` events (best-effort) and supports DI injection of `runCognitiveLoop` for deterministic unit tests:
  - `packages/runtime/src/core.ts`
  - `packages/runtime/src/types.ts`
  - `packages/runtime/test/core.test.ts`
- [x] Milestone 0a: Standardize stream id conventions in shared code (`@alfred/cognitive` `resolveStreamId`) and server-side bridges.
- [x] Milestone 0b: Update clients (web/native/tui) to stop hardcoding `"default"` when a better stream id is available (prefer `system:<userId>` for global dashboards; run-scoped UIs should pass `runId`).
- [x] Milestone 1: Thread cognitive context into `@alfred/pipeline` (8-stage) and persist enough to resume deterministically.
  - Set `cognitiveStreamId` + `autonomyLevel` in `PipelineRunner` start paths (`executeFromStage` and `executeFromStageUntil`) and persist via `exportContextStorage`.
  - Map `autonomyLevel` to agent `auto` level in `packages/pipeline/src/stages/execute.ts`.
  - [x] Emit cognitive evidence events from agent outcomes (agent `complete` + blocking `escalate-request`) via API-layer bridge in `packages/api/src/routers/workflow/stream.ts` (keeps `@alfred/pipeline` DB-free).
- [ ] Milestone 2: Thread cognitive context into workflow runtime (scan/plan/act/report) so planning + execution use autonomy/physiology.
  - [x] Implemented: workflow start `input` event + terminal `complete` event in `packages/runtime/src/core.ts` (best-effort; must not break runtime if DB is unavailable).
  - [ ] Still missing: use autonomy/physiology to actually steer planning + act behavior (plan shaping, suspend thresholds).
- [ ] Milestone 3: Make autonomy bands change behavior (plan shaping + execution auto levels + suspend thresholds).
  - Implemented (partial): pipeline now uses `autonomyLevel` to reduce concurrency (prefer sequential plans and sequential scheduling) (`packages/pipeline/src/stages/plan.ts`, `packages/pipeline/src/stages/schedule.ts`).
- [ ] Milestone 4: Close the feedback loop across UI ↔ cognitive ↔ future runs (persist autonomy baseline per user, not in-memory).
  - Implemented: persisted autonomy baseline for `cognitive.autonomyGet`/`cognitive.autonomySet` via `user_preferences` (`packages/api/src/routers/cognitive.ts`).
  - Remaining: update the persisted baseline from run outcomes + `cognitive.feedback` (not just per-run cognitive streams).
- [ ] Milestone 5: UI transparency (HUD indicator + cognitive panel + feedback controls).

## Surprises & Discoveries

- (2026-02-02) This ExecPlan’s original “gap” list was stale: cognitive loop + API + voice + reminder bridge + multiple integration tests already exist. The remaining work is primarily **consumption and threading**, not “build from scratch.”
- (2026-02-02) There are two distinct orchestration surfaces to integrate:
  - `@alfred/pipeline` (8-stage, multi-agent: init/context/plan/schedule/execute/review/learn/summarize)
  - Workflow runtime pipeline (4-phase: scan/plan/act/report inside `packages/runtime/src/core.ts`)
    “Full integration” must cover both surfaces because they are both production execution paths.
- (2026-02-02) `cognitive_snapshots` is currently written by `PlanRunner` but not by `runCognitiveLoop`; full integration should decide where snapshotting belongs and ensure it is exercised by tests.
- (2026-02-02) `PipelineRunner` has two separate execution paths (`executeFromStage` and `executeFromStageUntil`); cognitive context initialization must be applied to both so “run” and “runUntilStage” behave consistently.
- (2026-02-02) `@alfred/cognitive` initially defined `resolveStreamId` but did not export it from the package root; pipeline integration required exporting it via `packages/cognitive/src/index.ts`.
- (2026-02-02) Local dev/test environments may not have Docker/DB available; to keep runtime unit tests deterministic without `mock.module()` pollution, `@alfred/runtime` now supports injecting `runCognitiveLoop` via `RuntimeOptions`.

## Decision Log

- Decision: Treat cognitive streams as run-scoped for workflow/pipeline runs (streamId = runId), and keep conversational streams scoped by thread id (voice uses `threadId`).
  Rationale: Run-scoped streams keep physiology and autonomy signals attributable and resumable without cross-run interleaving; conversational threads remain naturally session-scoped.
  Date/Author: 2026-02-02 / Droid

- Decision: Persist a user-level autonomy baseline (so learning survives across runs) outside the in-memory map in `packages/api/src/routers/cognitive.ts`.
  Rationale: Full integration requires autonomy to evolve over time; in-memory autonomy resets on process restart and does not satisfy “closed-loop learning.”
  Date/Author: 2026-02-02 / Droid

- Decision: Start with polling for UI cognitive freshness (HUD every ~5s, panel faster during active runs), and only add true subscriptions when the semantics are stable.
  Rationale: Polling is simpler and already used (`apps/web/src/hooks/use-cognitive-physiology.ts`). Subscriptions are valuable but must be designed carefully to avoid high-volume streams.
  Date/Author: 2026-02-02 / Droid

## Outcomes & Retrospective

- (2026-02-02) Converted a stale planning doc into a self-contained ExecPlan and re-scoped the work to the true remaining integration gaps (threading + effect consumption + UI transparency).

## Context and Orientation

This section defines the system as if the reader knows nothing about this repository.

In ALFRED, “cognitive loop” means: a durable, event-sourced stream of cognitive events (inputs, feedback, interrupts, outcomes) that drives a state machine, maintains autonomy/physiology, and emits “effects” that boundary layers may execute.

Key terms (plain language):

- **Cognitive stream**: A sequence of events keyed by `streamId` in `cognitive_events`. It is the unit of replay and durability.
- **Cognitive state**: One of `idle/capturing/thinking/deciding/executing/reflecting` plus physiology (energy/boredom/frustration/entropy).
- **Autonomy gradient**: A number in `[0,1]` with confidence/priors that indicates how much the system should act without human confirmation.
- **Effects**: Data returned from the cognitive loop describing what should happen next (`generate_response`, `execute_plan`, `log_reflection`). Effects are not imperative code.
- **Workflow runtime**: The scan/plan/act/report engine in `packages/runtime/src/core.ts` that streams `WorkflowEvent`s.
- **Pipeline**: The separate 8-stage orchestrator in `packages/pipeline/` used for multi-agent execution (waves, review stage, learning stage).

What exists today (evidence you can inspect):

- Cognitive state + event ADT: `packages/cognitive/src/state/types.ts`
- Pure transition: `packages/cognitive/src/transition.ts` (note: transitions are currently conservative; they do not model per-step execution progression)
- Cognitive runtime loop (hydrates from DB, applies transition, updates autonomy on feedback/complete, persists events, returns effects): `packages/runtime/src/loops/cognitive.ts`
- Plan execution scaffolding (step execution + checkpoints + resume scan): `packages/runtime/src/loops/plan-runner.ts`, `packages/runtime/src/loops/resume.ts`
- API surface:
  - `packages/api/src/routers/cognitive.ts` (state/physiology, feedback, learning metrics)
  - `docs/reference/api/cognitive.md` (API reference; may be stale in details—use code as truth)
- Existing UI hooks (partial transparency already present):
  - `apps/web/src/hooks/use-cognitive-physiology.ts` (polls physiology, default streamId “default”)
  - `apps/web/src/hooks/use-cognitive-feedback.ts` (submits feedback)
  - Learning views: `apps/web/src/components/apps/learning/*` use `trpc.cognitive.*`

What is still missing (the actual remaining gap):

- `@alfred/pipeline` now carries `cognitiveStreamId` + `autonomyLevel` and maps autonomy → agent `auto`, but still does not use autonomy/physiology to shape plan structure/review thresholds.
- Tool/agent outcomes are not consistently turned into cognitive evidence events that update autonomy during the run (and persist across runs) without making `@alfred/pipeline` DB-dependent.
- UI does not present a coherent cognitive dashboard (state + autonomy + physiology + “why was I blocked?”) tied to real run streams.
- The `execute_plan` and `log_reflection` effects are not interpreted in a way that changes production behavior (they are mostly logged today).

## Plan of Work

### Milestone 0 — Standardize cognitive stream conventions (no behavior change)

Goal: make “which streamId should I use?” deterministic for every execution surface (workflow runtime, pipeline runs, voice, reminders).

Work:

- Introduce a single helper (one place) to resolve streamId conventions and document the mapping in code comments. The helper should accept `{ runId?, threadId?, userId?, surface }` and return a `streamId` string.
- Update call sites to stop using ambiguous `"default"` when a runId/threadId is available.
- Update `apps/web` cognitive hooks to accept a runId (when in workflow/pipeline UI) instead of defaulting to `"default"` globally.

Acceptance:

- A workflow run UI can query `trpc.cognitive.state({ streamId: runId })` and get the run’s cognitive state.
- Voice continues using `threadId` stream ids and does not collide with run ids.

### Milestone 1 — Pipeline-cognitive bridge for `@alfred/pipeline` (behavior change)

Goal: the 8-stage pipeline uses autonomy/physiology to shape plan generation and execution aggressiveness, and it records cognitive evidence from real outcomes.

Work:

- Add a small, serializable “cognitive context” footprint to pipeline context storage (at minimum `cognitiveStreamId` and the latest `autonomyLevel` number). Do not store non-serializable hook registries or RuntimeContext objects in `PipelineContext`.
  - Update `packages/pipeline/src/context.ts` export list (see `exportContextStorage` key allowlist) to include the new keys so resume works.
- In pipeline stages:
  - At the start of `init` or `context`, initialize cognitive stream for the run by calling `runCognitiveLoop` with an `input` event representing the requirement (source: system).
  - In `plan`, pass autonomy/physiology into `@alfred/plan/generate` via prompt hints or explicit options (see Milestone 3).
  - In `execute`, map autonomy band to agent `auto` level so spawned agents are more/less autonomous.
  - On `agent:complete`, emit a cognitive evidence event that updates autonomy (success/failure) and physiology (energy/frustration).
- Ensure suspend/escalation semantics align: when pipeline suspends due to blocking escalation or review gate, emit a cognitive interrupt event with a stable reason code (so the run’s physiology can reflect “this became hard/blocked”).

Acceptance:

- A single pipeline run produces multiple cognitive events for the runId stream and the autonomy level changes at least once in the run (success/failure dependent).
- Resume works: suspending and resuming a run does not lose cognitive stream continuity and does not crash due to missing context.
- Pipeline tests cover the cognitive bridge:
  - Add/extend tests under `packages/pipeline/test/integration/resume-roundtrip.test.ts` and/or a new focused integration test.

### Milestone 2 — Workflow runtime cognitive steering (behavior change)

Goal: the scan/plan/act/report workflow runtime uses cognitive state as a steering input, not just as an interrupt sink from the supervisor.

Work:

- On workflow start, initialize the run’s cognitive stream (input event = requirement).
- On workflow terminal state (completed/failed/cancelled), emit a cognitive `complete` event with an `Outcome` derived from the workflow terminal state.
- In `plan` and `act` phases, read the current autonomy/physiology and:
  - reduce parallelism / increase explicitness when autonomy is low
  - suspend early when frustration is high or repeated loop interrupts occur

Acceptance:

- `packages/api/test/integration/workflow-cognitive.integration.test.ts` is extended so it asserts at least one autonomy update on workflow completion (not just event persistence).
- Supervisor-triggered interrupts continue to bridge into cognitive stream (existing behavior in `packages/runtime/src/core.ts`) and do not regress.

### Milestone 3 — Autonomy-aware planning (behavior change)

Goal: planning output differs depending on autonomy, and low autonomy causes explicit approval gates rather than silent execution.

Work:

- For the 8-stage pipeline planner (`packages/pipeline/src/stages/plan.ts`), pass autonomy/physiology into `@alfred/plan/generate`:
  - Add a new optional parameter to `generatePlan` / `generatePhasedPlan` (or a `variantHint`) that includes autonomy band + physiology flags.
  - Ensure the resulting plan is more granular at low autonomy (more phases/tasks, clearer acceptance, more “review” checkpoints).
  - Ensure high-risk steps result in explicit review gate requirements when autonomy is insufficient (use `@alfred/cognitive/logic/autonomy` thresholds as the single source of truth).
- For the workflow runtime planner (`packages/runtime/src/phases/plan.ts`), incorporate autonomy/physiology into the system prompt and/or into the “Auto Level” field that is already surfaced to the planner.

Acceptance:

- Add a unit test in `packages/plan` that proves autonomy changes the prompt/options (fast, deterministic; does not require live LLM calls).
- Add a pipeline integration test that asserts low autonomy produces more explicit phases/tasks or inserts review obligations.

### Milestone 4 — Close the feedback loop (behavior change)

Goal: user feedback and real outcomes both update autonomy in a way that persists across restarts and influences future runs.

Work:

- Replace the in-memory autonomy settings map in `packages/api/src/routers/cognitive.ts` with persistence (prefer user preferences via `@alfred/db/repo/user`).
- When `cognitive.feedback` is called, update both:
  - the run/thread cognitive stream (for local reasoning), and
  - the persisted user autonomy baseline (for future runs).
- Ensure at least one UI surface provides feedback affordances tied to a real run (initially: workflow window or learning app).

Acceptance:

- Add an API integration test that submits feedback, restarts caller state (fresh router instance), and verifies autonomyGet reflects the stored value.
- In web UI, submitting feedback shows success and a follow-up query indicates autonomy changed.

### Milestone 5 — UI transparency (behavior change)

Goal: cognition is visible and actionable for the user.

Work:

- Add a small HUD indicator (state + autonomy band + physiology alerts) to the web desktop HUD (the HUD already polls physiology).
- Add a dedicated panel/window (web + native parity later) that shows:
  - current state (`idle/capturing/...`)
  - autonomy level + band label
  - physiology meters
  - recent cognitive events (count + latest reasons)
  - one-click feedback controls tied to the current run/thread

Acceptance:

- A user can open the cognitive panel and see live values changing during a workflow run.
- A user can submit feedback from the panel and see autonomy update without a reload (query invalidation).

## Concrete Steps

This section is intentionally repetitive: it’s how a novice executes and validates the plan.

1. In repo root, install dependencies:

   bun install

2. Run the already-existing cognitive verification (fastest sanity check):

   bun scripts/verify-cognitive-pipeline.ts

3. Run the already-existing cognitive integration tests:

   bun test packages/api/test/integration/cognitive-full-pipeline.integration.test.ts
   bun test packages/api/test/integration/workflow-cognitive.integration.test.ts

4. Run pipeline integration tests before and after Milestone 1:

   bun test packages/pipeline/test/integration/golden-path.test.ts
   bun test packages/pipeline/test/integration/resume-roundtrip.test.ts

5. When touching UI, run web tests relevant to the new components (keep scope tight):

   bun --cwd apps/web test

## Validation and Acceptance

The work is acceptable when all of the following are true:

- A pipeline run (8-stage) and a workflow run (scan/plan/act/report) both emit cognitive events to a deterministic streamId, and autonomy visibly updates from outcomes.
- Low autonomy meaningfully changes behavior (more explicit planning and/or forced review gates, reduced automatic execution).
- UI shows cognitive state, autonomy, and physiology in a way a user can understand without reading logs.
- Tests and verification scripts listed in `Concrete Steps` pass.

## Idempotence and Recovery

- All cognitive writes must be safe to retry. If an event append fails, the caller must either (a) retry once with a bounded backoff, or (b) log and continue with safe defaults.
- Pipeline/workflow execution must never fail solely because cognitive persistence is unavailable; in that case, default to conservative autonomy and require explicit approval for risky actions.
- Do not store non-serializable objects in `PipelineContext` (hooks registries, runtime contexts, tool instances). Store only IDs, numbers, and small JSON objects.

## Artifacts and Notes

Keep these short, high-signal artifacts in the ExecPlan as the work progresses:

- New/updated test file paths and the specific assertions they add (especially around autonomy changes and suspend triggers).
- A small excerpt of the pipeline/workflow event stream showing cognitive state changes (event types + timestamps only; no raw user/code content).
- Any performance regressions and the measurements used to detect them.

## Interfaces and Dependencies

Minimum stable interfaces that must exist by the end:

- A canonical stream id resolver used by workflow runtime, pipeline runs, voice, and UI.
- A serializable cognitive footprint in pipeline/workflow contexts (`cognitiveStreamId`, `autonomyLevel`, and optionally `physiology`).
- A persistence-backed autonomy baseline for the user (not in-memory).
- UI components that consume only API data (tRPC) and never import server-only modules.
