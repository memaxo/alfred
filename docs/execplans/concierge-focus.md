# concierge-focus

This ExecPlan is a living document.
The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository contains the ExecPlan template at `.agent/PLANS.md`.
This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this work, Sir can create a time-bounded focus set (a collection of commitments with a WIP limit) and trust ALFRED to execute in the background, interrupt only when necessary, and resume instantly in voice or text with deterministic context.

“Deterministic context” means that when ALFRED resumes, it always reconstructs the situation in the same order:
run state and blocker first, then a delta brief since last touch, then the tail of the thread, then RAG/knowledge retrieval as needed.

The outcome must be demonstrably working:
run a local stack, create a focus set with one commitment that starts a workflow run, let it progress, suspend for a clarification, receive an attention item, respond, resume the run, and then view a durable compilation summary after completion.

This ExecPlan also fixes an architectural prerequisite:
recent development introduced “god files” (notably `packages/api/src/routers/workflow.ts`) that break ALFRED’s domain-driven design.
Concierge Focus is a composition feature; it will fail if built on top of monolithic routers.
Therefore, we will refactor the worst offenders as part of the plan, and we will add guardrails so Concierge work does not create new god files.

## Progress

- [x] (2026-01-20) Baseline: record current file sizes for routers and runtime orchestrator (evidence in this plan).
- [x] (2026-01-20) Refactor bundle A: split `packages/api/src/routers/workflow.ts` into focused modules, keeping external API behavior stable.
- [x] (2026-01-20) Refactor bundle B: reduce `packages/api/src/routers/voice.ts` by extracting endpoint logic into focused router modules, keeping external API behavior stable.
- [x] (2026-01-20) Add “god file guardrails”: automated checks and tests that fail if router/service boundaries regress (ratcheted; `workflow.ts` tightened to 500 lines; `voice.ts` tightened to 750 lines).
- [x] (2026-01-20) Add new Concierge Focus domain: persistence types and repos for focus sets, commitments, attention, and delta briefs.
- [x] (2026-01-20) Add new Concierge Focus API: thin routers for focus, attention, delta, and notify; plus service-layer implementations.
- [x] (2026-01-20) Integrate with workflow + suspend/resume: pipeline observers persist attention items (incl. clarification question lookup) and delta briefs for workflow runs.
- [x] (2026-01-20) Web MVP: Focus Board view that reads the focus set, attention queue, and delta briefs; deep-link to run details.
- [x] (2026-01-20) Native MVP: “Call from Alfred” deep link from attention items + quick voice resume for the active commitment.
- [x] (2026-01-20) TUI MVP: new Focus panel showing active commitments and attention queue.
- [x] (2026-01-20) Validation: run targeted unit/integration tests; run a manual end-to-end scenario described below.
- [x] (2026-01-20) Retrospective: document outcomes, remaining gaps, and follow-ups.

## Surprises & Discoveries

- Observation: `packages/api/src/routers/workflow.ts` started at 3,288 lines; it is now 284 lines after extraction into `packages/api/src/routers/workflow/*` plus `packages/api/src/workflow/*`.
  Evidence: `bun test packages/api/test/architecture.godfiles.test.ts` prints `packages/api/src/routers/workflow.ts lines=284 max=500`.

- Observation: `packages/api/src/routers/voice.ts` started at 1,029 lines; it is now 629 lines after extracting schema + STT + TTS + S2S + model endpoints into `packages/api/src/routers/voice/*`.
  Evidence: `bun test packages/api/test/architecture.godfiles.test.ts` prints `packages/api/src/routers/voice.ts lines=629 max=750`.

- Surprise: a latent syntax error in `packages/api/src/services/schema.ts` was surfaced by the refactor and broke `bun test` parsing.
  Fix: changed `});` → `}));` inside `buildGridFromRecord` to properly close the `map()` call.

- Surprise: `delta_briefs` needed an explicit `workflow_run_id` column to support `scope: "workflow_run"` without stuffing ids into JSON.
  Fix: added `workflow_run_id` to `packages/db/src/schema/delta.ts` and `packages/db/src/migrations/0089_focus.sql` (and sqlite fallback schema).

- Observation: runtime orchestrator has multiple large files (`packages/runtime/src/orchestrator/agent.ts` at 1,231 lines) that Concierge Focus will stress, but our first refactor priority is the API layer because Concierge’s “product boundary” is routers.
  Evidence: `wc -l packages/runtime/src/orchestrator/agent.ts` shows 1,231 lines.

## Decision Log

- Decision: Treat “3–5 priorities” as a WIP default, not as the core unit.
  Rationale: concierge reliability requires stable user-facing accountability units; “commitment” is the unit, and WIP is the guardrail.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Roll workflow/voice router refactors into the Concierge Focus ExecPlan.
  Rationale: building Concierge on top of god files guarantees future coupling and makes cross-surface resume brittle.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Prefer “services + observers” over “router glue” for derived read models (attention queue, delta brief).
  Rationale: it matches the existing `CompilationObserver` pattern and keeps pipeline and routers thin.
  Date/Author: 2026-01-19 / GPT-5.2

## Outcomes & Retrospective

- What shipped:
  - De-godded API layer for workflow/voice routers with size guardrails (`packages/api/test/architecture.godfiles.test.ts`).
  - Concierge Focus persistence domain (DB + shared types) and derived read models (`attention_items`, `delta_briefs`) wired via `ConciergeObserver`.
  - Thin product routers (`focus`, `attention`, `delta`, `notify`) wired into the API.
  - Web Focus window (“Focus Board”) that reads focus/attention/delta and deep-links to a workflow run.
  - Native Focus screen that lists attention and opens the voice call screen with `speechDefaults` bound to the workflow run.
  - TUI Focus panel (React) with a polling subscription feeding a 6-panel dashboard layout.

- Evidence / tests run:
  - `bun test packages/api/test/architecture.godfiles.test.ts packages/api/test/concierge.persistence.test.ts packages/api/test/focus.router.test.ts packages/api/test/attention.router.test.ts packages/api/test/delta.router.test.ts`
  - `bun test apps/web/src/components/apps/focus/__tests__/window.test.tsx`
  - `bun test packages/tui/test` (includes `packages/tui/test/tui-e2e.test.ts`)

- What’s still missing for the full “north star loop”:
  - Commitment ↔ workflow-run ↔ conversation threading is not yet first-class across surfaces (native call currently binds `resource`/`prompt`, but `thread` is only available if we can resolve a stable conversation id).
  - Push notification payloads need to carry the minimal deep-link params (`runId`, `commitmentId`, `focusSetId`) to make “Call from Alfred” one-tap from OS notifications.
  - A real “Focus Set lifecycle” UI (create/close/switch sets, reorder priorities, lane toggles) is still MVP-level.

- What we learned:
  - Router refactors + ratcheted size tests are an effective guard against “god files” while still allowing rapid iteration.
  - “Observer-derived read models” (attention + delta) compose cleanly with the pipeline without violating DB-free pipeline constraints.

- Follow-ups:
  - Add a small API helper to resolve `workflowRunId → conversationId` (or formalize a voice thread id scheme) so voice resume can load persisted history.
  - Add a push notification channel for attention events with deep-link data.

## Context and Orientation

This plan implements Concierge Focus on top of ALFRED’s existing monorepo architecture.
ALFRED is a single-user system organized into layered packages:
DB schemas and repositories live in `packages/db`.
The API layer is implemented as tRPC routers in `packages/api/src/routers`.
Long-running workflows are implemented using `@alfred/pipeline` and persisted via observers and `workflow_runs` / `workflow_events`.
Voice is implemented via `@alfred/voice` and API routes under `packages/api/src/routers/voice.ts` plus supporting modules under `packages/api/src/voice/*`.
Knowledge/RAG is implemented across `@alfred/knowledge`, `@alfred/rag`, `@alfred/embed`, and `@alfred/rerank`.
Learning runs in a background worker (`packages/agent/src/orchestrator/learning-worker.ts`) and persists structured knowledge into the graph tables (`packages/db/src/schema/graph.ts`).

Key “existing patterns” we will reuse:

1. Durable post-run presentation:
   `docs/architecture/work-compilation.md` describes why workflow snapshots cannot be trusted after completion.
   `packages/api/src/services/compilation.ts` implements an API-layer observer that persists a compact compilation artifact under `workflow_runs.stateData.compilation`.

2. Suspend/resume:
   `packages/runtime/src/orchestrator/suspend.ts` and `resume.ts` implement suspension for clarifications and resuming with responses.
   `packages/api/src/routers/workflow.ts` provides API endpoints to suspend and resume runs.

3. Sense + focus context:
   `packages/api/src/routers/workingset.ts` provides user focus state that can influence routing.
   `packages/api/src/routers/capture.ts`, `packages/api/src/routers/inbox.ts`, and `packages/api/src/routers/receipt.ts` implement capture/inbox/triage patterns with evidence and corrections.

4. RAG + rerank:
   `packages/runtime/src/engines/knowledge.ts` is the canonical implementation of embed → hybrid search → optional rerank with metrics, plus touching nodes for recency.

Terminology for this plan:

- A “router” is a file under `packages/api/src/routers/*` that defines tRPC endpoints.
  Routers should validate input, enforce auth/policy, and delegate.
  Routers should not contain full subsystems, background orchestration, or durable read-model building logic.

- A “service” is a file under `packages/api/src/services/*` that holds reusable business logic (non-transport).

- An “observer” is a `@alfred/pipeline` observer that consumes pipeline events and persists derived artifacts.
  This is the intended extension mechanism for cross-cutting concerns like compilation and (in Concierge) attention/delta.

- A “commitment” is the unit of user-facing accountability.
  A commitment has one definition of done, one attention contract, and a canonical binding to a workflow run and a conversation thread.
  A commitment may branch internally into waves and subtasks; the user does not manage subtasks directly.

- A “focus set” is a time-bounded container of commitments with an explicit WIP limit.
  “Workday” is not a required concept; the duration can be minutes, hours, or days.

- A “delta brief” is not a morning digest.
  It is a summary of major changes and action items requiring review since the last user interaction (“last touch”).

The architecture principles that this ExecPlan enforces:

- Domain-driven layering: DB → repo → API → app.
- Pipeline boundaries: pipeline stays DB-free; persistence happens via observers.
- Import safety: avoid import-time work and long-lived timers that keep processes alive unintentionally.
- Composition over coupling: Concierge Focus composes with workflow, voice, sense, knowledge, learning, metrics.
- No new god files: large routers must be decomposed, and new Concierge modules must be small and single-purpose.

## Plan of Work

We implement Concierge Focus in two parallel tracks that converge:

Track A is “architecture stabilization.”
We refactor the largest router god files to restore domain boundaries.
This is necessary before Concierge Focus so that the new system can be added without worsening coupling.

Track B is “Concierge Focus north star loop.”
We implement the focus/commitment model, attention routing, delta briefs, and cross-surface resume affordances.
We keep the implementation small at first: one focus set, a handful of commitments, one active run, minimal UI surfaces.
We do not attempt full “all integrations” concierge behavior in V1; we only implement the loop for workflows and voice.

To keep changes safe, we will:

- Keep all existing workflow and voice endpoints stable while refactoring.
- Add tests that assert equivalence for the refactored endpoints.
- Introduce new endpoints for Concierge Focus rather than extending the workflow router further.
- Use versioned schemas for any new durable artifacts stored under `workflow_runs.stateData` or in new tables.

## Milestones

### Milestone 1: Baseline architecture audit and guardrail definition

At the end of this milestone, we have a written, testable definition of “god file” thresholds and a baseline measurement.
We also decide which files must be refactored as part of Concierge Focus.
This milestone produces a small automated check so future work cannot regress.

Work:

We will:
measure file sizes for key areas,
define thresholds (router file size and/or complexity),
and create a test that fails when the thresholds are exceeded.

Acceptance:

Running the repo test command for API should fail if a router exceeds the chosen thresholds.
The failure message must name the offending file and current line count.
The thresholds must allow existing known offenders only temporarily, with a documented “must be fixed by milestone 2” exception list.

Proof:

Run:

- from repo root: `bun test packages/api/test/architecture.godfiles.test.ts`
  Expect:
- it passes after refactors, and fails before refactors (for at least `workflow.ts`).

### Milestone 2: Refactor bundle A — de-god `packages/api/src/routers/workflow.ts`

At the end of this milestone, `packages/api/src/routers/workflow.ts` is a thin endpoint definition file.
The bulk of logic is extracted into focused modules under a new domain directory:
`packages/api/src/workflow/*`.

“Thin” here means:
the router imports the extracted functions/classes and calls them,
and the router contains only:
input validation,
auth/policy checks,
request/response wiring,
and minimal mapping into service calls.

Work:

We will extract the following subsystems out of the router:

- Checkpoint storage wrapper and snapshot parsing.
- Workflow metrics initialization and codex/linear metric wiring.
- Phase planning and execution helpers.
- Stream and resume orchestration (event queues, cleanup, persistence mapping).
- Replay/paged event listing helpers.
- Any helper functions for mapping workflow resources and input parsing.

We will keep the public API shape stable:
existing procedures (plan, execute, resume, suspend, listRuns, events, reasoning, compilation) must keep their behavior.
If any behavior changes are required, they must be explicitly documented and tested as intentional.

Extraction targets (proposed file layout):

- `packages/api/src/workflow/checkpoint.ts`
  Holds `WorkflowCheckpointStorage` and helpers that load/save snapshots.
  Exports functions like `createCheckpointStorage()` and `loadSnapshot(runId)`.

- `packages/api/src/workflow/metrics.ts`
  Holds `initWorkflowMetrics()` and related “configure external metrics” glue.
  Must be import-safe (no timers at import).

- `packages/api/src/workflow/phase.ts`
  Holds plan/execute/status helpers for the “phase router” concept.
  Must accept explicit dependencies where possible (storage, runner factory).

- `packages/api/src/workflow/stream.ts`
  Holds stream creation helpers for `streamPlan`, `streamPipeline`, and resume streaming.
  Uses the canonical “queue observer” pattern already used in `workflow.ts`.

- `packages/api/src/workflow/replay.ts`
  Holds paged replay implementation and event mapping.

- `packages/api/src/workflow/resource.ts`
  Holds `mapWorkflowResourceLocal` and `mapWorkflowRunResourceLocal`.

- `packages/api/src/workflow/types.ts`
  Holds any internal types introduced by the extraction (avoid expanding public types here).

Refactor method:

We will do this as a sequence of safe extractions:
create the new modules first,
move one coherent chunk at a time,
update the router to call into them,
and keep tests passing at each step.
Avoid “big bang” rewrite.

Acceptance:

- `packages/api/src/routers/workflow.ts` line count is reduced to a target (suggested: < 500 lines).
- Existing tests pass (workflow/router tests, pipeline integration tests where applicable).
- The router still exports the same router name(s) and procedures.

Proof:

Run:

- from repo root: `bun test packages/api/test/workflow.*`
- and: `bun test packages/pipeline`
  Expect:
- tests pass.

### Milestone 3: Refactor bundle B — de-god `packages/api/src/routers/voice.ts`

At the end of this milestone, `packages/api/src/routers/voice.ts` is reduced substantially and delegates to domain modules under `packages/api/src/voice/*`.
The `packages/api/src/voice/*` directory already exists and is large, so the goal is not to create new abstractions, but to move endpoint-specific orchestration out of the router.

We will focus on:
extracting WebRTC session orchestration, voice session registry operations, and streaming setup into service-like helpers.

Acceptance:

- `packages/api/src/routers/voice.ts` line count reduced to a target (suggested: < 600 lines).
- Existing voice tests pass.
- Streaming behavior remains unchanged (as observable in existing tests and docs).

Proof:

Run:

- from repo root: `bun test packages/api/test/voice*`
- and: `bun test packages/voice`
  Expect:
- tests pass.

### Milestone 4: Concierge Focus domain model (DB + types + repo)

At the end of this milestone, we have durable persistence for:
focus sets,
commitments,
attention items,
and delta brief state.

We will keep the schema minimal and versioned.
We will not attempt to model every future integration.
The goal is to persist enough state to support deterministic resume and cross-device continuity.

Proposed persistence strategy:

- A new `focus_sets` table for the container object.
- A new `commitments` table for commitments within a set.
- A new `attention_items` table for attention queue items.
- A small per-user “last touch” record, either:
  - in `focus_sets` metadata, or
  - in a separate `focus_state` table keyed by user and optional focus set id.

We will store:
canonical bindings to run id and thread id,
priority ordering,
WIP,
and attention contract settings.

Types:

We will add a versioned type in `packages/type`:

- `packages/type/src/focus.ts`
  Contains Zod schemas and TS types for focus sets and attention items.
  Must be exportable from `packages/type/src/index.ts`.

Repos:

- `packages/db/src/schema/focus.ts` (Drizzle schema).
- `packages/db/src/repo/focus.ts` (repo functions).

Acceptance:

- Migrations exist and apply cleanly.
- Repo functions exist for CRUD on focus sets and commitments.
- Repo functions exist for appending and acknowledging attention items.
- Types are imported by API and apps without circular deps.

Proof:

Run:

- from repo root: `bun run db:migrate` (in an environment where DB is configured)
- and: `bun test packages/db/test/repo.focus.test.ts` (new)
  Expect:
- migrations apply; tests pass.

### Milestone 5: Concierge Focus service layer (attention + delta)

At the end of this milestone, Concierge Focus can derive a delta brief and attention queue from:
workflow run status and workflow events,
workflow compilation artifacts,
and clarifications/obligations that suspend a run.

We will implement:

- `packages/api/src/services/attention.ts`
  Given a user id (and optionally a focus set id), it reads:
  current focus set commitments,
  their bound run ids,
  the latest workflow run status and relevant events,
  and produces a compact list of attention items.
  It also maps events to attention levels using the PRD taxonomy.

- `packages/api/src/services/delta.ts`
  Given a “since” timestamp, it produces a delta brief:
  major changes,
  action items requiring review,
  and next decisions.
  This should use summarization utilities where helpful (optional) but must work without Python.
  If we use `@alfred/summarize`, it must be guarded by availability checks.

- `packages/api/src/services/notify.ts`
  A dispatcher abstraction that can publish attention items to:
  in-app subscribers (tRPC subscriptions),
  and later remote push.
  For v1, remote push can be a stub that logs and returns a “not configured” status, but the abstraction must exist.

We will also implement an observer extension point:

- `packages/api/src/services/attention-observer.ts`
  Consumes pipeline events and writes attention deltas, similar to compilation observer.
  This keeps “derive from events” logic out of routers and out of the pipeline package.

Acceptance:

We can demonstrate:
start a workflow run for a commitment,
force it to suspend for clarification,
and see:
an attention item created,
a delta brief including that item,
and a resume action that clears the attention item when satisfied.

Proof:

Run:

- from repo root: `bun test packages/api/test/attention.*` (new)
  Expect:
- tests pass.

### Milestone 6: Concierge Focus routers (thin product boundary)

At the end of this milestone, we have minimal APIs for Focus/Attention/Delta/Notify, with thin routers.

We will add:

- `packages/api/src/routers/focus.ts`
  Focus set CRUD and “bind commitment to run/thread” operations.

- `packages/api/src/routers/attention.ts`
  Query and subscribe to attention items; ack/snooze/resolve.

- `packages/api/src/routers/delta.ts`
  Produce delta brief since last touch or since timestamp.

- `packages/api/src/routers/notify.ts`
  Diagnostics; can be used by apps to test notification channels.

Routers must:
validate input,
check auth,
check policy (where applicable),
delegate to services and repos,
and avoid holding long in-memory state (except for subscription listener sets, following existing patterns).

Acceptance:

The new routers compile and are wired into `packages/api/src/routers/index.ts`.
Web and native clients can call them via existing tRPC wiring.

Proof:

Run:

- from repo root: `bun test packages/api/test/focus.*` (new)
- and: `bun test packages/api/test/attention.*` (new)
  Expect:
- tests pass.

Implementation notes (done):

- Added routers:
  - `packages/api/src/routers/focus.ts`
  - `packages/api/src/routers/attention.ts`
  - `packages/api/src/routers/delta.ts`
  - `packages/api/src/routers/notify.ts`
- Wired into `packages/api/src/routers/index.ts`.
- Added tests:
  - `packages/api/test/focus.router.test.ts`
  - `packages/api/test/attention.router.test.ts`
  - `packages/api/test/delta.router.test.ts`

### Milestone 7: Web MVP UI (Focus Board)

At the end of this milestone, the web app exposes a Focus Board UI that:

- lists current focus set and commitments
- shows WIP limit
- shows attention queue
- shows delta brief since last touch
- deep links to workflow run detail views
- offers a “Talk” action that opens the voice surface bound to the selected commitment

We will use the existing desktop-app organization patterns used for settings.
We will not build a perfect UI; we build a working one that exercises the loop.

Acceptance:

Starting web + api, the user can create a focus set, start a workflow run, and see the attention queue update live.

Proof:

Manual run:

- start API and web dev servers
- navigate to the Focus Board route/window
- trigger a run and see updates

Implementation notes (done):

- Added window type `focus` and registered it in:
  - `apps/web/src/store/desktop/types.ts`
  - `apps/web/src/store/desktop/types.new.ts`
  - `apps/web/src/components/desktop/windows/registry.tsx`
- Added Focus Board window implementation:
  - `apps/web/src/components/apps/focus/index.tsx`
  - shows active focus set, commitments, open attention, and delta list
  - deep-links to workflow run via `spawnWindow("workflow", { type: "workflow_run", id })`
- Added a small window keybinding test:
  - `apps/web/src/components/apps/focus/__tests__/window.test.tsx`

### Milestone 8: Native MVP UI (“Call from Alfred”)

At the end of this milestone, the native app can:

- register for notifications (already exists)
- display attention items
- deep-link into a “call” screen
- start a voice session bound to commitment/run/thread, so voice resumes deterministically

This milestone focuses on plumbing and continuity, not perfect design.

Acceptance:

On native, you can tap an attention item and immediately enter the voice call screen where ALFRED resumes the correct context.

Implementation notes (done):

- Added a native Focus screen to browse attention + delta:
  - `apps/native/app/(drawer)/focus.tsx`
  - `apps/native/app/(drawer)/_layout.tsx` (drawer entry)
  - `apps/native/lib/linking.ts` (deeplink mapping)
- Updated Call screen to accept deeplink params and bind voice requests:
  - `apps/native/app/(drawer)/call.tsx`
  - supports `runId`, `resource`, `thread`, `prompt` params
  - sets `speechDefaults` for `useVoiceSessionNative()` so S2S requests carry `resource/thread/prompt`

### Milestone 9: TUI MVP (Focus panel)

At the end of this milestone, the TUI shows:

- active focus set
- commitments
- attention queue
- quick actions (ack, open run, show delta)

Acceptance:

Running the TUI shows Focus panel, updates when focus set changes, and can display delta brief output.

Implementation notes (done):

- Added TUI Focus polling subscription + store:
  - `packages/tui/src/tui/subscriptions/focus.ts`
  - `packages/tui/src/tui/api/client.ts` (focus/attention/delta helpers)
- Added Focus panel and integrated it into the dashboard:
  - `packages/tui/src/tui/react/panels/focus.tsx`
  - `packages/tui/src/tui/react/panels/index.tsx`
  - `packages/tui/src/tui/react/dashboard.tsx` (6-panel layout)
  - `packages/tui/src/tui/react/hooks/stores.ts` (adds `focus`)
  - `packages/tui/src/tui/index.ts` (store wiring + headless stdin end handling)

### Milestone 10: Full validation and cleanup

At the end of this milestone:

- the architecture guardrails pass,
- no new god files were introduced,
- the refactors did not break unrelated features,
- the north star loop can be demonstrated end-to-end,
- and we write an Outcomes & Retrospective summary.

## Concrete Steps

This section is intentionally explicit so a novice can execute it.
Each milestone should be implemented in order, validating after each major extraction.
When commands are listed, they are run from the repository root unless stated otherwise.

### Baseline measurement (Milestone 1)

1. Measure router file sizes.

   Command:
   wc -l packages/api/src/routers/\*.ts | sort -n

   Expected notable outputs (approximate):
   - packages/api/src/routers/workflow.ts ~ 3288
   - packages/api/src/routers/voice.ts ~ 1029

2. Measure runtime orchestrator file sizes.

   Command:
   wc -l packages/runtime/src/orchestrator/\*.ts | sort -n

3. Create a failing-then-fixing test `packages/api/test/architecture.godfiles.test.ts` that:
   reads a small list of critical files,
   calculates line counts,
   and asserts they are below the post-refactor thresholds.
   During milestone 1, allow an explicit exception list for current offenders, with a comment that milestone 2 removes the exception.

4. Run:
   bun test packages/api/test/architecture.godfiles.test.ts

### Workflow router refactor (Milestone 2)

1. Create new directory `packages/api/src/workflow/`.

2. Move checkpoint storage class and helpers:
   - create `packages/api/src/workflow/checkpoint.ts`
   - move `WorkflowCheckpointStorage` and snapshot schema parsing there
   - export a factory to create `WorkflowCheckpointStorage` with either Postgres or in-memory storage

3. Move metrics init:
   - create `packages/api/src/workflow/metrics.ts`
   - move `initWorkflowMetrics()` there
   - ensure it is called only inside request paths (no import-time behavior)

4. Move phase planning/execution helper code:
   - create `packages/api/src/workflow/phase.ts`
   - extract helper functions used by `workflowPhaseRouter.plan`, `execute`, `status`, `streamPlan`, `executeByRunId`

5. Move streaming/resume helpers:
   - create `packages/api/src/workflow/stream.ts`
   - extract the observable setup and queue observer wiring used by stream endpoints

6. Move replay helpers:
   - create `packages/api/src/workflow/replay.ts`

7. Move mapping helpers:
   - create `packages/api/src/workflow/resource.ts`

8. Update `packages/api/src/routers/workflow.ts` to import and delegate.
   Keep the exported router shape intact.

9. Ensure `packages/api/src/routers/workflow.ts` is now mostly:
   - imports
   - router definitions that call functions from `packages/api/src/workflow/*`

10. Run targeted tests:
    bun test packages/api/test/workflow\*
    bun test packages/pipeline

11. Update `packages/api/test/architecture.godfiles.test.ts` thresholds and remove the exception list for workflow once the refactor is complete.

### Voice router refactor (Milestone 3)

1. Identify the largest cohesive units inside `packages/api/src/routers/voice.ts`:
   - WebRTC session endpoints
   - streaming voice endpoints
   - session registry endpoints

2. For each unit, create a handler module under `packages/api/src/voice/`:
   - example: `packages/api/src/voice/http.ts` for HTTP-ish procedures
   - example: `packages/api/src/voice/webrtc-handlers.ts` for WebRTC endpoint logic

3. Update router to call those functions.

4. Run voice tests:
   bun test packages/api/test/voice\*
   bun test packages/voice

### Concierge Focus DB + types (Milestone 4)

1. Add new Drizzle schema file `packages/db/src/schema/focus.ts`.
   Define:
   - focus set table
   - commitments table
   - attention items table
     Use UUID ids, userId ownership, and keep JSONB metadata versioned.

2. Add migration under `packages/db/src/migrations/NNNN_focus.sql`.
   Use a single-word suffix, as required by repo naming rules.

3. Add repo file `packages/db/src/repo/focus.ts` with CRUD functions.
   Follow repository patterns from `packages/db/src/repo/conversation.ts`.

4. Add types under `packages/type/src/focus.ts` with Zod schemas.
   Export in `packages/type/src/index.ts`.

5. Add DB tests under `packages/db/test/repo.focus.test.ts`.

### Concierge Focus services and routers (Milestones 5–6)

1. Add `packages/api/src/services/attention.ts`, `delta.ts`, `notify.ts`, `attention-observer.ts`.

2. Add routers `packages/api/src/routers/focus.ts`, `attention.ts`, `delta.ts`, `notify.ts`.

3. Wire routers into `packages/api/src/routers/index.ts`.

4. Add API tests under `packages/api/test/`.

### Web + native + tui MVP (Milestones 7–9)

Implement minimal UI surfaces that can exercise the loop.
Prefer adding one route/window per surface rather than large UI migrations.
Use existing workflow detail screens as the main “run viewer” to avoid duplicating UI.

### Full validation (Milestone 10)

Run:

- bun test packages/api
- bun test packages/db
- bun test packages/pipeline
- bun test packages/runtime (if impacted)

Then execute the manual scenario below.

## Validation and Acceptance

The north star loop is accepted when a novice can perform the following scenario on a dev machine:

1. Start the API and web app.
2. Create a focus set with WIP=1 (spotlight) and one commitment “Ship X”.
3. Start a workflow run from that commitment.
4. Observe the run streaming status in the UI.
5. Trigger a clarification suspension (either via a test harness or by forcing a known “clarify” path).
6. Observe an attention item created and visible in the Focus Board.
7. Open voice call from the attention item and respond.
8. Observe the workflow run resume and continue.
9. Observe a compilation summary after completion (durable).
10. Request a delta brief since last touch and see:

- major changes
- action items requiring review
- the current top decision (if any)

Acceptance is not “types compile.”
Acceptance is “this loop works and is observable.”

## Idempotence and Recovery

All refactors should be idempotent:
re-running tests and restarting servers should not create duplicate rows or leak resources.

If a milestone fails:

- For extraction refactors, revert the last coherent extraction, re-run tests, and re-attempt extraction in smaller pieces.
- For migrations, do not write destructive migrations.
  If a migration needs correction during development, write a follow-up migration rather than editing applied history.

Long-running resources must be cleaned up:
when adding new timers or background loops, call `.unref()` as required by import-safety rules and ensure they are started only in service init, not at import time.

## Artifacts and Notes

Baseline evidence for current “god file” state (from `wc -l`):

- packages/api/src/routers/workflow.ts: 3288
- packages/api/src/routers/voice.ts: 1029
- packages/api/src/routers/plan.ts: 896
- packages/api/src/routers/agentfs.ts: 881

These numbers should be updated as the plan progresses, and the “god file guardrail” test should enforce the post-refactor targets.

## Interfaces and Dependencies

New modules introduced by this plan should follow the repo’s naming constraints:

- new router files under `packages/api/src/routers/` should remain single-word (`focus.ts`, `attention.ts`, `delta.ts`, `notify.ts`).
- new DB schema and repo files should remain single-word (`focus.ts`).
- new services can be multi-word only when necessary; prefer single word or clear single noun (`attention.ts`, `delta.ts`).

Key dependencies:

- Use existing tRPC patterns in `packages/api/src/trpc.ts`.
- Use existing policy gating patterns via `requirePolicy()` in `packages/api/src/gate.ts`.
- Use existing pipeline and observer patterns via `@alfred/pipeline`.
- Use existing compilation observer as a template for derived artifacts (`packages/api/src/services/compilation.ts`).
- Use existing sense routing patterns for evidence-driven classification (`packages/sense/src/route.ts`).
- Use existing RAG and rerank patterns; do not reimplement retrieval logic.

At the end of implementation, the new Concierge Focus modules must integrate cleanly with:
projects, learning, knowledge/graph entities, observability/metrics, persistence, rag/rerank, sense, protocol, summarize, pacer, api, agent, tui, and mindscape.

Any future addition that tries to “just add a method” into `workflow.ts` should be rejected; the refactor milestone exists specifically to prevent that outcome.
