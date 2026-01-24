# alf-5-workflow-reliability

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md` (repository root).

## Purpose / Big Picture

Make ALFRED’s workflow runtime/orchestrator reliably terminate and recover in the face of failures. After this work:

- A workflow run cannot execute indefinitely: a global workflow timeout reliably aborts the run, emits a terminal event exactly once, and persists terminal state.
- Abort signals propagate through wave execution (multi-agent orchestration) and stop downstream work cleanly, with workspace cleanup.
- After an API restart, workflow run recovery behavior is explicit, durable, and tested (either true resume/recovery, or a documented, safe fail-fast mode that marks in-flight runs terminal so they cannot zombie).

Success is demonstrated by deterministic tests that cover normal success, escalation, MAX_TRANSITIONS safeguards, abort propagation, and restart recovery behavior for the active workflow engine.

## Progress

- [x] (2026-01-10 04:45Z) Create ExecPlan skeleton and begin branch vs `main` audit.
- [x] (2026-01-10 05:02Z) Audit which workflow engine is default/in-scope: `packages/agent/src/workflow/services.ts` creates the executor via `@alfred/runtime.createRuntime` unconditionally; `runPlanV6` has no callsites on this branch; `USE_WORKFLOW_RUNTIME` appears only in tests + `config/env.example`.
- [x] (2026-01-10 05:02Z) Diff key ALF-5 surfaces against local `main`: `packages/agent/src/workflow/{orchestrator,registry,session-recovery}.ts` are new files; `packages/runtime/src/{orchestrator/waves.ts,pipeline/runner.ts}` are new; `packages/runtime/src/core.ts` is modified.
- [x] (2026-01-10 05:08Z) Ensure single-shot terminalization on failure paths: `packages/agent/src/workflow/orchestrator.ts` no longer has a competing “outer” global timeout and now stamps `completedAt` on failures.
- [x] (2026-01-10 05:08Z) Add abort propagation + cleanup wiring for multi-agent waves: treat abort as `interrupted`, stop further waves, and guarantee workspace cleanup via `runOrchestrator` (`packages/runtime/src/orchestrator/{agent.ts,waves.ts}` + `packages/runtime/test/waves.execution.test.ts`).
- [x] (2026-01-10 05:08Z) Implement + test restart recovery for running workflow runs: fail-fast “orphaned running runs” cleanup on boot for non-Redis registries (`packages/agent/src/workflow/session-recovery.ts`, `packages/api/src/init.ts`, `packages/agent/test/workflow/session-recovery.test.ts`).
- [x] (2026-01-10 05:16Z) Run targeted tests: `cd packages/runtime && bun run test` (PASS) + `cd packages/agent && bun ../../scripts/test-bun.ts ... test/workflow/session-recovery.test.ts` (PASS) + `cd packages/agent && bun ../../scripts/test-bun.ts ... src/workflow/orchestrator.test.ts` (PASS).
- [x] (2026-01-10 05:45Z) Harden unit tests against async streaming timing + `mock.module()` permanence: `packages/agent/src/workflow/orchestrator.test.ts` now waits for completion; `packages/api/test/workflow.router.test.ts` cancel test now awaits stream completion.
- [x] (2026-01-10 05:45Z) Restore API workflow router test coverage by aligning AI gateway stubs to the actual provider interface: `packages/agent/src/selector.ts` uses `getOpenAI()(modelKey)`; test stubs updated in `packages/api/test/utils/agent-mock.ts`.
- [x] (2026-01-10 05:45Z) Document restart recovery knobs + clarify dead toggle: `config/env.example` now includes `WORKFLOW_RECOVERY_MAX` and `WORKFLOW_RUNNING_RECOVERY_GRACE_MS`, and notes `USE_WORKFLOW_RUNTIME` is currently ignored.
- [x] (2026-01-10 05:47Z) Update Linear epic ALF-5 with evidence + mark Done (comment includes file:line anchors for timeout, abort propagation, MAX_TRANSITIONS, and restart recovery).

## Surprises & Discoveries

- Observation: `git fetch` is denied in this sandbox because it cannot write `.git/FETCH_HEAD`, so “diff vs main” uses the existing local `main` ref (may be stale vs remote).
  Evidence:
  error: cannot open '.git/FETCH_HEAD': Operation not permitted
- Observation: `scripts/test-bun.ts` deliberately bypasses wrapper features when explicit file patterns are passed, so `ALFRED_TEST_ISOLATE_FILES=1` will not isolate `mock.module()` across multiple files unless tests are run per-file (or via package discovery).
  Evidence: `scripts/test-bun.ts` short-circuits on `patterns.length > 0` and runs `bun test ...patterns` directly.

## Decision Log

- Decision: Treat `@alfred/runtime` as the active workflow execution engine for ALF-5 on this branch; `USE_WORKFLOW_RUNTIME` is currently not used by runtime selection logic.
  Rationale: `packages/agent/src/workflow/services.ts` imports `@alfred/runtime` to create the executor; `runPlanV6` has no callsites; `USE_WORKFLOW_RUNTIME` only appears in tests and `config/env.example`.
  Date/Author: 2026-01-10 / Codex

- Decision: Remove the agent-orchestrator-level global timeout race and rely on `@alfred/runtime`’s workflow timeout for global timeout enforcement.
  Rationale: Dual competing timeouts risk double terminalization (cancel vs fail) and duplicate emissions; the runtime core already enforces the workflow-level timeout (`packages/runtime/src/core.ts`).
  Date/Author: 2026-01-10 / Codex

- Decision: Standardize model selection on the gateway provider call form `getOpenAI()(modelKey)` (and keep a back-compat `.languageModel()` shim in tests only).
  Rationale: `createGatewayProvider()` produces a callable provider; relying on `.languageModel()` breaks workflow router unit tests and diverges from other call sites (e.g. `packages/plan/*`).
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

- ALFRED’s active workflow engine (`@alfred/runtime`) now enforces a workflow-level timeout, has per-phase timeouts + MAX_TRANSITIONS loop protection, and reliably terminates without double-terminalization.
- Abort signals now propagate through wave execution and agent execution, converting aborts into a clean “interrupted” terminal path and ensuring workspace cleanup even on thrown errors.
- API restart behavior is now explicit and safe:
  - suspended runs rehydrate as placeholder handles that reject `resume()` until the stream reconnects
  - non-Redis registries fail-fast orphaned `status:"running"` runs after a grace window to avoid zombie runs
- Deterministic tests cover success, escalation, MAX_TRANSITIONS, abort propagation, and restart recovery; workflow router tests cover cancel propagation at the API boundary.

**Follow-ups (not required for ALF-5 closure)**

- Either re-introduce a real `USE_WORKFLOW_RUNTIME` toggle or remove the env var and its compatibility tests once rollout is finalized (documented in `config/env.example`).
- Resolve unrelated typecheck failures noted during the audit (outside ALF-5 scope).

## Context and Orientation

ALFRED has a workflow pipeline/orchestrator that can execute multi-phase work, including “waves” that may spawn multiple agent tasks. This work targets ALFRED itself (the workflow runtime/orchestrator), not any applications ALFRED generates.

Key code locations (repository-relative):

- `packages/runtime/src/core.ts`: workflow runtime core, including workflow-level timeout logic and abort controller handling.
- `packages/runtime/src/pipeline/runner.ts`: pipeline phase runner; includes per-phase timeouts and a MAX_TRANSITIONS safeguard against escalation loops.
- `packages/runtime/src/orchestrator/waves.ts`: wave execution orchestration; should react to abort signals and stop spawning/awaiting downstream agents.
- `packages/agent/test/workflow/orchestrator.test.ts`: baseline orchestrator behavior tests.
- `packages/api/test/workflow.router.test.ts`: API workflow router tests; used to ensure server boundary behavior remains correct.
- `config/env.example`: contains `USE_WORKFLOW_RUNTIME` toggle; the default engine used in production must be safe.

Definitions used in this plan:

- “Global workflow timeout”: a single timeout for the entire run (wall-clock), independent of per-phase timers, that aborts the run and prevents indefinite execution.
- “Abort propagation”: when a run is aborted (timeout, user cancel, fatal error), all active phases/waves/agents see the abort signal and stop promptly, without leaving “zombie” work.
- “Terminal event/state”: the single final outcome of a run (success, failure, aborted, timeout). “Terminal exactly once” means we never emit/persist multiple conflicting terminal outcomes.
- “Recovery after restart”: behavior when the API process restarts while workflows were in-flight; either the system can resume them, or it must mark them terminal and prevent further processing.

## Plan of Work

First, determine which workflow engine ALF-5 applies to by tracing the `USE_WORKFLOW_RUNTIME` toggle from `config/env.example` into runtime selection code. Record which engine is “default” and which is “active” in tests, and treat the default as the reliability target.

Next, diff the relevant runtime/orchestrator files against `main` to understand what is already implemented on this branch versus what exists upstream. If the branch already contains the full ALF-5 behavior, the remaining work is to add missing tests (if any) and close the epic in Linear with concrete evidence.

Then audit the three reliability gaps:

1. Global timeout enforcement: ensure the workflow-level timeout aborts the run, persists terminal state, and emits terminal events exactly once even when multiple abort sources race (timeout vs user abort vs internal error).
2. Abort propagation: ensure abort signals interrupt wave execution promptly and that all workspace/agent resources are cleaned up on every error path.
3. Session recovery after restart: confirm whether run state is persisted (e.g., Redis-backed) or in-memory. If in-memory, implement a safe fail-fast recovery mode that marks in-flight runs terminal on restart, or implement true resumption if infrastructure already exists. Whichever behavior exists must be explicit, guarded, and covered by deterministic tests.

Finally, implement the minimal code changes required to close the gaps and add tests that cover:

- Normal success path
- Escalation path
- MAX_TRANSITIONS safeguard path
- Abort propagation path
- Restart recovery behavior

## Concrete Steps

All commands run from the repository root:

    cd /Users/jackmazac/Development/alfred

Audit and diff:

    git status
    git remote -v
    git fetch --all
    git diff --name-only main...HEAD -- packages/runtime packages/agent packages/api config/env.example
    git diff main...HEAD -- packages/runtime/src/core.ts packages/runtime/src/orchestrator/waves.ts packages/runtime/src/pipeline/runner.ts

Find runtime toggle usage:

    rg -n \"USE_WORKFLOW_RUNTIME\" -S .

Run targeted tests (canonical wrapper):

    bun scripts/test-bun.ts --help
    ALFRED_TEST_SCOPE=unit bun scripts/test-bun.ts packages/runtime
    ALFRED_TEST_SCOPE=unit bun scripts/test-bun.ts packages/agent
    ALFRED_TEST_SCOPE=unit bun scripts/test-bun.ts packages/api

If workflow/orchestrator suites require isolation due to `mock.module()`, enable per-file isolation:

    ALFRED_TEST_SCOPE=unit ALFRED_TEST_ISOLATE_FILES=1 bun scripts/test-bun.ts packages/agent

## Validation and Acceptance

Acceptance requires all of the following:

- Global timeout: a deterministic test proves a run is aborted with `workflow_timeout` within the configured deadline, and the terminal event/state is emitted/persisted exactly once.
- Abort propagation: a deterministic test proves abort stops wave execution promptly and triggers workspace cleanup (no leaked active run).
- MAX_TRANSITIONS: a deterministic test proves the pipeline throws a MAX_TRANSITIONS error and the run terminates (no hang).
- Recovery after restart: a deterministic test proves the chosen behavior (resume or safe fail-fast terminalization) is correct; no in-flight run becomes a zombie after restart.
- Tests pass via `bun scripts/test-bun.ts` in the packages touched by this change.

## Idempotence and Recovery

The code changes in this plan are intended to be idempotent and safe to re-run:

- Tests must be non-hanging and include explicit timeouts.
- Restart recovery logic must be safe when executed multiple times (e.g., marking stale in-flight runs terminal should be a no-op when already terminal).
- Avoid destructive commands and avoid deleting tracked artifacts unless explicitly instructed.

## Artifacts and Notes

Targeted test snippets (abridged):

    cd packages/runtime
    bun run test
    ...
    (pass) runWaves execution > propagates abort to agents and cleans up workspaces
    ...
    script "test" exited with code 0

    cd packages/agent
    bun ../../scripts/test-bun.ts ... test/workflow/session-recovery.test.ts
    ...
     5 pass
     0 fail

    cd packages/agent
    bun ../../scripts/test-bun.ts ... src/workflow/orchestrator.test.ts
    ...
     1 pass
     0 fail

## Interfaces and Dependencies

This work should stay within existing ALFRED runtime/orchestrator boundaries:

- Runtime core: `packages/runtime/src/core.ts` should own abort controller wiring and global timeout enforcement.
- Pipeline runner: `packages/runtime/src/pipeline/runner.ts` already owns per-phase timeouts and MAX_TRANSITIONS loop protection.
- Wave orchestration: `packages/runtime/src/orchestrator/waves.ts` should treat abort signals as first-class and guarantee cleanup.
- Persistence/recovery: any run registry or durable run state should remain in the boundary layer (repo/API/runtime), not in pure transformation code.

## Plan Change Notes

- (2026-01-10 04:46Z) Recorded sandbox limitation around `git fetch` so future work doesn’t assume remote refs are available. This affects how “branch vs main” evidence is gathered.
- (2026-01-10 05:02Z) Recorded evidence that this branch uses `@alfred/runtime` for workflow execution regardless of `USE_WORKFLOW_RUNTIME`, and captured which ALF-5 files are new vs local `main`.
- (2026-01-10 05:08Z) Updated progress and decision log after implementing abort propagation cleanup and restart recovery guardrails; added deterministic tests for both.
