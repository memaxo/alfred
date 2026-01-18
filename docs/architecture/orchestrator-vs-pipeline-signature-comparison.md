# Orchestrator vs Pipeline — code-verified, signature-level comparison
Owner: runtime / pipeline

This report compares three similarly-named systems **by their public surfaces and event contracts (as implemented in code)**, and outlines a minimal migration/convergence plan.

See also: `docs/architecture/pipeline-vs-orchestrator.md` (high-level architecture comparison)

## Scope + terminology (three distinct systems)

- **Canonical pipeline**: `@alfred/pipeline` (8 stages; `PipelineEvent.type`; observers; snapshot/resume)
  - Entry exports: `packages/pipeline/src/index.ts:L1-L58`
  - Core runner: `packages/pipeline/src/runner.ts:L41-L486`
  - Event contract: `packages/pipeline/src/events.ts:L38-L148`

- **Legacy workflow stream orchestrator (runtime)**: workflow execution stream for the product (callbacks, persistence, Linear lifecycle)
  - Entry: `packages/runtime/src/workflow/orchestrator.ts:L76-L545`

- **Legacy phase-pipeline (runtime)**: a different `PipelineRunner` (4 phases; yields `WorkflowEvent` with `_` discriminator)
  - Runner: `packages/runtime/src/pipeline/runner.ts:L51-L241`

> Non-scope clarification: the LLM “orchestrator agent” (`packages/agent/src/agents.ts`) is a separate concept and is not analyzed here.

## 1) Public API surface diff (signatures, file paths)

### Canonical: `@alfred/pipeline`

- **Public exports (selected)**: `PipelineRunner`, `PipelineContext`, `PipelineEvent`, `PipelineSnapshot`, `registerDefaultStages`, observers
  - `packages/pipeline/src/index.ts:L8-L46`

- **Runner API (exact signatures)**:
  - `PipelineRunner.run(input, signal?) => AsyncGenerator<PipelineEvent, PipelineResult, void>`
  - `PipelineRunner.resume(snapshot, input, signal?) => AsyncGenerator<PipelineEvent, PipelineResult, void>`
  - Source: `packages/pipeline/src/runner.ts:L78-L143`

- **Stage model (8-stage order)**:
  - `StageName` union + `STAGE_ORDER` constant
  - Source: `packages/pipeline/src/pipeline.ts:L1-L21`

### Legacy workflow stream orchestrator (runtime)

- **Entry point (exact signature)**:
  - `orchestrateWorkflowStream(input, session, callbacks) => Promise<() => void>`
  - Source: `packages/runtime/src/workflow/orchestrator.ts:L55-L118`

- **Pipeline feature flag hook**:
  - `isPipelineEnabled()` gates execution into `runWorkflowPipeline()`
  - Source: `packages/runtime/src/workflow/orchestrator.ts:L82-L118`

### Legacy runtime orchestrator generator (waves + multi-phase)

- **Generator entry (exact signature)**:
  - `runOrchestrator(input, runId, signal, history?, projectConfig?, escalationContext?, authz?, scanContext?, userId?, deps?) => AsyncGenerator<WorkflowEvent, void, void>`
  - Source: `packages/runtime/src/orchestrator/index.ts:L31-L42`

### Legacy phase-pipeline (runtime) — *name collision*

- **Runner class + entry signature**:
  - `class PipelineRunner { async *run<I>(initialInput: I): AsyncGenerator<WorkflowEvent, void, void> }`
  - Source: `packages/runtime/src/pipeline/runner.ts:L51-L97`

**Name collision risk**: two unrelated classes named `PipelineRunner`.
- Canonical: `packages/pipeline/src/runner.ts:L41-L106`
- Legacy: `packages/runtime/src/pipeline/runner.ts:L51-L97`

## 2) Event contract diff (explicit)

### Canonical event contract: `PipelineEvent` (`type` discriminant)

- `PipelineEvent` is a tagged union keyed by `type`, including stage lifecycle, agent lifecycle, review, learning, context/set, budget, pipeline lifecycle.
- Source: `packages/pipeline/src/events.ts:L38-L148`

### Legacy event contract: `WorkflowEvent` (`_` discriminant)

- `WorkflowEvent` is a tagged union keyed by `_` and includes stream protocol parts (e.g. `"tool-call"`, `"tool-result"`, `"ui-message"`, `"text-delta"`), orchestration markers (e.g. `"phase-start"`, `"agent-start"`, `"wave-start"`), and lifecycle markers (e.g. `"workflow-complete"`, `"error"`).
- Source: `packages/type/src/plan.ts:L372-L501`

### Bridge mapping: `PipelineEvent -> WorkflowEvent` (lossiness)

There are **two** nearly-identical mappings in-tree:

1) Runtime bridge mapping:
   - `packages/runtime/src/workflow/pipeline-bridge.ts:L257-L311`
2) Canonical observer mapping (preferred location):
   - `packages/pipeline/src/observers/events.ts:L14-L70`

Both implement the same partial mapping:

- `stage:enter` → `{ _: "step-start", phase }`
- `stage:exit` → `{ _: "step-complete", phase }`
- `stage:progress` → `{ _: "progress", phase, message }`
- `agent:spawn` → `{ _: "agent-start", agentId, phaseId: "execute", taskId }`
- `agent:complete` → `{ _: "agent-complete", agentId, phaseId: "execute", status, durationMs }`
- `pipeline:complete` → `{ _: "workflow-complete", summary }`
- `pipeline:failed` → `{ _: "error", message, phase }`
- Everything else → `null`

**Dropped (unmapped) canonical events** (non-exhaustive, but code-proven by the `default` branch returning `null`):
- Agent: `agent:progress`, `agent:stuck`, `agent:escalated`, `agent:retry` (`packages/pipeline/src/events.ts:L55-L86` + mapping default `packages/pipeline/src/observers/events.ts:L67-L69`)
- Review: `review:check`, `review:fix-start`, `review:fix-complete` (`packages/pipeline/src/events.ts:L88-L100`)
- Learning: `learn:insight` (`packages/pipeline/src/events.ts:L101-L103`)
- Wave: `wave:aborted` (`packages/pipeline/src/events.ts:L104-L110`)
- Context/budget/pipeline lifecycle: `context:set`, `context:cache-hit`, `budget:*`, `pipeline:start|suspend|resume` (`packages/pipeline/src/events.ts:L112-L142`)

**Lossiness impact**:
- Any consumer relying on `WorkflowEvent` for rich stream protocol parts (e.g. `_:"tool-call"`, `_:"tool-result"`, `_:"ui-message"`) cannot get those from pipeline events alone, because the bridge mapping never emits those variants (compare `packages/type/src/plan.ts:L395-L412` vs `packages/pipeline/src/observers/events.ts:L22-L70`).

## 3) Overlapping responsibilities inventory (what duplicates where)

### Overlap: wave + agent execution logic is duplicated

- Legacy waves executor: `packages/runtime/src/orchestrator/waves.ts` (wave planning, tracker hydration, concurrency via `pLimit`, queue streaming via `AsyncQueue`, escalation/abort heuristics, and ExecPlan updates).
  - Concurrency + queue streaming: `packages/runtime/src/orchestrator/waves.ts:L309-L390`

- Canonical pipeline `ExecuteStage`: implements its own wave loop, tracker integration, stuck detection, escalation file check, retry loop, and wave abort heuristics.
  - Source: `packages/pipeline/src/stages/execute.ts:L13-L406`

**Key duplication signals**:
- Both call `buildAgentSpec()` and `runAgent()` (`packages/runtime/src/orchestrator/waves.ts:L265-L332` vs `packages/pipeline/src/stages/execute.ts:L44-L178`).
- Both use tracker utilities (`createTrackerContext`, `updateTrackerWithContext`, `detectStuckWithContext`) (`packages/runtime/src/orchestrator/waves.ts:L14-L18` vs `packages/pipeline/src/stages/execute.ts:L49-L53`).

### Overlap: PipelineEvent → WorkflowEvent mapping duplicated

- `packages/runtime/src/workflow/pipeline-bridge.ts:L257-L311`
- `packages/pipeline/src/observers/events.ts:L14-L70`

This duplication increases drift risk; the runtime bridge should reuse the canonical observer mapping.

## 4) Boundary compliance check vs `.ruler/48-pipeline-boundaries.md` (required)

Boundary spec: `.ruler/48-pipeline-boundaries.md:L1-L70`

### Canonical pipeline: DB + API imports (PASS)

- The pipeline boundary tests explicitly enforce no `@alfred/db`/`@alfred/api` imports in core files (`runner.ts`, `pipeline.ts`, `events.ts`, `context.ts`, `snapshot.ts`).
  - Test: `packages/pipeline/test/boundaries.test.ts:L13-L71`

### Canonical pipeline: “metrics collection belongs in observers” (PARTIAL VIOLATION)

The boundary doc states “metrics collection (use observers)” and discourages cross-cutting side effects in runner core (`.ruler/48-pipeline-boundaries.md:L9-L12`).

However `PipelineRunner` imports and calls a metrics helper directly:
- `import { clearRunCosts } from "@alfred/metrics";` (`packages/pipeline/src/runner.ts:L1-L4`)
- `clearRunCosts(runId);` in `finally` (`packages/pipeline/src/runner.ts:L370-L375`)

This is a cross-cutting concern in pipeline core; it should be moved behind an observer (e.g. a cost/budget observer) or delegated to a higher layer.

### Canonical pipeline: Linear integration belongs in observers (VIOLATION)

The boundary doc explicitly places Linear integration “out of scope” for pipeline core/stages and prescribes observers (`.ruler/48-pipeline-boundaries.md:L9-L12`).

However `InitStage` directly performs Linear setup by calling `ensureLinearTicket(...)`:
- Dynamic import: `packages/pipeline/src/stages/init.ts:L39-L44`
- Call + derived IDs: `packages/pipeline/src/stages/init.ts:L46-L57`

This duplicates responsibility with the observer-based approach already present in the runtime bridge (`LinearSyncObserver` registration in `packages/runtime/src/workflow/pipeline-bridge.ts:L158-L168`) and should be converged into a single observer-owned implementation.

### Legacy workflow stream orchestrator: side effects live “inside” the orchestrator (expected legacy, but violates canonical boundary model)

The legacy orchestrator performs DB persistence and Linear lifecycle directly:
- DB repo import: `import * as workflowRepo from "@alfred/db/repo/workflow";` (`packages/runtime/src/workflow/orchestrator.ts:L13-L18`)
- Linear setup/finalize: `ensureLinearTicket`, `bootstrapLinearSession`, `safeFinalizeLinearSuccess|Failure` (`packages/runtime/src/workflow/orchestrator.ts:L1-L33` and `L235-L490`)
- Stream persistence: `persistStreamEvent(...)` (`packages/runtime/src/workflow/orchestrator.ts:L415-L432`)

In the canonical model, these belong in observers (checkpoint/persistence observers, Linear observer, UI stream observer).

## 5) Type/signature mismatches + contract hotspots (code-verified)

### Hotspot A: two different `AgentOutcome` shapes in the canonical pipeline package

1) Pipeline-local `AgentOutcome` used in `PipelineEvent.agent:complete`:
- `packages/pipeline/src/events.ts:L4-L10`

2) Runtime `AgentOutcome` used by stage output types:
- `packages/pipeline/src/stages/types.ts:L1-L8` imports runtime `AgentOutcome`
- Runtime definition: `packages/runtime/src/orchestrator/agent.ts:L42-L57`

**Impact**:
- Pipeline events expose a simplified outcome, but stage outputs (and downstream summary) expect the richer runtime outcome.
- This mismatch is currently papered over by per-stage mapping (e.g., `ExecuteStage` constructs an event outcome object separately) (`packages/pipeline/src/stages/execute.ts:L285-L313`).

### Hotspot B: stage-to-stage dataflow uses context keys that don’t match runner resume semantics

Pipeline runner resume logic reconstructs the next stage input using keys like `initOutput`, `contextOutput`, etc:
- `PipelineRunner.getResumeInput(...)` expects these keys: `packages/pipeline/src/runner.ts:L394-L423`

But the default stages do **not** set those keys:
- `InitStage` sets `projectId`, `linearIssueId`, `linearSessionId` (not `initOutput`) (`packages/pipeline/src/stages/init.ts:L21-L57`)
- `PlanStage` sets `subtasks` and `execPlanPaths` (not `planOutput`) (`packages/pipeline/src/stages/plan.ts:L89-L93`)

Meanwhile, the resume integration test uses mock stages that *do* write `${name}Output`:
- `packages/pipeline/test/integration/resume.test.ts:L17-L25`

**Impact**: canonical `PipelineRunner.resume()` is currently **tested only with mock stages**, and its resume-input contract does not match the default stages’ behavior.

### Hotspot C: pipeline stage key mismatches break stage internals

Canonical `ExecuteStage` reads:
- `execPlans` and `rootPlanPath` from context (`packages/pipeline/src/stages/execute.ts:L58-L60`)

But `PlanStage` writes:
- `execPlanPaths` and returns `rootPlanPath` without `ctx.set("rootPlanPath", ...)` (`packages/pipeline/src/stages/plan.ts:L89-L98`)

Canonical `SummarizeStage` reads `executeOutput` from context:
- `packages/pipeline/src/stages/summarize.ts:L33-L40`

But `ExecuteStage` currently does not `ctx.set("executeOutput", ...)` (it returns it only; and the comment claims it is “non-serializable”) (`packages/pipeline/src/stages/execute.ts:L414-L423`).

**Impact**: default-stage dataflow relies on context keys that are not consistently written, producing empty/incorrect summaries and undermining resume/checkpoint usefulness.

### Hotspot D: workspace + server cleanup parity (pipeline vs legacy)

Legacy orchestrator guarantees cleanup in `finally`:
- stop servers: `stopAllServers("workflow_complete")` (`packages/runtime/src/orchestrator/index.ts:L124-L135`)
- workspace cleanup: iterates `wavesResult.activeWorkspaces` and calls `ws.cleanup()` (`packages/runtime/src/orchestrator/index.ts:L137-L147`)
- worktree cleanup: `worktreeManager.cleanup(workspace, runId)` (`packages/runtime/src/orchestrator/index.ts:L149-L166`)

Canonical `ExecuteStage` calls runtime `runAgent()` but passes `activeWorkspaces: []` per agent invocation:
- `packages/pipeline/src/stages/execute.ts:L159-L178`

Runtime `runAgent()` pushes created workspaces into the provided `activeWorkspaces` list (`packages/runtime/src/orchestrator/agent.ts:L231-L234`), but does not centrally clean them up (cleanup is owned by the orchestrator, not the agent).

**Impact**: pipeline execute path can leak workspaces/containers and misses the orchestrator’s cleanup guarantees unless pipeline adds equivalent cleanup.

## 6) Mapping table: legacy phases → canonical stages

### Legacy phase-pipeline (runtime) → canonical stages

Legacy phases and defaults:
- `scan`, `plan`, `act`, `report` (timeouts: `packages/runtime/src/pipeline/runner.ts:L7-L14`)

Canonical stage order:
- `init`, `context`, `plan`, `schedule`, `execute`, `review`, `learn`, `summarize` (`packages/pipeline/src/pipeline.ts:L1-L21`)

Minimal mapping:
- `scan` → `init` + `context`
- `plan` → `plan` + `schedule`
- `act` → `execute` (+ some review responsibilities depending on legacy mode)
- `report` → `review` + `learn` + `summarize`

### Legacy orchestrator phases A–E → canonical stages

Legacy `runOrchestrator()` phases:
- A: multi-agent waves (`runWaves`) (`packages/runtime/src/orchestrator/index.ts:L76-L83`)
- B–E: merge/conflict/review pipeline (`packages/runtime/src/orchestrator/index.ts:L108-L122`)

Canonical mapping:
- A ≈ `plan`/`schedule`/`execute` (but legacy `runWaves` also does context reuse, plan selection, and ExecPlan updates)
- E ≈ `review` (but canonical review is outcome-based; legacy includes merge/review phases)

## 7) Tests: exact suites covering each system (and what’s missing)

### Canonical pipeline tests (`packages/pipeline/test/*`)

- **Boundary enforcement** (no `@alfred/db`/`@alfred/api` imports in core): `packages/pipeline/test/boundaries.test.ts`
- **Golden path executes all 8 stages** (does not assert stage-to-stage data correctness): `packages/pipeline/test/integration/golden-path.test.ts:L9-L166`
- **Resume semantics** (mock stages only; relies on `${stage}Output` keys): `packages/pipeline/test/integration/resume.test.ts:L14-L321`
- **Execute stage config/unit tests** (mostly type/config checks; not a full agent-runtime integration): `packages/pipeline/test/stages/execute.test.ts`
- **Review stage config/unit tests**: `packages/pipeline/test/stages/review.test.ts`
- **Snapshot + reconstruction**: `packages/pipeline/test/snapshot.test.ts`, `packages/pipeline/test/perf/reconstruct.test.ts` (see snapshot code: `packages/pipeline/src/snapshot.ts`)

**Missing coverage (canonical pipeline)**:
- Real default-stage **resume** that verifies required context keys are written (currently only mocked in `resume.test.ts`).
- Real default-stage **dataflow correctness** (e.g., `SummarizeStage` uses `executeOutput` from context, but `ExecuteStage` does not set it).
- Workspace/server/worktree cleanup parity tests for pipeline execute path (legacy has coverage; pipeline does not).
- Bridge mapping completeness tests (see §2).

### Legacy runtime orchestrator tests (`packages/runtime/test/*`)

- **Wave execution + event streaming + ExecPlan writes**: `packages/runtime/test/waves.execution.test.ts:L98-L151`
- **Wave hydration/resume behavior**: `packages/runtime/test/waves.hydration.test.ts:L18-L74`
- **Orchestrator cleanup guarantees** (server cleanup on completion/escalation/error): `packages/runtime/test/orchestrator.executor-cleanup.test.ts:L76-L187`
- **Legacy phase-pipeline**:
  - Base behavior: `packages/runtime/test/pipeline.test.ts:L1-L115`
  - MAX_TRANSITIONS escalation loop safety: `packages/runtime/test/pipeline-safety.test.ts:L6-L50`
  - Resume + timeout enforcement: `packages/runtime/test/pipeline/resume-timeout.integration.test.ts:L14-L103`
- **Legacy “act” phase behavior** (tool graph vs orchestrator delegation): `packages/runtime/test/phases/act.test.ts:L148-L320`

**Missing coverage (legacy → canonical bridge)**:
- No dedicated test validates `pipelineEventToWorkflowEvent()` completeness/lossiness or consumer safety for dropped events (runtime bridge: `packages/runtime/src/workflow/pipeline-bridge.ts:L257-L311`).

## 8) Minimal migration / convergence plan (ordered, minimal, no hand-waving)

This checklist is ordered to reduce risk and eliminate the highest-impact correctness gaps first.

### A. Eliminate the `PipelineRunner` name collision (low risk, high clarity)

- **Rename** `packages/runtime/src/pipeline/runner.ts` `PipelineRunner` → `PhaseRunner` (or `LegacyPhaseRunner`).
  - Update imports in runtime tests: `packages/runtime/test/pipeline*.ts`
  - Rationale: avoids repeated confusion between `@alfred/pipeline` and runtime phase-pipeline.

### B. Single source of truth for bridge mapping (prevent drift)

- Remove or deprecate `pipelineEventToWorkflowEvent()` in `packages/runtime/src/workflow/pipeline-bridge.ts` and instead reuse `@alfred/pipeline`’s `WorkflowEventObserver` mapping (same semantics today).
  - Runtime mapping: `packages/runtime/src/workflow/pipeline-bridge.ts:L257-L311`
  - Canonical mapping: `packages/pipeline/src/observers/events.ts:L14-L70`

### C. Make canonical default stages obey a single context contract (unblocks resume + summarize correctness)

Pick one of these approaches and apply consistently:

1) **Runner-owned stage output storage** (recommended):
   - After each stage success, runner writes `ctx.set("${stage}Output", result)` (serializable conversion already exists in `ctx.set`) (`packages/pipeline/src/context.ts:L55-L76`).
   - This aligns with `getResumeInput()` expectations (`packages/pipeline/src/runner.ts:L394-L423`) and makes default stages simpler.

2) **Stage-owned output storage**:
   - Update each stage to write `${stage}Output` keys that `getResumeInput()` expects.

Then fix concrete key mismatches:
- `PlanStage`: write `ctx.set("rootPlanPath", rootPlanPath)` and use a single key for exec plan lookup (either `execPlans` or `execPlanPaths`) so `ExecuteStage` reads the same key (`packages/pipeline/src/stages/plan.ts:L89-L98` and `packages/pipeline/src/stages/execute.ts:L58-L60`).
- `ExecuteStage`: write `ctx.set("executeOutput", executeOutput)` (serialization supports Map via `toSerializable`) (`packages/pipeline/src/context.ts:L55-L61`), so `SummarizeStage` can read it (`packages/pipeline/src/stages/summarize.ts:L33-L40`).

### D. Restore cleanup parity for pipeline execute path (prevent leaks)

- Track `activeWorkspaces` across agent runs and ensure cleanup happens on:
  - normal completion
  - abort
  - error

Legacy cleanup reference:
- `packages/runtime/src/orchestrator/index.ts:L124-L166`

Minimal viable fix:
- In `ExecuteStage`, allocate one `activeWorkspaces: Workspace[]` and pass it to every `runAgent()` call, then clean them in a `finally`.
  - Current leak risk: `activeWorkspaces: []` is passed per call (`packages/pipeline/src/stages/execute.ts:L159-L178`).

### E. Add the missing tests that lock in the convergence

- Canonical pipeline:
  - Add an integration test that runs `registerDefaultStages(runner)` and asserts:
    - required context keys exist for resume (`${stage}Output` or whatever the contract becomes)
    - summarize contains real outcomes (not empty)
  - Add a resume test that resumes a real default-stage snapshot (not mocks).
- Bridge:
  - Add a test asserting which `PipelineEvent.type` values are mapped vs dropped (explicitly), so consumer expectations are clear.

### F. Deprecate legacy phase-pipeline (after canonical parity is proven)

Once A–E land and the feature flag is stable:
- Mark `packages/runtime/src/pipeline/*` as deprecated (or remove in a later PR).
- Keep runtime orchestrator primitives (`runAgent`, workspace/worktree tooling) as the execution backend used by pipeline stages until/unless moved.

