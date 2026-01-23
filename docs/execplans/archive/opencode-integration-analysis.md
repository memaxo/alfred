# OpenCode Orchestrator Integration Analysis

Owner: agent
Status: Complete ✅ (AgentFS-first + server profile shipped; OpenCode auth scope deferred)
Created: 2026-01-09
Last Updated: 2026-01-10
Target: **ALFRED itself** (not the apps ALFRED generates)

## Plan

- Add `toolOpenCode` (ACP stdio) and register it in `orchestratorToolSources`.
- Teach the workflow runtime `runAgent()` to dispatch by `AgentSpec.agentType` (`codex|droid|opencode`, default `codex`).
- Extend the Ralph loop to support the `opencode` executor.
- Add regression tests for dispatch + tool policy.
- Keep this doc accurate by updating “verified” sections with concrete code evidence.
- Add **executor execution profiles** (`default|server`) routed from `AgentSpec.profile`.
- Implement **server profile** per executor:
  - `codex`: long-lived `codex app-server` process inside AgentFS container; multi-turn via JSONL JSON-RPC.
  - `opencode`: long-lived ACP stdio process inside AgentFS container; reuse across prompts.
  - `droid`: explicitly **not server-capable** for now (default only), documented with rationale.
- Add deterministic server lifecycle cleanup on workflow completion (must not leak container processes when `retainContainer=1`).
- Add deterministic tests covering: success, crash recovery/restart, abort propagation, and no leaked servers on cleanup.

## Assumptions (explicit)

- **AgentFS is the default environment** (already enforced in `buildAgentSpec()` / AgentFS workspace dispatch).
- **“Long-lived” is scoped to one AgentFS container** (project-scoped via `retainContainer`) and keyed by `(containerName, executor, profile)`.
- **Server profile is deterministic + testable**: no random port allocation, no unmanaged background processes; lifecycle is explicit and tied to workflow execution.

## Execution profiles (brief comparison)

- **`default` (per-prompt process):** spawn a fresh backend process per prompt/turn, then exit; simplest semantics and lowest lifecycle risk, but higher per-turn overhead.
- **`server` (long-lived inside AgentFS):** start a backend process once inside the AgentFS container, reuse it for multiple prompts in the same container, and stop it on workflow completion; lower per-turn overhead, but requires deterministic startup/health/cleanup.
- **Container-default:** ALFRED routes executor work **inside AgentFS containers by default** via `containerName`/`containerCw`. For `codex` + `opencode`, execution profile defaults to `server` inside AgentFS when not explicitly set, with a deterministic fallback to `default` on server start failure (unless strict mode is enabled).

## Progress

- [x] 2026-01-09: Implemented `toolOpenCode` + ACP stdio execution scaffolding.
- [x] 2026-01-09: Registered `toolOpenCode` in `packages/agent/src/v6.ts`.
- [x] 2026-01-09: Updated `packages/runtime/src/orchestrator/agent.ts` to dispatch `codex|droid|opencode`.
- [x] 2026-01-09: Extended Ralph loop executor enum + schema to include `opencode`.
- [x] 2026-01-09: Added unit tests covering dispatch and OpenCode policy.
- [x] 2026-01-10: Updated ExecPlan for opt-in `server` execution profile per executor (design + acceptance).
- [x] 2026-01-10: Implement shared server registry keyed by `(containerName, executor, profile)` with single-flight + safe shutdown.
- [x] 2026-01-10: Implement `opencode` server profile (long-lived ACP stdio process inside AgentFS container).
- [x] 2026-01-10: Implement `codex` server profile (long-lived `codex app-server` inside AgentFS container).
- [x] 2026-01-10: Wire runtime dispatch to pass execution profile into tools and stop servers on workflow completion.
- [x] 2026-01-10: Add deterministic tests for server profile (success, crash recovery, abort, cleanup).
- [x] 2026-01-10: Default `execProfile=server` inside AgentFS when `AgentSpec.profile` is unset (codex + opencode) with deterministic fallback to `default` on server-start failure.
- [x] 2026-01-10: Default `execProfile=server` at the tool boundary inside AgentFS containers when `execProfile` is omitted (codex + opencode), keeping `execProfile=default` as an explicit opt-out.
- [x] 2026-01-10: Fix Codex server stdin by adding `docker exec -i` and add a regression test.
- [x] 2026-01-10: Add tool-level fallback + strict mode (`ORCH_EXEC_PROFILE_STRICT=1`) so direct tool callers behave deterministically (not just `runAgent()`).
- [x] 2026-01-10: Add shared metrics for server registry outcomes + server→default fallbacks.
- [x] 2026-01-10: Ensure non-agent phases that invoke Codex (`merge`, `conflict`, `review`) also route execution inside AgentFS containers by passing `containerName` + `containerCw`.
- [x] 2026-01-10: Extend Ralph loop to pass `containerName`/`containerCw` + `execProfile`, with deterministic fallback + abort propagation tests.
- [x] 2026-01-10: Install `opencode` CLI into the AgentFS Docker image with a pinned version.

## Surprises & Discoveries

- 2026-01-09: `Bun.spawn(..., { stdin: "pipe" })` exposes stdin as a `FileSink` (not a `WritableStream`), so ACP’s `ndJsonStream(...)` needs an adapter wrapper.
- 2026-01-10: `AgentSpec.profile` already exists but `toolCodex` also has a `profile` field (Codex CLI profile). We need a separate field for “execution profile” (default vs server) to avoid breaking callers that use Codex CLI profiles.
- 2026-01-10: TypeScript does not treat Promise executors as “synchronous for flow analysis”, so “assign inside `new Promise(...)` then use outside” patterns can narrow to `never`; use an explicit deferred helper for turn lifecycle state.
- 2026-01-10: `codex app-server` over `docker exec` must be started with `-i` to keep stdin open; without it, JSON-RPC requests can deadlock or drop.

## Decision Log

- 2026-01-09: Reused `droid.exec` scope/policy gate for OpenCode execution to avoid introducing a new auth scope before OpenCode is production-ready.
- 2026-01-09: Made the OpenCode command/args env-configurable (`OPENCODE_ACP_CMD`, `OPENCODE_ACP_ARGS`) instead of assuming a specific `opencode` CLI contract.
- 2026-01-10: Treat `AgentSpec.profile` as the executor execution profile (`default|server`) and introduce a separate tool input field (e.g. `execProfile`) rather than overloading Codex’s existing `profile` (Codex CLI profile).
- 2026-01-10: For `codex` server profile, use `codex app-server` (vendor protocol) over `codex exec --json` because it provides a real multi-turn, long-lived protocol.
- 2026-01-10: For `opencode` server profile, prefer keeping the ACP stdio process alive (no ports) to stay deterministic and container-local; HTTP `opencode serve` remains a future option.
- 2026-01-10: `droid` remains default-only until a documented long-lived backend exists; server profile will be rejected or treated as default with an explicit notice.
- 2026-01-10: Prefer `server` execution by default inside AgentFS (when `AgentSpec.profile` is unset) and fall back to `default` on deterministic server-start failures (`*_server_start_failed`) with a runtime notice (`executor_server_fallback_default`).
- 2026-01-10: Resolve `execProfile` inside the executor tools using `(execProfile, containerName)` so server-default behavior holds for direct tool callers (not just `runAgent()`), while preserving `default` as an explicit override.
- 2026-01-10: Do **not** remove `default` execution yet; keep it as an explicit opt-out and as the deterministic fallback path when server start fails. Standardize on `server` as the default **only inside AgentFS** (where lifecycle is controlled and testable).
- 2026-01-10: Add `ORCH_EXEC_PROFILE_STRICT=1` to disable server→default fallback in high-assurance runs (fail fast instead of silently degrading).

## Outcomes & Retrospective

- Implemented baseline wiring for OpenCode as an ACP-backed tool + runtime dispatch; OpenCode is now selectable via `AgentSpec.agentType` without breaking Codex/Droid.
- Implemented `server` execution profile with deterministic lifecycle + tests; server is now the default inside AgentFS for `codex`/`opencode` when `AgentSpec.profile` is unset, with safe fallback to `default`.
- Standardized server-default behavior inside AgentFS for any direct `toolCodex` / `toolOpenCode` callers by defaulting to `server` when `containerName` indicates AgentFS and `execProfile` is unset.
- Standardized AgentFS container routing for all runtime Codex calls (including merge/conflict/review), so “AgentFS-first” is not limited to `runAgent()`.
- Shipped strict-mode + metrics for observability and deterministic failure behavior.
- Updated AgentFS Docker image to include `opencode` so server/default modes can run fully in-container.
- Evidence (file:line):
  - `packages/agent/src/orchestrator/tool/opencode/index.ts:12` defines `toolOpenCode`.
  - `packages/agent/src/v6.ts:175` registers `toolOpenCode` in `orchestratorToolSources`.
  - `packages/runtime/src/orchestrator/agent.ts:371` normalizes `agentType` and execution profile; dispatch begins at `packages/runtime/src/orchestrator/agent.ts:402`.
  - `packages/agent/src/orchestrator/loops/ralph.ts:101` includes `opencode` in the executor union; executor dispatch starts at `packages/agent/src/orchestrator/loops/ralph.ts:275`.
  - `packages/runtime/test/agentfs.test.ts:754` covers `opencode` AgentFS dispatch + execution profile and deterministic fallback tests.
  - `packages/agent/src/orchestrator/tool/opencode/policy.test.ts:9` covers OpenCode policy + schema tests.
  - `packages/agent/src/orchestrator/tool/shared/server.ts:91` defines the shared server registry (`ensureServer(...)`); `packages/agent/src/orchestrator/tool/shared/server.ts:26` defines `resolveExecProfile(...)` for AgentFS-default server mode.
  - `packages/agent/src/orchestrator/tool/shared/server.test.ts:1` covers registry lifecycle + `resolveExecProfile(...)` semantics.
  - `packages/agent/src/orchestrator/tool/shared/metrics.ts:95` defines `executor_server_registry_total` and `executor_server_fallback_total`.
  - `packages/agent/src/orchestrator/tool/codex/server.ts:261` adds `docker exec -i` for Codex server stdin; regression test at `packages/agent/src/orchestrator/tool/codex/server.test.ts:1`.
  - `packages/agent/src/orchestrator/tool/codex/exec.ts:355` routes execution via `execProfile` (`default|server`) with server→default fallback unless strict.
  - `packages/agent/src/orchestrator/tool/codex/server.ts:699` implements the `codex app-server` long-lived execution path.
  - `packages/agent/src/orchestrator/tool/opencode/exec.ts:557` routes OpenCode execution via `execProfile` and reuses a long-lived ACP process (with fallback unless strict).
  - `packages/runtime/src/orchestrator/index.ts:129` stops all executor servers on workflow completion to prevent leaks.
  - `packages/runtime/src/orchestrator/agentfs.ts:61` computes project-scoped/run-scoped AgentFS container names; `packages/runtime/src/orchestrator/agentfs.ts:47` computes deterministic `containerCw`.
  - `packages/runtime/test/orchestrator.executor-cleanup.test.ts:1` asserts executor servers are stopped on success, escalation, and error paths.
  - `packages/agent/src/orchestrator/tool/opencode/exec.test.ts:1` covers `opencode` server profile success/reuse + crash recovery + abort.
  - `packages/agent/src/orchestrator/tool/shared/server.test.ts:1` covers registry lifecycle + safe shutdown.
  - `docker/agentfs/Dockerfile:41` pins and installs the `opencode` CLI into the AgentFS image.
- Not yet done (intentionally deferred):
  - Dedicated auth scope for OpenCode (separate from `droid.exec`) once the execution surface stabilizes.

## Execution modes (brief comparison)

- **Default (per-prompt process):** each prompt spawns a fresh backend process (e.g. `codex exec --json`, ACP stdio), streams output, then exits. Simpler and stateless; higher overhead per prompt; always clean slate.
- **Server (long-lived process in AgentFS container):** the first prompt starts a backend process inside the AgentFS container, subsequent prompts reuse it (keyed by container + executor + profile), and ALFRED stops it on workflow completion. Lower per-prompt overhead; requires lifecycle management + crash recovery + deterministic shutdown. **ALFRED defaults to `server` for `codex`/`opencode` in AgentFS when `AgentSpec.profile` is unset**, and falls back to `default` on server-start failure.

## ExecPlan tracking (ALFRED today + integration requirements)

This integration effort must preserve and extend ALFRED’s **ExecPlan-as-a-runtime-contract**. The orchestrator is already instrumented to generate and append ExecPlan state during execution; OpenCode integration must plug into the same surfaces so humans can resume from plans alone.

### What ALFRED already does (verified)

- **Root + subtask plan paths are first-class**:
  - Root plan path helper: `packages/agent/src/orchestrator/plans.ts` (`rootPlanPath(...)`)
  - Subtask plan path helper: `packages/agent/src/orchestrator/plans.ts` (`subtaskPlanPath(...)`)
- **Subtask ExecPlan skeleton generation exists and is invoked by runtime**:
  - Skeleton generator: `packages/agent/src/orchestrator/multi/execplan.ts` (`generateSubtaskExecPlanSkeleton(...)`)
  - Runtime hook point: `packages/runtime/src/orchestrator/agent.ts` imports `generateSubtaskExecPlanSkeleton` and is responsible for ensuring per-subtask ExecPlans exist before agent execution.
- **Runtime appends Progress / Decision Log during orchestration**:
  - Append helpers: `packages/runtime/src/orchestrator/execplan.ts` (`appendPlanProgressEntry`, `appendDecisionEntry`)
  - Orchestrator loop that appends: `packages/runtime/src/orchestrator/waves.ts` + `packages/runtime/src/orchestrator/agent.ts`
- **Merge/review/conflict phases generate ExecPlan skeletons** (used during multi-agent workflows):
  - Merge skeleton: `packages/agent/src/orchestrator/multi/merge.ts` (`generateMergeExecPlanSkeleton(...)`)
  - Conflict skeleton: `packages/agent/src/orchestrator/multi/conflict.ts` (`generateConflictExecPlanSkeleton(...)`)
  - Fixer skeleton: `packages/agent/src/orchestrator/multi/review.ts` (`generateFixerExecPlanSkeleton(...)`)

### Integration requirements for OpenCode (must-haves)

- **Persist-first rule**: any phase that generates ExecPlan metadata must persist the **root plan** and **every subtask skeleton** under `.agent/plans/<runId>/` **before any agent launches** (including OpenCode agents).
- **Runtime append parity**: OpenCode execution must emit the same high-level lifecycle events and must trigger `appendPlanProgressEntry` / `appendDecisionEntry` updates so a human can audit progress from the ExecPlan alone.
- **No ambiguous “already implemented” prose**: any ACP/AgentBackend/AgentPool abstractions described later in this doc remain **Proposed** unless backed by in-repo code.

## Diff summary (rewrite)

- **Separated facts from proposals**: added a front section that distinguishes **verified ALFRED behavior** vs **proposed OpenCode integration work**.
- **Made the doc skimmable**: moved the prior long-form notes into a collapsed “Legacy raw notes” appendix to keep history without forcing new readers through ~2.6k lines.
- **Anchored to real integration seams**: the actionable plan now points at the orchestrator’s existing seams (`AgentSpec.agentType`, `runAgent`, `orchestratorToolSources`, `packages/protocol/src/acp.ts`).

## Purpose (revised)

This document guides integrating **OpenCode** into **ALFRED**’s multi-agent orchestrator. It is explicitly split into:

- **What exists today (ALFRED, verified)**: current orchestrator/runtime behavior and extension points.
- **What exists today (OpenCode, external)**: patterns observed in an external codebase; not a source of truth for ALFRED.
- **What we are proposing (ALFRED changes)**: concrete, testable steps to make OpenCode a first-class agent backend without breaking Codex/Droid.

## What exists today in ALFRED (verified)

### Orchestration + pipeline

- **Wave planning**: `packages/agent/src/orchestrator/multi/spawn.ts`
  - `planWaves(subTasks, { maxParallel, dependencies })` produces `WavePlan[]` using priority-stable topological scheduling.
  - `AgentSpec` carries **`agentType?: string`** (used by the runtime dispatcher to select Codex/Droid/OpenCode execution).
- **Wave execution**: `packages/runtime/src/orchestrator/waves.ts`
  - `runWaves(ctx)` is the parallel execution orchestrator and emits `WorkflowEvent`s via an async generator.
  - Builds or reuses an execution context (`ContextBuilder`) and maintains ExecPlan progress/decision logging.
- **Agent execution**: `packages/runtime/src/orchestrator/agent.ts`
  - `runAgent({ spec, ... })` dispatches based on `spec.agentType` and defaults to `codex`.
- **Pipeline state machine**: `packages/agent/src/orchestrator/multi/pipeline.ts`
  - `PipelineStage` is a discriminated union for `init → planning → waves → merging → reviewing → completed`, plus `aborted/escalated`.

### Merge/conflict/review

- **Merge planning + skeletons**: `packages/agent/src/orchestrator/multi/merge.ts`
  - `buildMergePlan(outcomes)` derives `expectedFiles`, `branches`, `changedPackages`.
  - `generateMergeExecPlanSkeleton(runId, mergePlan)` emits a merge-analysis ExecPlan template.
- **Conflict scanning + skeletons**: `packages/agent/src/orchestrator/multi/conflict.ts`
  - Conflict detection is based on `<<<<<<< / ======= / >>>>>>>` marker counts.
  - `generateConflictExecPlanSkeleton(runId, result)` emits a conflict-analysis ExecPlan template.
- **Review planning**: `packages/agent/src/orchestrator/multi/review.ts`
  - `buildReviewPlan(...)` selects checks (including `scripts/verify-*.ts`) based on changed file patterns.
  - `generateFixerExecPlanSkeleton(...)` defines the fixer loop contract.

### Stuck detection

- **Tracker + loop detection**: `packages/agent/src/orchestrator/multi/tracker.ts`
  - Defines `AgentEvent` (currently Codex-oriented event names) + `LoopDetector`-based stuck detection with defaults sourced from env vars (`STUCK_*`).

### Workspace isolation

- **AgentFS workspace (Docker + audit)**: `packages/agent/src/environment/agentfs.ts`
- **Worktree manager (parallel isolation)**: `packages/agent/src/orchestrator/tool/worktree.ts`
- **Multi-agent execution environment is AgentFS-only today**: `packages/agent/src/orchestrator/multi/spawn.ts` (`determineEnvironment()` returns `"agentfs"`)

### Tools + registration

- **Orchestrator tool registry**: `packages/agent/src/v6.ts`
  - `orchestratorToolSources` is the canonical list. Adding `toolOpenCode` means adding it here.
- **ACP SDK is already vendored into ALFRED**: `packages/protocol/src/acp.ts`
  - Re-exports `@agentclientprotocol/sdk` and includes ALFRED adapters like `mapAutonomyToAcpMode(...)`.
  - **Important**: this is protocol plumbing; it is not yet a full “OpenCode backend.”

## What exists today in OpenCode (external; not ALFRED source of truth)

The original analysis references an external repo at `/Users/jackmazac/Development/orchestra/packages/orchestrator`. Treat those files as inspiration only; ALFRED implementation must be verified in-repo.

## What we are proposing (ALFRED changes)

### 1) Add an OpenCode tool (`toolOpenCode`) and register it

- **New tool**: `packages/agent/src/orchestrator/tool/opencode/` (folder structure; multiple execution paths + policy)
  - `definition.ts`: Zod input/output schemas (include `authz`)
  - `policy.ts`: policy + scope checks
  - `exec.ts`: execution logic (SDK mode via `@agentclientprotocol/sdk` *or* spawned mode)
  - `index.ts`: legacy-tool export to match `orchestratorToolSources`
- **Register**: add `toolOpenCode` to `orchestratorToolSources` in `packages/agent/src/v6.ts`.

### 2) Teach `runAgent()` to dispatch by `AgentSpec.agentType`

Target file: `packages/runtime/src/orchestrator/agent.ts`

- **Current**: `runAgent()` is coupled to `toolCodex`.
- **Proposed**: route to `{ codex, droid, opencode }` executors based on `spec.agentType` (default to `"codex"`).
- **Constraint**: keep the unified `AgentOutcome` shape stable so merge/review/tracker logic doesn’t regress.

### 3) Extend Ralph loop to support OpenCode (optional but recommended)

Target file: `packages/agent/src/orchestrator/loops/ralph.ts`

- **Current**: `executor: "codex" | "droid"`.
- **Proposed**: add `"opencode"` executor when `toolOpenCode` exists, so OpenCode participates in the same iterative loop contract.

### 4) Decide how ACP fits (protocol vs backend)

Target file: `packages/protocol/src/acp.ts` (exists today)

- **Proposed**: treat ACP as a *transport/types* dependency, not as the orchestrator’s internal abstraction boundary.
- **Avoid**: shipping large “AgentBackend/AgentPool” abstractions in one step unless we prove they reduce duplication versus today’s `runAgent` + tool-based execution.

## Testing requirements (non-negotiable)

Any orchestrator/runtime changes (especially `runAgent` and wave execution) must include tests that cover:

- **Normal success**: mixed subtasks complete and merge/review plans generate as expected.
- **Escalation**: workflow detects and surfaces escalation context.
- **MAX_TRANSITIONS safeguards**: stuck detection triggers deterministically and stops runaway loops.

Prefer exercising the workflow runtime through the canonical fixture (`@alfred/test-kit/workflow/runtime-fixture`) when integration-level behavior changes.

## Open questions

- **Execution mode**: Do we want OpenCode **SDK** mode, **spawned server** mode, or both? What are the isolation requirements relative to AgentFS?
- **Event normalization**: `TrackerContext.AgentEvent` is Codex-shaped today; do we generalize it (and if so, where is the thinnest adapter layer)?
- **Session persistence**: Codex has `codex-session.ts`. Should OpenCode reuse it, or do we need a parallel session table/type?
- **Scope clarity**: What changes are strictly in **ALFRED** vs behavior of **apps ALFRED generates**? Keep these domains separated in future edits.

## Appendix: Legacy raw notes (pre-rewrite)

<details>
<summary>Legacy raw notes (kept for reference; may contain inaccuracies)</summary>

## Purpose

Comprehensive analysis of the OpenCode orchestrator codebase (`/Users/jackmazac/Development/orchestra/packages/orchestrator`) to extract patterns and architecture learnings for ALFRED integration. This document guides the creation of a unified agent interface for Codex, Droid, and OpenCode.

## Executive Summary

The OpenCode orchestrator provides sophisticated multi-agent coordination with:
- **Worker Pool** for lifecycle management and spawn deduplication
- **Backend Resolution** (agent/server) for in-process vs spawned execution
- **Profile System** for declarative worker configuration
- **Workflow Engine** for multi-step task orchestration
- **Job Registry** for async task management

ALFRED can adopt these patterns to create a unified agent interface while maintaining its existing Codex and Droid implementations.

## ALFRED's Existing Orchestration Patterns

Before proposing integration, we must understand ALFRED's current multi-agent coordination architecture:

### 1. Agent Waves Orchestrator

ALFRED implements sophisticated wave-based parallel execution (`packages/runtime/src/orchestrator/waves.ts`):

**Wave Planning:**
- Dependency graph construction from `SubTask[]` with `deps` arrays
- Topological sorting via in-degree calculation
- Wave grouping: up to `maxParallel` agents per wave
- Wave dependencies computed from task dependencies
- Priority-based ordering within waves

**Execution Model:**
```typescript
// packages/agent/src/orchestrator/multi/spawn.ts
export function planWaves(
  subTasks: SubTask[],
  options?: { maxParallel?: number; dependencies?: Map<SubTaskId, SubTaskId[]> }
): WavePlan[]

// packages/runtime/src/orchestrator/waves.ts
async function* runWaves(ctx: OrchestratorContext): AsyncGenerator<WorkflowEvent, WavesResult>
```

**Key Features:**
- Concurrent execution using `pLimit` for concurrency control
- AsyncQueue for event streaming
- Per-agent workspace isolation (AgentFS)
- Handoff context between waves
- Escalation detection (ESCALATION-{agentId}.md files)

**Comparison with OpenCode:**
- OpenCode: Sequential workflow steps with carry-forward
- ALFRED: Parallel waves with dependency resolution
- **Integration Opportunity**: Combine both patterns—use waves for parallel execution, workflows for sequential refinement

### 2. Pipeline State Machine

ALFRED uses a discriminated union state machine (`packages/agent/src/orchestrator/multi/pipeline.ts`):

**Pipeline Stages:**
```typescript
type PipelineStage =
  | { stage: "init"; requirement: string; workspace: string }
  | { stage: "planning"; context: PipelineExecutionContext; subTasks: SubTask[] }
  | { stage: "waves"; waves: WavePlan[]; currentWave: WaveId | null; completedWaves: WaveId[] }
  | { stage: "merging"; mergePlan: MergePlan; analysisComplete: boolean }
  | { stage: "reviewing"; reviewPlan: ReviewPlan; fixAttempts: number; currentCheck: string | null }
  | { stage: "completed"; summary: PipelineSummary }
  | { stage: "escalated" | "aborted"; reason: string; fromStage: ... }
```

**State Transitions:**
- Type-safe transitions via `transitionPipeline()`
- Immutable updates (new pipeline instance per transition)
- Phase timing metrics tracked per stage
- ExecPlan tracking integrated at each stage

**Comparison with OpenCode:**
- OpenCode: Linear workflow steps (no state machine)
- ALFRED: Rich state machine with escalation/abort paths
- **Integration Opportunity**: OpenCode workflows can map to ALFRED pipeline stages

### 3. Session Management

ALFRED implements sophisticated Codex session persistence (`packages/agent/src/orchestrator/codex-session.ts`):

**Session State:**
```typescript
type CodexSessionState = {
  sessionId: string;
  userId: string;
  threadId: string;  // Codex thread ID for continuity
  workingDirectory: string;
  projectId?: string;
  status: "active" | "completed" | "failed";
  linearIssueId?: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}
```

**Features:**
- LRU cache for hot session lookups
- Database persistence via `@alfred/db/repo/codex-session`
- Session resume eligibility assessment
- Thread validation (filesystem-based)
- Automatic cleanup of expired sessions
- User isolation (session ownership validation)

**Resume Logic:**
```typescript
async function assessSessionResumeEligibility(params: {
  session?: CodexSessionState;
  workingDirectory: string;
  validateThread?: (threadId: string) => Promise<boolean>;
}): Promise<SessionResumeAssessment>
```

**Comparison with OpenCode:**
- OpenCode: Session per worker instance (in-memory or via SDK)
- ALFRED: Persistent sessions with thread continuity
- **Integration Opportunity**: Extend session manager to support OpenCode sessions

### 4. Workspace Isolation (AgentFS)

ALFRED uses Docker-based AgentFS for complete isolation (`packages/agent/src/environment/agentfs.ts`):

**AgentFSWorkspace:**
- Docker container shared per orchestration run (not per agent)
- SQLite audit trail for all filesystem operations
- Copy-on-write overlay mode (`agentfsOverlay`)
- Checkpoint/restore via SQLite snapshots (`VACUUM INTO`)
- Container reuse across agents in same runId (named `alfred-agentfs-{runId}`)

**Key Methods:**
```typescript
class AgentFSWorkspace implements Workspace {
  initialize(): Promise<void>;  // docker run (or reuse existing)
  cleanup(): Promise<void>;     // docker rm (unless retainContainer=true)
  checkpoint(label: string): Promise<void>;  // SQLite VACUUM INTO snapshot
  restore(label: string): Promise<void>;      // Open snapshot database
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
}
```

**Integration Points:**
- Codex runs inside container (`containerName`, `containerCw`)
- All file operations recorded in SQLite
- Learning extraction from audit trail
- Run-level container sharing (same runId = same container)

**Comparison with OpenCode:**
- OpenCode: Spawned `opencode serve` processes (no Docker)
- ALFRED: Docker containers with audit trail
- **Integration Opportunity**: OpenCode can run inside AgentFS containers

### 5. Conflict Detection & Merge

ALFRED implements multi-phase conflict resolution (`packages/agent/src/orchestrator/multi/conflict.ts`, `merge.ts`):

**Conflict Scanning:**
```typescript
function countConflictMarkers(content: string): number {
  // Detects <<<<<<<, =======, >>>>>>>
}

type ConflictScanResult = {
  files: string[];
  totalMarkers: number;
  counts: Record<string, number>;
}
```

**Merge Planning:**
```typescript
type MergePlan = {
  summary: string;
  branches: string[];  // Feature branches from agents
  expectedFiles: string[];
  strategy: "worktree" | "branch" | "direct";
  targetBranch: string;
  changedPackages: string[];
}
```

**Merge Phases:**
1. **Merge Execution** (`runMergePhase`): Collect agent outcomes, build merge plan
2. **Conflict Analysis** (`runConflictPhase`): Scan for conflict markers, generate ExecPlan
3. **Merge Analysis** (`runMergeAnalysis`): Validate merged changes
4. **Review** (`runReviewPhase`): Automated checks, self-correction

**Comparison with OpenCode:**
- OpenCode: No conflict detection (sequential workflows)
- ALFRED: Sophisticated conflict scanning and resolution
- **Integration Opportunity**: Apply ALFRED's conflict detection to OpenCode workflows

### 6. Review & Self-Correction

ALFRED implements automated review with fixer loops (`packages/agent/src/orchestrator/multi/review.ts`):

**Review Checks:**
```typescript
type ReviewCheckType = "tests" | "lint" | "static" | "scenario" | "smoke" | "verify";

type ReviewPlan = {
  summary: string;
  checks: ReviewCheck[];
}
```

**Fixer Agent:**
- Automatically spawned on review failure
- Receives failure details and relevant files
- Uses `buildFixerAgentSpec()` for specialized prompt
- Iterates up to max attempts

**Review Flow:**
1. Build review plan from changed files
2. Execute checks (tests, lint, verify scripts)
3. On failure: spawn fixer agent with failure context
4. Fixer updates code, review re-runs
5. Loop until pass or max attempts

**Comparison with OpenCode:**
- OpenCode: No built-in review/fix loop
- ALFRED: Automated review with self-correction
- **Integration Opportunity**: Add review phase to OpenCode workflows

### 7. Tracker & Stuck Detection

ALFRED tracks agent progress with cognitive loop detection (`packages/agent/src/orchestrator/multi/tracker.ts`):

**Tracker Context:**
```typescript
type TrackerContext = {
  state: TrackerState;  // Agent/wave status
  blockedBy: Map<SubTaskId, Set<SubTaskId>>;  // Reverse deps
  dependsOn: Map<SubTaskId, Set<SubTaskId>>;  // Forward deps
  detectors: Map<AgentId, LoopDetector>;  // Per-agent loop detection
  options: StuckDetectionOptions;
}
```

**Stuck Detection:**
- Time-based: `noProgressMs` threshold
- Count-based: `maxTransitions` limit
- Semantic: Embedding similarity via `LoopDetector`
- Hash-based: Repeated state detection

**Event Tracking:**
```typescript
type AgentEvent =
  | { type: "codex/thought"; agentId: AgentId; text: string; ts: number }
  | { type: "codex/command"; agentId: AgentId; command: string; status: string; ts: number }
  | { type: "codex/file"; agentId: AgentId; path: string; kind: string; ts: number }
```

**Comparison with OpenCode:**
- OpenCode: No stuck detection (relies on timeouts)
- ALFRED: Multi-layer cognitive loop detection
- **Integration Opportunity**: Apply ALFRED's stuck detection to OpenCode workers

### 8. ExecPlan Integration

ALFRED uses ExecPlans for agent guidance and progress tracking:

**ExecPlan Structure:**
- Root plan: `.agent/plans/<runId>/plan.md`
- Subtask plans: `.agent/plans/<runId>/<subTaskId>.md`
- Sections: Purpose, Plan, Progress, Surprises, Decision Log, Outcomes

**Agent Prompting:**
```typescript
function buildAgentPrompt(spec: AgentSpec, task: SubTask | undefined): string {
  // Includes ExecPlan path, instructions to update Progress/Decision Log
  // Subtask requirement, acceptance criteria, file hints
  // Handoff context from previous waves
  // User clarifications
}
```

**Progress Tracking:**
- Agents update ExecPlan files as they work
- Progress entries appended via `appendPlanProgressEntry()`
- Decision log captures rationale
- Surprises logged for learning

**Comparison with OpenCode:**
- OpenCode: No ExecPlan pattern (relies on worker output contracts)
- ALFRED: Rich ExecPlan system for agent guidance
- **Integration Opportunity**: OpenCode workers can read/update ExecPlans

### 9. Linear Integration

ALFRED deeply integrates with Linear for issue tracking:

**Codex Context:**
```typescript
context: {
  linearIssueId?: string;
  linearSessionId?: string;
  linearSpace?: string;
  linearAuthz?: string;
  relevantFiles?: string[];
}
```

**Features:**
- Codex events mapped to Linear activity (`packages/agent/src/orchestrator/tool/codex-linear.ts`)
- Session binding to Linear issues
- Issue status updates on completion
- PR linking via Linear issue IDs

**Comparison with OpenCode:**
- OpenCode: No Linear integration
- ALFRED: Deep Linear integration for issue tracking
- **Integration Opportunity**: Extend Linear integration to OpenCode agents

### 10. Learning Context Injection

ALFRED injects learning context into Codex prompts (`packages/agent/src/orchestrator/tool/codex/exec.ts`):

**Learning Sources:**
- Similar past executions (`buildCodexLearningContext`)
- Heuristic context from failures (`buildCodexHeuristicContext`)
- Project-level learning resources
- AgentFS audit trail extraction

**Injection Flow:**
```typescript
// Enrich prompt with learning context
const learningContext = await buildCodexLearningContext(learningResource, prompt, 2000);
const heuristicContext = await buildCodexHeuristicContext(prompt, 1200);
const enrichedPrompt = `${learningContext}\n\n${heuristicContext}\n\n${prompt}`;
```

**Comparison with OpenCode:**
- OpenCode: No learning context injection
- ALFRED: Sophisticated learning from past executions
- **Integration Opportunity**: Extend learning injection to OpenCode

## Key Architecture Patterns

### 1. Worker Profile System

OpenCode defines workers via declarative profiles:

```typescript
interface WorkerProfile {
  id: string;
  name: string;
  kind?: "server" | "agent" | "subagent";
  execution?: "foreground" | "background";
  model: string;
  purpose: string;
  whenToUse: string;
  promptFile?: string;
  systemPrompt?: string;
  supportsVision?: boolean;
  supportsWeb?: boolean;
  tools?: Record<string, boolean>;
  temperature?: number;
  tags?: string[];
  requiredSkills?: string[];
}
```

**Learnings for ALFRED:**
- Standardize agent configuration via profiles
- Include purpose/whenToUse for intelligent routing
- Support capability flags (vision, web, tools)
- Allow prompt customization per agent

### 2. Worker Pool Pattern

Centralized lifecycle management with:
- In-memory worker registry
- Spawn deduplication (in-flight promise tracking)
- Status updates via events
- Session ownership tracking
- Device registry for cross-session reuse

```typescript
class WorkerPool {
  workers: Map<string, WorkerInstance>;
  inFlightSpawns: Map<string, Promise<WorkerInstance>>;
  sessionWorkers: Map<string, Set<string>>;
  
  async getOrSpawn(profile, options, spawnFn): Promise<WorkerInstance>;
  updateStatus(id, status, error?): void;
  trackOwnership(sessionId, workerId): void;
}
```

**Learnings for ALFRED:**
- Create AgentPool for managing Codex/Droid/OpenCode instances
- Prevent duplicate spawns via promise tracking
- Track agent-session associations
- Event-based status notifications

### 3. Backend Resolution

Workers can run via different backends:
- **agent**: In-process SDK client (faster, shared context)
- **server**: Spawned `opencode serve` process (isolated, more resources)

```typescript
function resolveWorkerBackend(profile): "agent" | "server" {
  if (profile.kind === "server") return "server";
  if (profile.kind === "agent" || profile.kind === "subagent") return "agent";
  return profile.backend === "agent" ? "agent" : "server";
}
```

**Learnings for ALFRED:**
- Codex: Always spawned process (Rust binary)
- Droid: Spawned process (droid CLI)
- OpenCode: Can be in-process (SDK) or spawned (opencode serve)
- Abstract the spawn/connect distinction

### 4. Workflow Engine

Multi-step orchestration with:
- Step definitions (worker, prompt, carry flag)
- Context carry-forward between steps
- Handoff sections (Summary, Actions, Artifacts, Risks, Next)
- Per-step timeout and error handling

```typescript
interface WorkflowStepDefinition {
  id: string;
  title?: string;
  workerId: string;
  prompt: string;
  carry?: boolean;
  timeoutMs?: number;
  requiredSkills?: string[];
}

async function runWorkflow(input, deps): Promise<WorkflowRunResult> {
  let carry = "";
  for (const step of workflow.steps) {
    const { result, carry: newCarry } = await executeStep(step, carry);
    if (result.status === "error") break;
    carry = newCarry;
  }
}
```

**Learnings for ALFRED:**
- Port workflow engine for multi-agent coordination
- Standardize handoff format between agents
- Support iterative refinement loops (like Ralph)
- Allow mixed agent types in workflows

### 5. Job Registry

Async task management:
- Create jobs with unique IDs
- Track status (running, succeeded, failed, canceled)
- Wait/await pattern for results
- Automatic pruning of old jobs

```typescript
class WorkerJobRegistry {
  create(input): WorkerJob;
  setResult(id, { responseText }): void;
  setError(id, { error }): void;
  await(id, options): Promise<WorkerJob>;
}
```

**Learnings for ALFRED:**
- Enhance existing Ralph loop with job tracking
- Support async agent delegation
- Allow multiple concurrent agent tasks

### 6. Bootstrap Prompts

Workers receive identity injection:

```typescript
async function buildWorkerBootstrapPrompt({ profile, directory }): Promise<string> {
  const profilePrompt = await resolveProfilePrompt(profile);
  const outputContract = await loadPromptFile("snippets/worker-output-contract.md");
  
  return `
<system-context>${profilePrompt}</system-context>
<worker-identity>
You are worker "${profile.id}" (${profile.name}).
Your capabilities: ${JSON.stringify(capabilities)}
</worker-identity>
<orchestrator-instructions>
${toolsSection}
${behaviorSection}
</orchestrator-instructions>`;
}
```

**Learnings for ALFRED:**
- Standardize agent initialization prompts
- Include capability metadata in prompts
- Define output contracts for structured handoffs

## ALFRED's Workspace Isolation Architecture

ALFRED implements sophisticated multi-layer isolation combining Docker containers, Git worktrees, and AgentFS audit trails:

### 1. AgentFS: Docker-Based Workspace with SQLite Audit

**Architecture Principle:** AgentFS runs INSIDE Docker containers. Docker provides process isolation; AgentFS provides audit trail.

**Implementation:** `packages/agent/src/environment/agentfs.ts`

**Key Features:**

**Container Lifecycle:**
```typescript
class AgentFSWorkspace implements Workspace {
  // Container naming: alfred-agentfs-{runId}
  // Shared across agents in same orchestration run
  private async initializeContainer(): Promise<void> {
    // 1. Check if container exists (reuse)
    // 2. Create with volume mount: ${repoBase}:/workspace
    // 3. Resource limits: 1 CPU, 1GB memory
    // 4. Race condition handling (retry inspect)
  }
}
```

**Volume Mount Pattern:**
- Repository mounted at `/workspace` inside container
- All `exec()` calls run with `cwd=/workspace`
- Container persists across agent executions in same run
- Cleanup removes container unless `retainContainer=true`

**SQLite Audit Trail:**
- Database path: `.agentfs/{runId}/{agentId}.db`
- Structured audit of all filesystem operations
- Queryable tool call history
- Checkpoint/restore via SQLite snapshots (`VACUUM INTO`)
- Metrics: `agentfsDbSizeBytes`, `agentfsExecutionsTotal`, `agentfsCheckpointsTotal`

**Checkpoint System:**
```typescript
async checkpoint(label: string): Promise<void> {
  // Creates atomic snapshot via SQLite VACUUM INTO
  // Fallback: Logical snapshot (copy all tables)
  // Snapshot path: {dbPath}.checkpoint-{label}
  // Note: This is SQLite-level checkpoint, not git tags
  // Git tags are used separately for workspace-level checkpoints
}
```

**Comparison with OpenCode:**
- OpenCode: No workspace isolation (process-level only)
- ALFRED: Docker + SQLite audit trail
- **Integration Opportunity**: OpenCode agents should use AgentFSWorkspace for isolation and audit

### 2. Git Worktree Isolation for Parallel Execution

**Problem Solved:** Multiple agents editing the same repository simultaneously without file contention.

**Implementation:** `packages/agent/src/orchestrator/tool/worktree.ts`

**Worktree Creation:**
```typescript
export const worktreeManager = {
  create: async (
    repoRoot: string,
    runId: string,
    agentId: string,
    baseRef = "HEAD"
  ): Promise<WorktreeHandle> => {
    // Branch: agent/{runId}/{agentId}
    // Path: .agent/worktrees/{runId}/{agentId}
    // Metadata: .alfred-worktree.json
  }
}
```

**Key Features:**

**Isolation Strategy:**
- Each agent gets isolated worktree + branch tuple
- Branch naming: `agent/{sanitizedRunId}/{sanitizedAgentId}`
- Path structure: `.agent/worktrees/{runId}/{agentId}`
- Metadata file: `.alfred-worktree.json` (runId, agentId, branch, baseRef)

**Safe Merge Preview:**
```typescript
safeMerge: async (
  repoRoot: string,
  targetBranch: string,
  sourceBranch: string
): Promise<{ success: boolean; conflictFiles: string[] }> => {
  // 1. Create detached preview worktree
  // 2. Attempt merge (--no-commit --no-ff)
  // 3. Collect conflict files (git diff --diff-filter=U)
  // 4. Cleanup preview worktree
}
```

**Cleanup Backlog:**
- Preview worktrees registered for deferred cleanup
- Retry logic (3 attempts with exponential backoff)
- Batch cleanup via `flushPreviewCleanupBacklog()`
- Filesystem-level cleanup for orphaned previews

**Comparison with OpenCode:**
- OpenCode: No worktree isolation (single working directory)
- ALFRED: Per-agent worktrees enable true parallel execution
- **Integration Opportunity**: OpenCode agents should use worktrees when running in parallel

### 3. Docker Integration for Security Sandboxing

**Implementation:** `packages/agent/src/orchestrator/tool/docker.ts`

**Docker Tool Actions:**
- `build`: Build images from Dockerfile
- `run`: Create containers with volume mounts, resource limits
- `start`/`stop`: Container lifecycle management
- `inspect`: Check container status, metadata
- `exec`: Execute commands inside containers
- `exec.probe`: Health checks with timeout
- `logs`: Stream container logs
- `rm`: Remove containers

**Security Features:**

**Directory Sandboxing:**
```typescript
function assertAllowedDirectory(candidate: string) {
  // Validates against DEFAULT_ALLOW_PREFIXES
  // Prevents filesystem traversal attacks
  // Uses openDirectorySecure() for validation
}
```

**Resource Limits:**
```typescript
resources: {
  cpus: z.number().min(0.1).max(16),
  memory: z.string(), // e.g., "1g", "512m"
}
```

**Policy Enforcement:**
- `deploy.read` scope for `exec.probe`
- `deploy.write` scope for all other actions
- Policy checks via `requireToolScopesAndPolicy()`

**Container Naming Convention:**
- AgentFS containers: `alfred-agentfs-{runId}`
- Shared across agents in same orchestration run
- Project tracking: `upsertProjectContainer()` for metadata

**Comparison with OpenCode:**
- OpenCode: No Docker integration (spawns processes directly)
- ALFRED: Full Docker lifecycle management with security policies
- **Integration Opportunity**: OpenCode spawned mode should use Docker for isolation

### 4. Git Hooks and CI/CD Integration

**Implementation:** `lefthook.yml` + `.github/workflows/`

**Pre-Commit Hook:**
```yaml
pre-commit:
  commands:
    format:
      glob: "*.{ts,tsx,js,jsx,json,jsonc,css,scss,md,mdx}"
      run: bun x ultracite fix {staged_files}
      stage_fixed: true  # Auto-stage formatted files
```

**Pre-Push Hook:**
```yaml
pre-push:
  parallel: true
  commands:
    typecheck:
      run: bunx turbo typecheck --filter="[${UPSTREAM}...HEAD]"
      fail_text: "Type errors found - push blocked"
    
    lint:
      run: bun x ultracite check {push_files} || true
      skip_fail: true  # Warn but don't block
    
    tests:
      run: ALFRED_TEST_SCOPE=unit bun run test:fast --filter="$FILTER"
      fail_text: "Tests failed - push blocked"
```

**Key Features:**

**Turbo Filtering:**
- Git-based filters: `[origin/main...HEAD]` for changed packages
- Package exclusions: `--filter='!@alfred/voice'`
- Fast feedback: Only test changed packages

**Test Scope Control:**
- `ALFRED_TEST_SCOPE=unit`: Fast unit tests only
- Timeout protection: `ALFRED_TEST_TIMEOUT_MS=60000`
- Watchdog: `ALFRED_TEST_WATCHDOG_MS=180000`
- Bail early: `--bail=3` (stop after 3 failures)

**CI/CD Workflow:**
- 4 parallel jobs: lint, typecheck, tests, boundaries
- Turbo caching via `rharkor/caching-for-turbo@v1.7`
- Concurrency control: `cancel-in-progress: true`
- Linear integration: Extract issue IDs from branch names

**Comparison with OpenCode:**
- OpenCode: No documented hooks/CI patterns
- ALFRED: Comprehensive pre-commit/pre-push hooks with Turbo optimization
- **Integration Opportunity**: OpenCode should adopt similar hook patterns for quality gates

### 5. Branching and Worktree Patterns

**Branch Naming Convention:**
- Agent branches: `agent/{runId}/{agentId}`
- Sanitization: Replace non-alphanumeric with `-`
- Base ref: Defaults to `HEAD`, configurable

**Worktree Metadata:**
```typescript
type WorktreeMetadata = {
  runId: string;
  agentId: string;
  branch: string;
  baseRef: string;
  createdAt: string; // ISO timestamp
}
```

**Conflict Resolution Flow:**
1. **Safe Merge Preview:** `worktreeManager.safeMerge()` detects conflicts
2. **Arbiter Agent:** Spawns specialized agent to resolve conflicts
3. **Resolution Worktree:** Creates temporary worktree for resolution
4. **Merge Completion:** Applies resolution and completes merge

**Cleanup Patterns:**
- Per-run cleanup: `worktreeManager.cleanup(repoRoot, runId)`
- Per-worktree removal: `worktreeManager.remove(repoRoot, worktreePath)`
- Prune stale references: `worktreeManager.prune(repoRoot)`
- Preview backlog: Deferred cleanup with retry logic

**Integration with AgentFS:**
- Worktrees created on host filesystem (not inside containers)
- Container mounts repository at `/workspace` (includes worktrees)
- Worktree paths resolved relative to container `/workspace` when executing inside container
- Metadata persisted in `.alfred-worktree.json` files on host

**Comparison with OpenCode:**
- OpenCode: No worktree/branching patterns documented
- ALFRED: Sophisticated worktree management with conflict resolution
- **Integration Opportunity**: OpenCode should use worktrees for parallel execution

## Codex's Deep Integrations

Codex (`packages/agent/src/orchestrator/tool/codex/`) has extensive integrations that OpenCode and Droid should match:

### 1. Event Processing Pipeline

**Event Types:**
- `thread.started`, `turn.started`, `turn.completed`, `turn.failed`
- `item.started`, `item.updated`, `item.completed` (reasoning, commands, file changes, MCP tool calls)
- Structured NDJSON streaming from Codex CLI

**Event Processor:**
```typescript
// packages/agent/src/orchestrator/tool/codex/event-processor.ts
function processThreadEvent(
  event: ThreadEvent,
  context: EventProcessorContext
): ProcessedEvent {
  // Extracts: threadId, turnStarted, turnCompleted, tokenUsage
  // Processes: reasoning traces, output chunks, artifacts
  // Emits: alfredEvents for downstream systems
}
```

**Integration Points:**
- Reasoning accumulation for knowledge graph
- Artifact extraction for merge planning
- Token usage tracking for cost optimization
- Turn duration metrics

### 2. Session Continuity

**Resume Logic:**
- Validates thread ID exists in filesystem (`~/.codex/sessions/{threadId}.json`)
- Checks working directory match
- Validates thread file accessibility
- Falls back to new thread on validation failure

**Session State:**
- Thread ID persistence across executions
- Project-level session binding
- Linear issue association
- Automatic session cleanup (24h TTL)

### 3. Output Schema Validation

**Structured Outputs:**
- Zod schema validation for `outputSchema`
- Complexity limits (max depth, properties)
- External ref detection
- Multiple validator fallbacks (Ajv2020, Ajv2019, Ajv)

**Usage:**
- Codex can return structured JSON matching schema
- Enables type-safe agent responses
- Supports complex nested structures

### 4. Metrics & Observability

**Metrics Tracked:**
- Session validation timeouts
- Writer errors (disconnect vs write failure)
- Tool execution duration
- Token usage per turn
- Session continuity success/failure

**Integration:**
- Prometheus metrics via `@alfred/metrics`
- Logging via `@alfred/logger`
- Event streaming via `ToolWriter`

### 5. Policy & Security

**Policy Enforcement:**
- Autonomy level → sandbox mapping (`read-only` vs `workspace-write`)
- Approval mode selection (`untrusted`, `on-failure`, `on-request`, `never`)
- Environment variable allowlists
- Executable resolution with security checks

**Security Features:**
- Directory handle pinning (TOCTOU protection)
- Secure spawn wrapper
- Container execution support
- Authz token validation

### 6. Learning Integration

**Learning Sources:**
- Codex execution persistence (`persistCodexExecution`)
- Reasoning trace persistence (`persistReasoning`)
- AgentFS audit trail processing
- Project-level learning aggregation

**Context Building:**
- Similar execution retrieval
- Failure pattern matching
- Heuristic context from corrections
- Project-specific learning resources

## Droid's Current Limitations

Droid (`packages/agent/src/orchestrator/tool/droid.ts`) is simpler than Codex and lacks several features:

### Missing Features

1. **Session Management:**
   - No session persistence
   - No thread continuity
   - No resume logic

2. **Reasoning Accumulation:**
   - Basic reasoning extraction (`extractDroidReasoning`)
   - No structured reasoning traces
   - No persistence to knowledge graph

3. **Artifact Extraction:**
   - Returns empty artifacts array
   - No file change detection
   - No artifact reasoning formatting

4. **Learning Context:**
   - No learning context injection
   - No heuristic context
   - No execution persistence

5. **Event Processing:**
   - Simple stdout/stderr streaming
   - No structured event parsing
   - No turn/token tracking

6. **Output Schema:**
   - No structured output support
   - No schema validation

### Droid Strengths

1. **Security:**
   - Strict sandboxing
   - Secure directory handles
   - Environment allowlists

2. **Simplicity:**
   - Direct CLI execution
   - Minimal overhead
   - Fast startup

### Upgrade Path

To achieve parity with Codex, Droid needs:
- Session management (`droid-session.ts`)
- Reasoning accumulator integration
- Artifact extraction from output
- Learning context injection
- Event processing pipeline
- Output schema support

## Critical Integration Points

### 1. Workspace Factory

**Current:**
```typescript
// packages/agent/src/environment/factory.ts
export class WorkspaceFactory {
  static async create(
    kind: WorkspaceKind,
    agentId: string,
    runId: string,
    repoBase: string,
    config?: AgentFSWorkspaceConfig
  ): Promise<Workspace>
}
```

**Integration:**
- OpenCode agents need workspace isolation
- Can reuse AgentFSWorkspace for OpenCode
- Or create OpenCodeWorkspace adapter

### 2. Agent Execution (`runAgent`)

**Current:**
```typescript
// packages/runtime/src/orchestrator/agent.ts
export async function runAgent({
  spec: AgentSpec,
  workspace: Workspace,
  // ... other params
}): Promise<AgentOutcome>
```

**Integration:**
- Currently hardcoded to `toolCodex.execute()`
- Needs abstraction for agent backend selection
- Should support Codex/Droid/OpenCode dispatch

### 3. Wave Execution

**Current:**
```typescript
// packages/runtime/src/orchestrator/waves.ts
const agentPromises = agentSpecs.map((spec) =>
  limit(async () => {
    return await runAgent({ spec, ... });
  })
);
```

**Integration:**
- Wave planning already supports `agentType` field
- Need to route to correct agent backend based on `spec.agentType`
- OpenCode agents can participate in waves

### 4. Ralph Loop Integration

**Current:**
```typescript
// packages/agent/src/orchestrator/loops/ralph.ts
export async function runRalphLoop({
  executor: "codex" | "droid",
  prompt: string,
  // ... config
}): Promise<RalphResult>
```

**Integration:**
- Already supports Codex and Droid
- Need to add OpenCode executor
- Unified interface enables all three agents

### 5. Tool Registration

**Current:**
```typescript
// packages/agent/src/v6.ts
const orchestratorToolSources: LegacyTool[] = [
  toolCodex,
  toolDroid,
  toolRalph,
  // ... other tools
];
```

**Integration:**
- Add `toolOpenCode` to tool sources
- Register in orchestrator toolset
- Enable via tRPC router

## ALFRED Coding Agent Abstraction Interface

### Core Design Principles

The ALFRED agent abstraction provides a unified interface for all coding agents (Codex, Droid, OpenCode, and future agents) while maintaining deep integration with the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/). This abstraction enables:

1. **Protocol Compliance**: Full ACP v0.10+ compatibility for editor integration
2. **Unified Execution**: Consistent interface across all agent backends
3. **Workspace Isolation**: AgentFS integration for all agents
4. **Event Streaming**: Standardized event emission compatible with ACP
5. **Tool Orchestration**: Unified tool call handling and permission management

### Agent Abstraction Interface

```typescript
// packages/agent/src/orchestrator/agent/interface.ts

import type {
  AgentCapabilities,
  SessionId,
  SessionMode as AcpSessionMode,
  ToolCall,
  ToolCallUpdate,
  ContentBlock,
  PromptRequest,
  PromptResponse,
} from "@agentclientprotocol/sdk";
import type { Workspace } from "@alfred/agent/environment";
import type { ToolWriter } from "@alfred/agent/orchestrator/tool/shared";

/**
 * Agent profile defining capabilities, configuration, and metadata.
 * Maps to ACP AgentCapabilities and extends with ALFRED-specific features.
 */
export interface AgentProfile {
  /** Unique identifier for this agent type (e.g., "codex", "droid", "opencode") */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Backend execution type */
  backend: "spawned" | "sdk" | "server";
  
  /** Model identifier (if applicable) */
  model?: string;
  
  /** Purpose description for intelligent routing */
  purpose: string;
  
  /** When to use this agent */
  whenToUse: string;
  
  /** ACP-compatible capabilities */
  capabilities: AgentCapabilities & {
    /** ALFRED-specific: Supports vision/image understanding */
    vision?: boolean;
    
    /** ALFRED-specific: Supports web search/browsing */
    web?: boolean;
    
    /** ALFRED-specific: Supports file editing */
    edit?: boolean;
    
    /** ALFRED-specific: Supports terminal execution */
    terminal?: boolean;
    
    /** ALFRED-specific: Supports structured output schemas */
    structuredOutput?: boolean;
    
    /** ALFRED-specific: Supports reasoning traces */
    reasoning?: boolean;
    
    /** ALFRED-specific: Supports session persistence */
    sessionPersistence?: boolean;
    
    /** ALFRED-specific: Supports Ralph loop iterations */
    ralphLoop?: boolean;
  };
  
  /** System prompt or prompt file path */
  systemPrompt?: string;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Required skills for this agent */
  requiredSkills?: string[];
  
  /** Temperature setting (if applicable) */
  temperature?: number;
}

/**
 * Agent instance representing a running agent backend.
 * Manages lifecycle, session state, and execution context.
 */
export interface AgentInstance {
  /** Agent profile */
  profile: AgentProfile;
  
  /** Current status */
  status: "starting" | "ready" | "busy" | "error" | "stopped";
  
  /** ACP session ID */
  sessionId?: SessionId;
  
  /** ALFRED session ID (may differ from ACP sessionId) */
  alfredSessionId?: string;
  
  /** Thread ID for continuity (agent-specific) */
  threadId?: string;
  
  /** Workspace isolation */
  workspace: Workspace;
  
  /** Started timestamp */
  startedAt: Date;
  
  /** Last activity timestamp */
  lastActivity?: Date;
  
  /** Shutdown handler */
  shutdown?: () => Promise<void>;
  
  /** ACP connection (if using ACP SDK) */
  acpConnection?: AgentSideConnection;
}

/**
 * Unified agent execution input.
 * Maps to ACP PromptRequest with ALFRED extensions.
 */
export interface AgentExecuteInput {
  /** Main prompt/request text */
  prompt: string;
  
  /** Working directory (resolved relative to workspace) */
  cw?: string;
  
  /** Model override (if supported) */
  model?: string;
  
  /** Timeout in seconds */
  timeout?: number;
  
  /** Ralph loop configuration */
  ralph?: {
    maxIterations: number;
    completionPromise?: string;
    iteration?: number;
  };
  
  /** ACP session mode */
  sessionMode?: AcpSessionMode;
  
  /** ACP prompt capabilities */
  promptCapabilities?: {
    audio?: boolean;
    embeddedContext?: boolean;
    image?: boolean;
  };
  
  /** Context for learning injection */
  learningContext?: string;
  
  /** Linear issue context */
  linearIssueId?: string;
  
  /** ExecPlan path for progress tracking */
  execPlanPath?: string;
  
  /** Relevant files for context */
  relevantFiles?: string[];
  
  /** Output schema (Zod schema for structured output) */
  outputSchema?: z.ZodType<unknown>;
}

/**
 * Unified agent execution output.
 * Maps to ACP PromptResponse with ALFRED extensions.
 */
export interface AgentExecuteOutput {
  /** Result text/content */
  result: string;
  
  /** Artifacts produced (files, diffs, etc.) */
  artifacts?: Array<{
    path: string;
    kind: "add" | "delete" | "update" | "move";
    diff?: string;
  }>;
  
  /** Reasoning traces (if supported) */
  reasoning?: string[];
  
  /** Token usage */
  tokenUsage?: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
  
  /** Ralph loop iteration state */
  iterationState?: {
    iteration: number;
    completed: boolean;
    promiseDetected?: string;
  };
  
  /** ACP tool calls made during execution */
  toolCalls?: ToolCall[];
  
  /** Structured output (if outputSchema was provided) */
  structuredOutput?: unknown;
  
  /** Stop reason */
  stopReason?: "completed" | "cancelled" | "error" | "max_iterations" | "stuck";
  
  /** Error details (if stopReason is "error") */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Core agent backend interface.
 * All agents (Codex, Droid, OpenCode) must implement this interface.
 */
export interface AgentBackend {
  /** Agent profile */
  readonly profile: AgentProfile;
  
  /**
   * Initialize the agent backend.
   * Sets up workspace, session, and ACP connection (if applicable).
   */
  initialize(options: {
    workspace: Workspace;
    sessionId?: string;
    threadId?: string;
    userId: string;
    authz?: string;
  }): Promise<AgentInstance>;
  
  /**
   * Execute a prompt/request.
   * Returns execution output and streams events via writer.
   */
  execute(
    input: AgentExecuteInput,
    context: {
      instance: AgentInstance;
      writer: ToolWriter;
      signal?: AbortSignal;
    }
  ): Promise<AgentExecuteOutput>;
  
  /**
   * Handle ACP tool call updates.
   * Called when agent sends tool call updates during execution.
   */
  handleToolCallUpdate?(
    update: ToolCallUpdate,
    context: {
      instance: AgentInstance;
      writer: ToolWriter;
    }
  ): Promise<void>;
  
  /**
   * Handle ACP permission requests.
   * Called when agent requests permission for a tool call.
   */
  handlePermissionRequest?(
    request: RequestPermissionRequest,
    context: {
      instance: AgentInstance;
      writer: ToolWriter;
    }
  ): Promise<RequestPermissionOutcome>;
  
  /**
   * Shutdown the agent backend.
   * Cleans up resources, closes connections, persists state.
   */
  shutdown(instance: AgentInstance): Promise<void>;
  
  /**
   * Check if agent supports a capability.
   */
  supports(capability: keyof AgentProfile["capabilities"]): boolean;
}

/**
 * Agent pool for managing multiple agent instances.
 * Provides spawn deduplication, lifecycle management, and ACP integration.
 */
export class AgentPool {
  private instances = new Map<string, AgentInstance>();
  private inFlightSpawns = new Map<string, Promise<AgentInstance>>();
  private backends = new Map<string, AgentBackend>();
  
  /**
   * Register an agent backend.
   */
  registerBackend(backend: AgentBackend): void {
    this.backends.set(backend.profile.id, backend);
  }
  
  /**
   * Get or spawn an agent instance.
   * Deduplicates concurrent spawn requests.
   */
  async getOrSpawn(
    profileId: string,
    options: {
      workspace: Workspace;
      sessionId?: string;
      threadId?: string;
      userId: string;
      authz?: string;
    }
  ): Promise<AgentInstance> {
    const key = `${profileId}:${options.sessionId ?? "new"}`;
    
    // Check if already spawning
    const inFlight = this.inFlightSpawns.get(key);
    if (inFlight) {
      return inFlight;
    }
    
    // Check if already exists
    const existing = this.instances.get(key);
    if (existing && existing.status === "ready") {
      return existing;
    }
    
    // Spawn new instance
    const backend = this.backends.get(profileId);
    if (!backend) {
      throw new Error(`agent_backend_not_found: ${profileId}`);
    }
    
    const spawnPromise = backend.initialize(options);
    this.inFlightSpawns.set(key, spawnPromise);
    
    try {
      const instance = await spawnPromise;
      this.instances.set(key, instance);
      return instance;
    } finally {
      this.inFlightSpawns.delete(key);
    }
  }
  
  /**
   * Execute a prompt on an agent instance.
   */
  async execute(
    instanceId: string,
    input: AgentExecuteInput,
    context: {
      writer: ToolWriter;
      signal?: AbortSignal;
    }
  ): Promise<AgentExecuteOutput> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`agent_instance_not_found: ${instanceId}`);
    }
    
    const backend = this.backends.get(instance.profile.id);
    if (!backend) {
      throw new Error(`agent_backend_not_found: ${instance.profile.id}`);
    }
    
    return backend.execute(input, {
      instance,
      writer: context.writer,
      signal: context.signal,
    });
  }
  
  /**
   * Shutdown an agent instance.
   */
  async shutdown(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }
    
    const backend = this.backends.get(instance.profile.id);
    if (backend) {
      await backend.shutdown(instance);
    }
    
    this.instances.delete(instanceId);
  }
  
  /**
   * Shutdown all instances.
   */
  async shutdownAll(): Promise<void> {
    await Promise.all(
      Array.from(this.instances.keys()).map((id) => this.shutdown(id))
    );
  }
}
```

### ACP Integration Architecture

ALFRED agents integrate with ACP at multiple levels:

#### 1. Session Management

```typescript
// packages/agent/src/orchestrator/agent/acp-session.ts

import { AgentSideConnection, ClientSideConnection } from "@agentclientprotocol/sdk";
import type { SessionId, SessionMode, SessionInfo } from "@agentclientprotocol/sdk";

/**
 * ACP session manager for ALFRED agents.
 * Bridges ALFRED session management with ACP session protocol.
 */
export class AcpSessionManager {
  /**
   * Create ACP session from ALFRED agent instance.
   * Maps ALFRED session state to ACP SessionInfo.
   */
  async createAcpSession(
    instance: AgentInstance,
    mode: SessionMode
  ): Promise<SessionId> {
    // Initialize ACP connection if not already present
    if (!instance.acpConnection) {
      instance.acpConnection = new AgentSideConnection({
        capabilities: instance.profile.capabilities,
      });
    }
    
    // Create ACP session
    const response = await instance.acpConnection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: instance.profile.capabilities,
      sessionMode: mode,
    });
    
    return response.sessionId;
  }
  
  /**
   * Load existing ACP session.
   * Restores session state from ALFRED persistence.
   */
  async loadAcpSession(
    sessionId: SessionId,
    instance: AgentInstance
  ): Promise<SessionInfo | null> {
    if (!instance.acpConnection) {
      return null;
    }
    
    try {
      const response = await instance.acpConnection.loadSession({
        sessionId,
      });
      return response.session;
    } catch {
      return null;
    }
  }
}
```

#### 2. Tool Call Handling

```typescript
// packages/agent/src/orchestrator/agent/acp-tools.ts

import type { ToolCall, ToolCallUpdate, ToolKind } from "@agentclientprotocol/sdk";

/**
 * Map ALFRED tool calls to ACP ToolCall format.
 */
export function mapToAcpToolCall(
  alfredToolCall: {
    id: string;
    name: string;
    input: unknown;
    kind?: string;
  }
): ToolCall {
  return {
    toolCallId: alfredToolCall.id,
    toolName: alfredToolCall.name,
    rawInput: alfredToolCall.input,
    kind: mapToolKind(alfredToolCall.kind),
    status: "pending",
  };
}

/**
 * Map tool kind string to ACP ToolKind.
 */
function mapToolKind(kind?: string): ToolKind {
  const mapping: Record<string, ToolKind> = {
    read: "read",
    edit: "edit",
    delete: "delete",
    move: "move",
    search: "search",
    execute: "execute",
    think: "think",
    fetch: "fetch",
  };
  return mapping[kind ?? ""] ?? "other";
}

/**
 * Handle ACP tool call updates from agent.
 * Converts to ALFRED event format and streams via writer.
 */
export async function handleAcpToolCallUpdate(
  update: ToolCallUpdate,
  writer: ToolWriter
): Promise<void> {
  writer.write({
    type: "tool_call_update",
    toolCallId: update.toolCallId,
    status: update.status,
    rawOutput: update.rawOutput,
    error: update.error,
  });
}
```

#### 3. Content Type Mapping

```typescript
// packages/agent/src/orchestrator/agent/acp-content.ts

import type { ContentBlock, Diff, TextContent } from "@agentclientprotocol/sdk";

/**
 * Convert ALFRED artifacts to ACP ContentBlock format.
 */
export function artifactsToAcpContent(
  artifacts: AgentExecuteOutput["artifacts"]
): ContentBlock[] {
  if (!artifacts) {
    return [];
  }
  
  return artifacts.map((artifact) => {
    if (artifact.diff) {
      return {
        type: "diff",
        diff: {
          old: artifact.kind === "delete" ? artifact.path : undefined,
          new: artifact.kind === "add" ? artifact.path : artifact.path,
          hunks: parseDiffHunks(artifact.diff),
        },
      } as ContentBlock;
    }
    
    return {
      type: "text",
      text: `File ${artifact.kind}: ${artifact.path}`,
    } as ContentBlock;
  });
}

/**
 * Convert ALFRED reasoning traces to ACP ContentBlock format.
 */
export function reasoningToAcpContent(
  reasoning: string[]
): ContentBlock[] {
  return reasoning.map((text) => ({
    type: "text",
    text,
    role: "assistant",
  } as ContentBlock));
}
```

#### 4. Event Streaming Integration

```typescript
// packages/agent/src/orchestrator/agent/acp-events.ts

import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { ThreadEvent } from "@alfred/protocol/events";

/**
 * Convert ALFRED thread events to ACP SessionNotification format.
 */
export function threadEventToAcpNotification(
  event: ThreadEvent
): SessionNotification | null {
  switch (event.type) {
    case "thread.started":
      return {
        type: "session",
        session: {
          sessionId: event.thread_id,
          mode: { id: "code", name: "Code" },
        },
      };
    
    case "turn.completed":
      return {
        type: "session",
        session: {
          usage: {
            inputTokens: event.usage.input_tokens,
            cachedInputTokens: event.usage.cached_input_tokens,
            outputTokens: event.usage.output_tokens,
          },
        },
      };
    
    case "item.completed":
      // Map thread items to ACP content blocks
      return {
        type: "session",
        session: {
          content: [threadItemToAcpContent(event.item)],
        },
      };
    
    default:
      return null;
  }
}
```

### Implementation Requirements

All agent backends must:

1. **Implement AgentBackend Interface**: Provide `initialize()`, `execute()`, `shutdown()`, `supports()`
2. **Support ACP Session Protocol**: Handle `initialize`, `loadSession`, session modes
3. **Emit ACP-Compatible Events**: Convert internal events to ACP `SessionNotification` format
4. **Handle Tool Calls**: Support ACP `ToolCall` and `ToolCallUpdate` messages
5. **Request Permissions**: Use ACP `requestPermission` for sensitive operations
6. **Map Content Types**: Convert artifacts/reasoning to ACP `ContentBlock` format
7. **Support Workspace Isolation**: Use AgentFSWorkspace for all file operations
8. **Stream Events**: Emit events via `ToolWriter` in ACP-compatible format

### Backend-Specific Implementations

#### Codex Backend

```typescript
// packages/agent/src/orchestrator/agent/backends/codex.ts

export class CodexBackend implements AgentBackend {
  readonly profile: AgentProfile = {
    id: "codex",
    name: "Codex",
    backend: "spawned",
    purpose: "Primary coding agent with deep ALFRED integration",
    whenToUse: "General code editing, complex refactoring, multi-file changes",
    capabilities: {
      edit: true,
      terminal: true,
      reasoning: true,
      sessionPersistence: true,
      ralphLoop: true,
      structuredOutput: true,
      promptCapabilities: {
        embeddedContext: true,
        image: false,
        audio: false,
      },
      sessionCapabilities: {
        modes: [
          { id: "ask", name: "Ask" },
          { id: "code", name: "Code" },
        ],
      },
    },
  };
  
  async initialize(options: InitializeOptions): Promise<AgentInstance> {
    // Create workspace
    const workspace = await WorkspaceFactory.create(
      "agentfs",
      options.agentId,
      options.runId,
      options.repoBase
    );
    
    // Initialize Codex session
    const session = await CodexSessionManager.getOrCreate({
      sessionId: options.sessionId,
      userId: options.userId,
      workingDirectory: workspace.root,
    });
    
    return {
      profile: this.profile,
      status: "ready",
      sessionId: session.sessionId,
      threadId: session.threadId,
      workspace,
      startedAt: new Date(),
    };
  }
  
  async execute(
    input: AgentExecuteInput,
    context: ExecuteContext
  ): Promise<AgentExecuteOutput> {
    // Convert to Codex input format
    const codexInput = {
      action: "exec",
      prompt: input.prompt,
      cw: input.cw ?? context.instance.workspace.root,
      sessionId: context.instance.alfredSessionId,
      model: input.model,
      ralph: input.ralph,
    };
    
    // Execute via Codex tool
    const output = await toolCodex.execute({
      input: codexInput,
      writer: context.writer,
      signal: context.signal,
    });
    
    // Convert to unified output format
    return {
      result: output.result,
      artifacts: output.artifacts,
      reasoning: output.reasoning,
      tokenUsage: output.tokenUsage,
      iterationState: output.iterationState,
    };
  }
  
  // ... other methods
}
```

#### OpenCode Backend

```typescript
// packages/agent/src/orchestrator/agent/backends/opencode.ts

export class OpenCodeBackend implements AgentBackend {
  readonly profile: AgentProfile = {
    id: "opencode",
    name: "OpenCode",
    backend: "sdk", // Can be SDK or spawned
    purpose: "OpenCode agent via SDK or spawned server",
    whenToUse: "When OpenCode capabilities are preferred",
    capabilities: {
      edit: true,
      terminal: true,
      reasoning: false, // OpenCode may not emit reasoning traces
      sessionPersistence: true,
      ralphLoop: true,
      promptCapabilities: {
        embeddedContext: true,
        image: false,
        audio: false,
      },
    },
  };
  
  async initialize(options: InitializeOptions): Promise<AgentInstance> {
    // Create ACP connection
    const acpConnection = new AgentSideConnection({
      capabilities: this.profile.capabilities,
    });
    
    // Initialize ACP session
    const initResponse = await acpConnection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: this.profile.capabilities,
    });
    
    // Create workspace
    const workspace = await WorkspaceFactory.create(
      "agentfs",
      options.agentId,
      options.runId,
      options.repoBase
    );
    
    return {
      profile: this.profile,
      status: "ready",
      sessionId: initResponse.sessionId,
      workspace,
      acpConnection,
      startedAt: new Date(),
    };
  }
  
  async execute(
    input: AgentExecuteInput,
    context: ExecuteContext
  ): Promise<AgentExecuteOutput> {
    // Use ACP prompt method
    const response = await context.instance.acpConnection!.prompt({
      sessionId: context.instance.sessionId!,
      content: [{ type: "text", text: input.prompt }],
      capabilities: input.promptCapabilities,
    });
    
    // Convert ACP response to unified format
    return {
      result: extractTextFromContent(response.content),
      toolCalls: response.toolCalls,
      stopReason: mapAcpStopReason(response.stopReason),
    };
  }
  
  // ... other methods
}
```

### ACP Protocol Compliance

ALFRED agents comply with ACP v0.10+ by:

1. **JSON-RPC 2.0**: All messages follow JSON-RPC 2.0 specification
2. **Session Protocol**: Support `initialize`, `loadSession`, session modes
3. **Tool Calls**: Implement `ToolCall`, `ToolCallUpdate`, `ToolKind` enums
4. **Content Types**: Support `TextContent`, `Diff`, `ImageContent`, `AudioContent`
5. **Terminal Operations**: Support `createTerminal`, `terminalOutput`, `waitForExit`
6. **File System**: Support `readTextFile`, `writeTextFile` (via workspace)
7. **Permissions**: Support `requestPermission` for sensitive operations
8. **Notifications**: Emit `SessionNotification` for real-time updates

### Integration with Existing Systems

The abstraction integrates with:

- **AgentFSWorkspace**: All agents use Docker-based isolation
- **Session Management**: Unified session persistence across agents
- **Event Processing**: ACP events converted to ALFRED thread events
- **Tool Orchestration**: Unified tool call handling via ACP
- **Ralph Loop**: Works across all agents via unified interface
- **Wave Execution**: Mixed agent types in parallel waves
- **Learning System**: Unified learning context injection

## ALFRED Integration Strategy

### Phase 1: Abstract Agent Interface

Create a unified interface for all coding agents:

```typescript
// packages/agent/src/orchestrator/worker/types.ts
interface AgentProfile {
  id: string;
  name: string;
  backend: "codex" | "droid" | "opencode";
  model?: string;
  purpose: string;
  whenToUse: string;
  capabilities: {
    vision?: boolean;
    web?: boolean;
    edit?: boolean;
    terminal?: boolean;
  };
  systemPrompt?: string;
  tags?: string[];
}

interface AgentInstance {
  profile: AgentProfile;
  status: "starting" | "ready" | "busy" | "error" | "stopped";
  sessionId?: string;
  startedAt: Date;
  lastActivity?: Date;
  shutdown?: () => Promise<void>;
}

interface AgentExecuteInput {
  prompt: string;
  cw?: string;
  model?: string;
  timeout?: number;
  ralph?: RalphConfig;
}

interface AgentExecuteOutput {
  result: string;
  artifacts?: Array<{ path: string; kind: string }>;
  iterationState?: {
    iteration: number;
    completed: boolean;
    promiseDetected?: string;
  };
}
```

### Phase 2: Agent Pool

```typescript
// packages/agent/src/orchestrator/worker/pool.ts
class AgentPool {
  private agents = new Map<string, AgentInstance>();
  private inFlight = new Map<string, Promise<AgentInstance>>();
  
  async getOrSpawn(profile: AgentProfile): Promise<AgentInstance>;
  async send(agentId: string, input: AgentExecuteInput): Promise<AgentExecuteOutput>;
  async stop(agentId: string): Promise<void>;
  async stopAll(): Promise<void>;
}
```

### Phase 3: OpenCode Agent Implementation

```typescript
// packages/agent/src/orchestrator/tool/opencode/index.ts
export const toolOpenCode = {
  name: "opencode",
  description: "Run the OpenCode agent via SDK or spawned server.",
  inputSchema: openCodeInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer, signal }) => {
    // Spawn or connect to OpenCode instance
    // Send prompt and stream response
    // Handle Ralph loop if configured
  },
};
```

### Phase 4: Droid Parity

Upgrade Droid to folder structure matching Codex:
- `packages/agent/src/orchestrator/tool/droid/definition.ts`
- `packages/agent/src/orchestrator/tool/droid/exec.ts`
- `packages/agent/src/orchestrator/tool/droid/index.ts`

Add features:
- Session management
- Reasoning accumulation
- Artifact extraction
- Learning context injection

### Phase 5: Workflow Engine

Port OpenCode's workflow engine:

```typescript
// packages/agent/src/orchestrator/workflow/engine.ts
interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

async function runWorkflow(
  workflow: WorkflowDefinition,
  task: string,
  pool: AgentPool
): Promise<WorkflowResult>;
```

## Unified Workspace Patterns for OpenCode Integration

### Workspace Isolation Strategy

**Current State:**
- Codex: AgentFSWorkspace (Docker + SQLite audit)
- Droid: Secure directory handles (no Docker)
- OpenCode: Process-level only (no isolation)

**Target State:**
- All agents use AgentFSWorkspace for consistency (requires Docker)
- Docker containers provide process isolation
- SQLite audit trail for all operations
- Worktrees enable parallel execution
- **Note:** Droid currently uses secure handles (no Docker); migration to AgentFS requires Docker support

**Migration Path:**

1. **OpenCode AgentFS Integration:**
```typescript
// packages/agent/src/orchestrator/tool/opencode/exec.ts
async function executeOpenCode(input: OpenCodeInput, workspace: Workspace) {
  if (workspace.kind !== "agentfs") {
    throw new Error("opencode_requires_agentfs");
  }
  
  const agentfs = workspace as AgentFSWorkspace;
  const containerCw = agentfs.containerCw; // "/workspace"
  
  // Execute OpenCode inside Docker container
  await agentfs.exec({
    cmd: "opencode",
    args: ["exec", "--json"],
    cwd: containerCw,
  });
}
```

2. **Worktree Support for Parallel OpenCode:**
```typescript
// When multiple OpenCode agents run in parallel
// Worktrees created on host filesystem
const worktree = await worktreeManager.create(
  repoRoot,  // Host path
  runId,
  agentId,
  "HEAD"
);

// Worktree path relative to repo root (e.g., ".agent/worktrees/{runId}/{agentId}")
// Inside container, resolve relative to /workspace mount point
const containerWorktreePath = `/workspace/${path.relative(repoRoot, worktree.path)}`;
```

3. **Docker Container Sharing:**
- OpenCode agents share containers with Codex (same runId)
- Container name: `alfred-agentfs-{runId}`
- Volume mount: `${repoBase}:/workspace`
- Resource limits: 1 CPU, 1GB memory (configurable per agent)

### Hook Integration for OpenCode

**Pre-Commit Hooks:**
- Format OpenCode-generated code via Ultracite
- Stage fixed files automatically
- No blocking (formatting only)

**Pre-Push Hooks:**
- Typecheck OpenCode changes
- Run unit tests for modified packages
- Block push on failures

**CI/CD Integration:**
- OpenCode agents trigger same CI pipeline
- Turbo caching applies to OpenCode outputs
- Linear issue tracking for OpenCode tasks

### Branching Strategy for OpenCode

**Agent Branches:**
- Pattern: `agent/{runId}/{opencode-{agentId}}`
- Base ref: `HEAD` (configurable)
- Metadata: `.alfred-worktree.json`

**Merge Strategy:**
- Use `worktreeManager.safeMerge()` for conflict detection
- Arbiter agent resolves conflicts (if needed)
- Fast-forward merge when possible

**Cleanup:**
- Per-run cleanup removes all OpenCode worktrees
- Preview worktrees cleaned up via backlog
- Branches deleted after successful merge

## Feature Comparison Matrix

| Feature | OpenCode Orchestrator | ALFRED Codex | ALFRED Droid | Target (Unified) |
|---------|----------------------|--------------|--------------|------------------|
| **Lifecycle Management** |
| Worker Pool | ✅ In-memory + device registry | ❌ Per-execution | ❌ Per-execution | ✅ Unified AgentPool |
| Spawn Deduplication | ✅ Promise tracking | ❌ | ❌ | ✅ Promise tracking |
| Status Events | ✅ Event-based | ✅ Writer-based | ✅ Writer-based | ✅ Unified events |
| **Session Management** |
| Session Persistence | ✅ SDK sessions | ✅ DB + LRU cache | ❌ | ✅ Unified session manager |
| Thread Continuity | ✅ SDK threads | ✅ Filesystem validation | ❌ | ✅ Per-agent validation |
| Resume Logic | ✅ SDK resume | ✅ Eligibility assessment | ❌ | ✅ Unified assessment |
| **Execution Model** |
| Backend Types | ✅ agent/server | ✅ spawned (Rust) | ✅ spawned (CLI) | ✅ Abstract backend |
| Workspace Isolation | ❌ Process-level | ✅ Docker (AgentFS) | ✅ Secure handles | ✅ AgentFS for all |
| Docker Integration | ❌ | ✅ Full lifecycle | ❌ | ✅ Unified Docker tool |
| Worktree Isolation | ❌ | ✅ Per-agent worktrees | ❌ | ✅ Unified worktree manager |
| SQLite Audit Trail | ❌ | ✅ AgentFS database | ❌ | ✅ Unified audit |
| Checkpoint/Restore | ❌ | ✅ SQLite snapshots | ❌ | ✅ Unified checkpoint |
| Git Hooks | ❌ | ✅ Lefthook + CI/CD | ❌ | ✅ Unified hooks |
| Conflict Resolution | ❌ | ✅ Safe merge + Arbiter | ❌ | ✅ Unified conflict handling |
| **Orchestration** |
| Wave Planning | ❌ | ✅ Dependency graph | ✅ Dependency graph | ✅ Unified wave planner |
| Workflow Engine | ✅ Sequential steps | ❌ | ❌ | ✅ Port workflow engine |
| Conflict Detection | ❌ | ✅ Marker scanning | ❌ | ✅ Unified conflict scan |
| Review/Fix Loop | ❌ | ✅ Automated review | ❌ | ✅ Unified review |
| **Observability** |
| Event Processing | ✅ SDK events | ✅ NDJSON parsing | ❌ Basic streaming | ✅ Unified event types |
| Reasoning Traces | ❌ | ✅ Accumulation | ❌ Basic extraction | ✅ Unified reasoning |
| Metrics | ✅ Telemetry (PostHog) | ✅ Prometheus | ✅ Basic metrics | ✅ Unified metrics |
| Stuck Detection | ❌ Timeout only | ✅ Multi-layer cognitive | ❌ | ✅ Unified detection |
| **Learning** |
| Context Injection | ❌ | ✅ Learning/heuristic | ❌ | ✅ Unified learning |
| Execution Persistence | ❌ | ✅ DB persistence | ❌ | ✅ Unified persistence |
| **Integration** |
| Linear Integration | ❌ | ✅ Deep integration | ❌ | ✅ Unified Linear |
| ExecPlan Support | ❌ | ✅ Full integration | ❌ | ✅ Unified ExecPlan |
| Ralph Loop | ❌ | ✅ Supported | ✅ Supported | ✅ All agents |
| **Configuration** |
| Profile System | ✅ Declarative profiles | ❌ Inline config | ❌ Inline config | ✅ Unified profiles |
| Capability Flags | ✅ vision/web/tools | ❌ | ❌ | ✅ Unified capabilities |
| Prompt Customization | ✅ Prompt files | ✅ Learning injection | ❌ | ✅ Unified prompts |

## Migration Strategy

### Phase 1: Abstract Agent Interface (Foundation)

**Goal:** Create unified types and interfaces without breaking existing code.

**Steps:**
1. Create `packages/agent/src/orchestrator/worker/types.ts`:
   - `AgentProfile` interface
   - `AgentInstance` interface
   - `AgentExecuteInput` / `AgentExecuteOutput` interfaces
   - `AgentBackend` type union

2. Create `packages/agent/src/orchestrator/worker/backend.ts`:
   - Abstract `AgentBackend` interface
   - `CodexBackend`, `DroidBackend`, `OpenCodeBackend` implementations
   - Backend factory function

3. **No breaking changes:** Existing `toolCodex` and `toolDroid` remain unchanged

### Phase 2: Agent Pool (Lifecycle Management)

**Goal:** Centralize agent lifecycle management.

**Steps:**
1. Create `packages/agent/src/orchestrator/worker/pool.ts`:
   - `AgentPool` class with spawn deduplication
   - Status event emitters
   - Session ownership tracking

2. Integrate with existing systems:
   - Use AgentFSWorkspace for isolation
   - Reuse CodexSessionManager for sessions
   - Hook into existing metrics

3. **Gradual migration:** Start with new agents, migrate existing later

### Phase 3: OpenCode Agent Implementation

**Goal:** Add OpenCode as first-class agent.

**Steps:**
1. Create `packages/agent/src/orchestrator/tool/opencode/`:
   - `definition.ts`: Input/output schemas
   - `exec.ts`: Execution logic (SDK + spawned)
   - `index.ts`: Tool export

2. Implement backend:
   - SDK client mode (in-process)
   - Spawned server mode (`opencode serve`)
   - Session management integration
   - Ralph loop support

3. Register tool:
   - Add to `packages/agent/src/v6.ts`
   - Enable in orchestrator toolset

### Phase 4: Droid Upgrade

**Goal:** Bring Droid to Codex feature parity.

**Steps:**
1. Refactor to folder structure:
   - `packages/agent/src/orchestrator/tool/droid/definition.ts`
   - `packages/agent/src/orchestrator/tool/droid/exec.ts`
   - `packages/agent/src/orchestrator/tool/droid/index.ts`

2. Add missing features:
   - Session management (`droid-session.ts`)
   - Reasoning accumulation
   - Artifact extraction
   - Learning context injection
   - Event processing pipeline

3. **Backward compatible:** Maintain existing API during migration

### Phase 5: Unified Wave Execution

**Goal:** Enable mixed agent types in waves.

**Steps:**
1. Update `runAgent()`:
   - Route to backend based on `spec.agentType`
   - Support Codex/Droid/OpenCode dispatch
   - Unified outcome format

2. Update wave planning:
   - Agent type assignment from profiles
   - Capability-based routing
   - Mixed agent wave support

3. **Testing:** Verify parallel execution with mixed agents

### Phase 6: Workflow Engine Port

**Goal:** Add sequential workflow orchestration.

**Steps:**
1. Port workflow engine:
   - `packages/agent/src/orchestrator/workflow/engine.ts`
   - Step execution with carry-forward
   - Handoff section parsing

2. Integrate with pipeline:
   - Workflow as pipeline stage
   - Mixed wave + workflow execution
   - Unified event streaming

3. **Optional:** Can be deferred if waves are sufficient

## File Structure Comparison

| OpenCode | ALFRED (Current) | ALFRED (Proposed) |
|----------|------------------|-------------------|
| `workers/spawner.ts` | N/A | `worker/spawner.ts` |
| `workers/backends/agent.ts` | N/A | `worker/backends/agent.ts` |
| `workers/backends/server.ts` | N/A | `worker/backends/server.ts` |
| `core/worker-pool.ts` | N/A | `worker/pool.ts` |
| `core/jobs.ts` | `loops/ralph.ts` | `worker/jobs.ts` |
| `workflows/engine.ts` | N/A | `workflow/engine.ts` |
| `types/index.ts` | `tool/shared/context.ts` | `worker/types.ts` |
| N/A | `tool/codex/` | `tool/codex/` |
| N/A | `tool/droid.ts` | `tool/droid/` |
| N/A | N/A | `tool/opencode/` |

## Key Files to Study/Port

1. **Worker Pool**: `orchestra/packages/orchestrator/src/core/worker-pool.ts`
   - In-memory registry, spawn deduplication, status events

2. **Backend Resolution**: `orchestra/packages/orchestrator/src/workers/spawner.ts`
   - Agent vs server backend dispatch

3. **Workflow Engine**: `orchestra/packages/orchestrator/src/workflows/engine.ts`
   - Multi-step orchestration, carry-forward context

4. **Job Registry**: `orchestra/packages/orchestrator/src/core/jobs.ts`
   - Async job tracking with wait/await

5. **Bootstrap Prompts**: `orchestra/packages/orchestrator/src/workers/prompt/worker-prompt.ts`
   - Agent identity injection

## Implementation Priority

1. **High**: Abstract agent interface (`AgentProfile`, `AgentInstance`, `AgentPool`)
2. **High**: OpenCode agent implementation (first-class like Codex)
3. **Medium**: Droid folder structure upgrade
4. **Medium**: Workflow engine port
5. **Low**: Device registry for cross-session reuse

## Workspace Isolation Implementation Considerations

### Docker Container Management

**Container Lifecycle:**
- Containers shared across agents in same runId
- Race condition handling: Retry inspect after create failures
- Cleanup: Remove containers unless `retainContainer=true`
- Resource limits: Configurable per agent (default: 1 CPU, 1GB)

**Volume Mounts:**
- Pattern: `${repoBase}:/workspace`
- All agent commands execute with `cwd=/workspace`
- Worktree paths resolved relative to `/workspace`
- AgentFS database persisted on host (`.agentfs/{runId}/{agentId}.db`)

**Security:**
- Directory sandboxing via `openDirectorySecure()`
- Policy enforcement: `deploy.write` scope required
- Resource limits prevent DoS attacks
- Process isolation via Docker seccomp

### Worktree Management

**Creation:**
- Branch naming: `agent/{sanitizedRunId}/{sanitizedAgentId}`
- Path structure: `.agent/worktrees/{runId}/{agentId}`
- Metadata file: `.alfred-worktree.json`
- Base ref: Defaults to `HEAD`, configurable

**Cleanup:**
- Per-run cleanup removes all worktrees for runId
- Preview worktrees use deferred cleanup backlog
- Retry logic: 3 attempts with exponential backoff
- Prune stale references: `git worktree prune --expire=now`

**Conflict Detection:**
- Safe merge preview: Detached worktree + `git merge --no-commit`
- Conflict file collection: `git diff --diff-filter=U`
- Arbiter agent spawns for resolution
- Resolution worktree: Temporary branch for fixes

### AgentFS Integration

**Database Management:**
- Path: `.agentfs/{runId}/{agentId}.db`
- SQLite with WAL mode
- Checkpoint snapshots: `VACUUM INTO` or logical copy
- Metrics: Size tracking, execution counts, checkpoint counts

**Audit Trail:**
- Structured tool call history
- Queryable via AgentFS SDK
- Learning system integration
- Replay/debug capabilities

**Checkpoint/Restore:**
- Atomic snapshots via SQLite `VACUUM INTO`
- Fallback: Logical snapshot (copy all tables)
- Snapshot path: `{dbPath}.checkpoint-{label}`
- Restore: Open snapshot database

### Git Hooks Integration

**Pre-Commit:**
- Format staged files via Ultracite
- Auto-stage fixed files (`stage_fixed: true`)
- Non-blocking (formatting only)

**Pre-Push:**
- Typecheck: Blocks push on errors
- Lint: Warns but doesn't block
- Tests: Blocks push on failures
- Parallel execution for speed

**CI/CD:**
- Turbo filtering: `[origin/main...HEAD]`
- Test scope: `ALFRED_TEST_SCOPE=unit`
- Timeout protection: Multiple watchdog layers
- Bail early: Stop after N failures

### Risks and Mitigations

**Container Leaks:**
- Risk: Containers not cleaned up on crash
- Mitigation: `afterEach` cleanup in tests, `retainContainer` flag for debugging
- Monitoring: Container count metrics

**Worktree Accumulation:**
- Risk: Orphaned worktrees consume disk space
- Mitigation: Preview cleanup backlog, per-run cleanup, prune stale references
- Monitoring: Worktree count metrics

**SQLite Database Growth:**
- Risk: Audit databases grow unbounded
- Mitigation: Checkpoint snapshots, periodic cleanup, size limits
- Monitoring: `agentfsDbSizeBytes` metric

**Race Conditions:**
- Risk: Multiple agents create containers simultaneously
- Mitigation: Retry inspect after create failures, shared container names
- Monitoring: Race condition detection logs

**Conflict Resolution Failures:**
- Risk: Arbiter agent fails to resolve conflicts
- Mitigation: Escalation to human, fallback to manual merge
- Monitoring: Conflict resolution success rate

## Dependencies & Prerequisites

### OpenCode SDK

**Required:**
- `@opencode-ai/sdk` package (dynamic import recommended)
- `opencode` CLI binary (for spawned mode)

**Installation:**
- SDK: `bun add @opencode-ai/sdk` (optional dependency)
- CLI: User-installed or bundled

**Fallback Strategy:**
- Graceful degradation if SDK unavailable
- Tool returns error with installation instructions
- No breaking changes to existing agents

### AgentFS Integration

**Current State:**
- AgentFSWorkspace already supports Docker containers
- Codex runs inside containers via `containerName` / `containerCw`
- OpenCode can reuse same pattern

**Requirements:**
- Docker runtime (already required for Codex)
- Container image with OpenCode CLI
- Or: SDK mode doesn't require container

### Session Database

**Current State:**
- Codex sessions stored in `@alfred/db/repo/codex-session`
- Schema supports threadId, workingDirectory, projectId
- OpenCode sessions can reuse same schema

**Schema Extension:**
- Add `agentType` field to distinguish Codex/OpenCode
- Or: Separate table for OpenCode sessions
- Or: Reuse with agent type in sessionId prefix

## Detailed Implementation Considerations

### 1. Backend Resolution Strategy

**OpenCode Backend Selection:**
```typescript
function resolveOpenCodeBackend(profile: AgentProfile): "sdk" | "spawned" {
  // Prefer SDK for in-process execution (faster, shared context)
  // Use spawned for isolation or when SDK unavailable
  if (profile.backend === "sdk" && hasOpencodeSDK()) return "sdk";
  return "spawned";
}
```

**Codex/Droid:**
- Always spawned (no SDK option)
- Codex: Rust binary execution
- Droid: CLI execution

### 2. Session Management Unification

**Unified Session Manager:**
```typescript
class UnifiedSessionManager {
  async getSession(agentType: "codex" | "droid" | "opencode", sessionId: string, userId: string): Promise<SessionState>;
  async createSession(agentType: string, sessionId: string, ...): Promise<SessionState>;
  async updateSession(agentType: string, sessionId: string, patch: Partial<SessionState>): Promise<SessionState>;
}
```

**Agent-Specific Logic:**
- Codex: Thread ID validation (filesystem)
- OpenCode: SDK session validation
- Droid: No session (stateless)

### 3. Event Type Unification

**Unified Event Types:**
```typescript
type UnifiedAgentEvent =
  | { type: "thought"; agentId: string; text: string; ts: number }
  | { type: "command"; agentId: string; command: string; status: string; ts: number }
  | { type: "artifact"; agentId: string; path: string; kind: string; ts: number }
  | { type: "output"; agentId: string; chunk: string; ts: number }
  | { type: "turn_completed"; agentId: string; usage?: TokenUsage; ts: number }
```

**Event Adapters:**
- Codex: NDJSON parser → Unified events
- OpenCode: SDK events → Unified events
- Droid: stdout/stderr → Unified events

### 4. Workspace Integration

**AgentFS for OpenCode:**
- Reuse existing `AgentFSWorkspace` class
- OpenCode SDK client runs inside container
- Or: SDK mode uses host filesystem (less isolation)

**Container Configuration:**
- OpenCode container image: `alfred-agentfs:opencode`
- Or: Reuse Codex image, install OpenCode CLI
- Container sharing: Per-runId containers (same as Codex: `alfred-agentfs-{runId}`)

### 5. Ralph Loop Enhancement

**Current Implementation:**
- Supports Codex and Droid executors
- Promise detection via `<promise>` tags
- Loop detection via `LoopDetector`

**OpenCode Integration:**
- Add OpenCode executor to `runRalphLoop()`
- OpenCode workers can output `<promise>` tags
- Unified loop detection across all agents

### 6. Wave Planning Enhancement

**Agent Type Assignment:**
```typescript
// Current: agentType from spec
// Enhanced: agentType from profile
function assignAgentTypeFromProfile(
  subTask: SubTask,
  profiles: Map<string, AgentProfile>
): string {
  // Match subTask to profile by capability/purpose
  // Return profile.id or default to "codex"
}
```

**Capability-Based Routing:**
- Vision tasks → agents with `capabilities.vision`
- Web tasks → agents with `capabilities.web`
- Code tasks → Codex/OpenCode
- Secure tasks → Droid

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OpenCode SDK dependency** | High | Dynamic import, graceful fallback, optional dependency |
| **Different execution models** | Medium | Abstract via backend interface, adapter pattern |
| **Breaking existing Codex/Droid** | High | Incremental migration, maintain API compatibility, feature flags |
| **Session management complexity** | Medium | Reuse ALFRED's session system, extend gradually |
| **Workspace isolation differences** | Low | AgentFS already supports containers, OpenCode can reuse |
| **Event format differences** | Medium | Unified event adapter layer, normalize at boundary |
| **Performance overhead** | Low | SDK mode is fast, spawned mode matches Codex |
| **Container resource usage** | Low | Reuse containers per project, same as Codex |
| **Learning context mismatch** | Low | Extend learning system to support OpenCode events |
| **Workflow engine complexity** | Medium | Port incrementally, test with simple workflows first |

## Churn Management & Package Integration

To minimize regression risks and ensure smooth integration across the monorepo:

### 1. Regression Prevention
- **Interface Compliance Tests**: Create `verify-agent-interface.test.ts` to ensure `CodexBackend` and `OpenCodeBackend` strictly adhere to `AgentBackend`.
- **Shadow Mode**: Implement a flag `AGENT_SHADOW_MODE=1` to run the new `AgentPool` logic alongside legacy direct calls in non-production environments to compare outcomes.
- **Mocking Strategy**: Update `@alfred/test-kit` to provide a `MockAgentBackend` factory, allowing downstream packages (api, runtime) to test orchestration without spawning real processes.

### 2. Extensibility Pattern
- **Capability Plugins**: Use the `_meta` field in `AgentCapabilities` for experimental or agent-specific features (e.g., `_alfred_vision_v2`).
- **Dynamic Profiles**: Allow `AgentProfile` to be loaded from `agent.json` files at runtime, enabling new agent types without code changes.

### 3. Cross-Package Integration Checklist

**`packages/api` (tRPC Routers):**
- [ ] Update `workflowRouter` to accept `agentType` and pass it to `orchestrateWorkflowStream`.
- [ ] Expose `agent.listProfiles` procedure for UI to discover available agents.

**`packages/cognitive` (Brainstem):**
- [ ] Update `LoopDetector` to handle unified `AgentEvent` types.
- [ ] Extend `Brainstem` supervisor to monitor `AgentInstance` status from `AgentPool`.

**`packages/db` (Persistence):**
- [ ] Add `agent_type` column to `sessions` and `workflow_runs` tables.
- [ ] Ensure `AgentFS` metrics (`agentfs_db_size_bytes`) are tagged with `agent_type`.

**`packages/runtime` (Execution):**
- [ ] Refactor `runAgent` to use `AgentPool.execute` instead of direct `toolCodex.execute`.
- [ ] Update `EventProcessor` to handle ACP-style events from all backends.

## Success Criteria

### Phase 1: Foundation
- [ ] `AgentProfile` and `AgentInstance` types defined
- [ ] `AgentBackend` interface abstracted
- [ ] `AgentPool` class implemented with spawn deduplication
- [ ] `verify-agent-interface.test.ts` implemented
- [ ] Existing Codex/Droid continue working unchanged (verified via regression tests)

### Phase 2: OpenCode Integration
- [ ] `toolOpenCode` registered and callable via tRPC
- [ ] OpenCode SDK mode working (in-process)
- [ ] OpenCode spawned mode working (`opencode serve`)
- [ ] Session management integrated
- [ ] Ralph loop supports OpenCode executor

### Phase 3: Droid Parity
- [ ] Droid refactored to folder structure
- [ ] Session management added to Droid
- [ ] Reasoning accumulation integrated
- [ ] Artifact extraction working
- [ ] Learning context injection added

### Phase 4: Unified Execution
- [ ] `runAgent()` routes to correct backend
- [ ] Mixed agent waves execute successfully
- [ ] Unified event streaming works
- [ ] All agents support Ralph loop

### Phase 5: Workflow Engine (Optional)
- [ ] Workflow engine ported from OpenCode
- [ ] Sequential workflows execute
- [ ] Handoff context carries between steps
- [ ] Mixed wave + workflow execution

## Testing Strategy

### Unit Tests
- AgentPool spawn deduplication
- Backend resolution logic
- Session manager extensions
- Event adapter transformations

### Integration Tests
- OpenCode SDK mode execution
- OpenCode spawned mode execution
- Ralph loop with OpenCode
- Mixed agent wave execution

### E2E Tests
- Full workflow with Codex/Droid/OpenCode
- Session persistence across agents
- Conflict detection with mixed agents
- Review phase with fixer agents

## Next Steps

1. **Review & Approval:** Get stakeholder approval for integration strategy
2. **Design Review:** Deep dive on abstract agent interface design
3. **Prototype:** Build minimal OpenCode agent tool (SDK mode only)
4. **Iterate:** Test prototype, gather feedback, refine approach
5. **Implement:** Full implementation following phased approach

## References

### Agent Client Protocol (ACP)
- **Protocol Specification**: [agentclientprotocol.com](https://agentclientprotocol.com/)
- **Schema Definition**: [schema.json](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/schema/schema.json)
- **TypeScript SDK**: `@agentclientprotocol/sdk` (v0.12.0+)
- **Protocol Version**: v0.10+ (JSON-RPC 2.0 over stdio)
- **ALFRED Integration**: `packages/protocol/src/acp.ts`

### OpenCode Orchestrator
- Worker Pool: `/Users/jackmazac/Development/orchestra/packages/orchestrator/src/core/worker-pool.ts`
- Backend Resolution: `/Users/jackmazac/Development/orchestra/packages/orchestrator/src/workers/spawner.ts`
- Workflow Engine: `/Users/jackmazac/Development/orchestra/packages/orchestrator/src/workflows/engine.ts`
- Job Registry: `/Users/jackmazac/Development/orchestra/packages/orchestrator/src/core/jobs.ts`

### ALFRED Orchestration
- Wave Execution: `packages/runtime/src/orchestrator/waves.ts`
- Agent Execution: `packages/runtime/src/orchestrator/agent.ts`
- Pipeline State: `packages/agent/src/orchestrator/multi/pipeline.ts`
- Tracker: `packages/agent/src/orchestrator/multi/tracker.ts`

### ALFRED Agent Tools
- Codex Tool: `packages/agent/src/orchestrator/tool/codex/`
- Droid Tool: `packages/agent/src/orchestrator/tool/droid.ts`
- Ralph Loop: `packages/agent/src/orchestrator/loops/ralph.ts`

### ALFRED Infrastructure
- Session Management: `packages/agent/src/orchestrator/codex-session.ts`
- Workspace: `packages/agent/src/environment/agentfs.ts`
- Conflict Detection: `packages/agent/src/orchestrator/multi/conflict.ts`
- Review System: `packages/agent/src/orchestrator/multi/review.ts`
- Protocol Package: `packages/protocol/` (ACP integration, thread events, items)

</details>
