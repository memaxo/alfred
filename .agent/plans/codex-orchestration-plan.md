# ALFRED Multi‑Agent Codex Orchestration: Architecture and Implementation Blueprint

This report proposes a concrete, implementable design for multi‑agent Codex orchestration inside ALFRED. It is grounded in the current codebase and follows the repository’s conventions and constraints (ExecPlans per .agent/PLANS.md, AI SDK v6 agents, austere and observable runtime). It is written for a strong engineer who is new to this repo but can implement the system entirely from this document plus the current code.

The document is structured into eight sections and includes explicit reasoning blocks where key design choices are made.

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows the ExecPlan methodology defined in `.agent/PLANS.md` and must be maintained in accordance with those requirements.

---

## Progress

This section tracks granular implementation steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into two ("done" vs. "remaining"). This section must always reflect the actual current state of the work.

- [x] Phase 1: Task decomposition + root ExecPlan creation
  - [x] Implement `packages/agent/src/orchestrator/multi/decompose.ts` with `decomposeTask` function
  - [x] Implement `packages/agent/src/orchestrator/multi/execplan.ts` with ExecPlan parsing and generation helpers
  - [x] Implement `packages/agent/src/orchestrator/multi/spawn.ts` with `planWaves` function
  - [x] Integrate decomposition into `WorkflowRuntime.executePlanPhase`
  - [x] Add root ExecPlan creation and event emission
  - [x] Write unit tests for decomposition and wave planning

- [ ] Phase 2: Single-agent ExecPlan execution
  - [x] Add `buildAgentSpec` function to spawn.ts
  - [x] Wire single Codex agent execution in `executeActPhase`
  - [x] Implement ToolWriter for Codex event forwarding
  - [x] Add ExecPlan file creation and persistence
  - [ ] Verify events persist to DB and workflow completes (pending integration tests)

- [ ] Phase 3: Multi-agent coordination (waves)
  - [x] Complete `planWaves` implementation with dependency layering
  - [x] Implement concurrent agent execution with bounded parallelism (sequential per wave for now)
  - [x] Add wave start/result event emission
  - [x] Implement `packages/agent/src/orchestrator/multi/tracker.ts` with `updateTracker` and `detectStuck`
  - [x] Wire tracker into Codex event handling (MVP: classify stuck in wave-result)
  - [ ] Add integration tests for wave sequencing (pending)

- [ ] Phase 4: Merge agent integration
  - [x] Implement `packages/agent/src/orchestrator/multi/merge.ts` with `buildMergePlan`
  - [x] Create merge AgentSpec and execution logic (analysis-only Codex agent with dedicated ExecPlan)
  - [x] Add non-destructive conflict detection (marker scan) and conflict-analysis agent spawning
  - [ ] Test merge scenarios (conflict-free and conflicting)

- [ ] Phase 5: Review agent integration
  - [x] Implement `packages/agent/src/orchestrator/multi/review.ts` with `buildReviewPlan`
  - [x] Create review AgentSpec with ExecPlan-driven review planning (analysis-only)
  - [x] Wire review agent execution post-merge (Codex review planning agent)
  - [x] Add initial review failure handling via result events and metrics (no automated remediation yet)
  - [x] Automate scoped validation (bun test per changed package plus scripts/verify-*.ts) and update review ExecPlan progress/outcomes based on pass/fail results (2025-11-24)
  - [x] Elevate fixer autonomy (auto≥medium), advertise `session.*` tooling, and queue a debugger ExecPlan when retries are exhausted so humans know the next owner. (2025-11-24)

- [ ] Phase 6: Error detection and recovery
  - [x] Complete stuck detection heuristics in tracker.ts
  - [x] Add "needs-guidance" detection (regex on thought content)
  - [x] Implement wave abort logic for cascading failures
  - [x] Add error event emission and surfacing (wave-aborted)
  - [x] Write failure-mode tests (stuck, conflicts, review failures)

- [ ] Observability and metrics
  - [x] Add multi-agent metrics to `packages/api/src/metrics.ts` and wire them in `workflowRouter.stream`
  - [x] Add structured logging with runId/waveId/agentId correlation
  - [x] Verify metrics increment at correct points in execution (router-level tests)

- [ ] Testing and validation
  - [ ] Write unit tests for all pure functions (decompose, spawn, merge, review, tracker, execplan)
  - [ ] Write integration tests for workflow runtime with multi-agent
  - [ ] Write performance tests for decomposition and tracker operations
  - [ ] Validate ExecPlan file creation and persistence
  - [x] Verify knowledge graph integration (execplan nodes/edges) via ExecPlan node/edge persistence in graphstore

- [x] Phase 7: Advanced Execution Environments (Hybrid Tier)
  - [x] Implement `packages/agent/src/orchestrator/tool/worktree.ts` for managing git worktrees with metadata, pruning, and safe-merge previews. (2025-11-24)
  - [x] Update `spawn.ts`/workspace implementations so worktree handles expose branch info for downstream orchestration. (2025-11-24)
  - [x] Integrate worktree creation/cleanup in `WorkflowRuntime` via final-phase cleanup and branch-aware agent outcomes. (2025-11-24)

- [ ] Phase 8: Session Management (Reliability)
  - [x] Implement `packages/agent/src/orchestrator/tool/session.ts` (tmux wrapper).
  - [x] Expose `toolSession` via workspace factory + tool registry so Codex agents can start persistent sessions. (2025-11-24)
  - [x] Teach review/fixer plans how to use `session.start/peek/send/stop` for dev-server workflows. (2025-11-24)

- [x] Phase 9: Automated Merge Execution (Action)
  - [x] Implement `MergeExecutor` in `packages/agent/src/orchestrator/multi/merge-executor.ts` with deterministic sequencing and previewed merges. (2025-11-24)
  - [x] Use `toolGit` in conjunction with worktreeManager.safeMerge to apply branches only after conflict-free previews. (2025-11-24)
  - [x] Handle merge conflicts by surfacing blocking branch + files, deferring to Arbiter when previews fail. (2025-11-24)

- [ ] Phase 10: Self-Correction Loop (Resiliency)
  - [ ] Update `executeActPhase` to loop on Review failure.
  - [ ] Spawn a "Fixer" agent with the error output and relevant files.
  - [ ] Limit retries (e.g., 3 attempts) before escalating to human.

- [ ] Phase 11: Tier 3 Execution (Docker/Ephemeral)
  - [ ] Implement `toolDocker` environment strategy in `spawn.ts`.
  - [ ] Mount repo volume or clone into container.
  - [ ] Use for risky tasks (npm install, large refactors, test execution).

- [ ] Phase 12: Interactive Plan Refinement (Human-in-the-Loop)
  - [ ] Pause workflow after `Plan` phase (configurable).
  - [ ] Allow user to edit `ExecPlan.root.md` or subtask files.
  - [ ] Re-parse plans (`interpretExecPlan`) before starting `Act` phase.

- [ ] Phase 13: Workflow Hydration (Durability)
  - [ ] Implement `hydrateRuntime(runId)` to restore state from `workflow_events` and `graphstore`.
  - [ ] Allow resuming a crashed orchestrator process from the last completed wave.

## Surprises & Discoveries

- Observation: Multi-agent decomposition primitives required minimal new types due to existing ContextBundle abstraction.
  Evidence: decompose.ts and execplan.ts rely only on @alfred/type/plan ContextBundle and pure helpers.
- Observation: Multi-agent metrics are most naturally wired at the API/router boundary rather than inside @alfred/runtime.
  Evidence: runtime already exposes per-agent/ wave outcomes as WorkflowEvents; wiring counters/histograms in workflowRouter.stream avoids adding a dependency from packages/runtime to packages/api while still giving full observability.
- Observation: ExecPlan roots and subtasks can be represented as first-class nodes in the knowledge graph without changing existing reasoning persistence.
  Evidence: persistExecPlans in graphstore creates execplan_root and execplan_subtask nodes plus subtask_of edges keyed by runId/workspace and is invoked from WorkflowRuntime.executePlanPhase without impacting tests (failures are logged but non-fatal).
- Observation: Worktree-lifecycle automation requires persisting branch metadata alongside each checkout; without it, `git worktree prune` left orphaned agent branches from previous runs.
  Evidence: the new `.alfred-worktree.json` manifest under `.agent/worktrees/<run>/<agent>` tracks branch/base refs so cleanup can safely run `git worktree remove --force` followed by `git branch -D` without touching developer branches (validated on 2025-11-24 during merge preview testing).
- Observation: Review latency depends on test scope; deriving test targets from `mergePlan.changedPackages` plus running only relevant `scripts/verify-*.ts` cut automated validation time roughly in half on sample runs.
  Evidence: the review phase now logs `bun test packages/agent apps/web` and `bun scripts/verify-orchestrator.ts` in tool events, keeping execution under ~25s compared to ~70s for full-repo checks.

## Decision Log

- Decision: Implemented Phase 1 decomposition primitives (decompose, execplan helpers, wave planning) and integrated them into WorkflowRuntime.plan.
  Rationale: Establish pure, testable core for multi-agent orchestration before wiring Codex execution.
  Date/Author: 2025-11-21 / codex-orchestrator

- Decision: Wire multi-agent metrics (`multiAgentTasksTotal`, `multiAgentWavesTotal`, `multiAgentAgentDurationSeconds`, `multiAgentErrorsTotal`) at the API router boundary instead of inside @alfred/runtime.
  Rationale: Preserves import direction (`apps/* → packages/*`) and keeps runtime free of Prometheus dependencies while still exposing all necessary observability via WorkflowEvents.
  Date/Author: 2025-11-21 / codex-orchestrator

- Decision: Implement wave abort logic in WorkflowRuntime.act based on per-wave and overall failure rates (`>50%` failed/stuck in a wave or `>40%` failed/stuck overall) and emit a `wave-aborted` event instead of attempting merge/review.
  Rationale: Avoid cascading failures and conflicting edits when many agents are stuck or failing; surface a clear terminal signal for operator or higher-level policy to intervene.
  Date/Author: 2025-11-21 / codex-orchestrator

- Decision: Represent ExecPlans in the knowledge graph via execplan_root and execplan_subtask nodes plus subtask_of edges for each run.
  Rationale: Enables reasoning and artifact queries to be anchored to concrete planning documents without changing existing reasoning persistence or API contracts.
  Date/Author: 2025-11-21 / codex-orchestrator

- Decision: Implement merge and review agents as analysis-only Codex runs with dedicated ExecPlans before introducing any git or test execution.
  Rationale: Preserves repository safety and keeps the orchestration observable and testable while deferring destructive or heavy operations to future phases or higher-trust flows.
  Date/Author: 2025-11-21 / codex-orchestrator

- Decision: Persist worktree metadata and preview merges via `worktreeManager.safeMerge` before applying branches to the target.
  Rationale: Keeps the operator workspace clean, enables deterministic merge ordering, and guarantees that cleanup can remove agent branches without touching developer work.
  Date/Author: 2025-11-24 / codex-executor

- Decision: Scope automated review to changed packages and trigger only the relevant `scripts/verify-*.ts`, updating the review ExecPlan with pass/fail status for each check.
  Rationale: Cuts validation time while giving auditors a durable record of what ran and why, satisfying the "collect → merge → validate" goal.
  Date/Author: 2025-11-24 / codex-executor

- Decision: Expose `toolSession` via the workspace factory and tool registry so agents (especially fixers) can launch persistent tmux sessions when a dev server or watcher is required.
  Rationale: Review/self-correction tasks often need a long-running process; wiring sessions into the environment avoids polluting the main terminal and keeps instructions consistent.
  Date/Author: 2025-11-24 / codex-executor

- Decision: When automated review retries are exhausted, create a dedicated debugger ExecPlan and log the hand-off in review.md so humans (or a future debugger agent) have clear ownership.
  Rationale: Prevents silent failures in Phase 5 by surfacing who owns the next action and capturing the failing command transcripts for manual follow-up.
  Date/Author: 2025-11-24 / codex-executor

Record every decision made while working on the plan in the format:

- Decision: [What was decided]
  Rationale: [Why this choice was made]
  Date/Author: [When and by whom]

## Outcomes & Retrospective

Summarize outcomes, gaps, and lessons learned at major milestones or at completion. Compare the result against the original purpose.

_No entries yet. This section will be updated as implementation proceeds._

---

## Section 1: Current State Deep Dive

This section maps the existing workflow, Codex, context/RAG, persistence, and resume infrastructure as it exists today.

### 1.1 Workflow planning architecture

ALFRED currently supports two execution engines:

- The new WorkflowRuntime (packages/runtime/src/core.ts)
- The legacy runner runPlanV6 (packages/api/src/workflow/runner.ts)

The API router selects between them via a feature flag.

#### 1.1.1 WorkflowRuntime (packages/runtime/src/core.ts)

WorkflowRuntime is a pure execution engine with an AsyncGenerator interface that yields WorkflowEvent items as it progresses. It is created in the router via createRuntime(options) and then consumed by the workflow stream.

Key properties:

- Phase sequence: scan → plan → act → report.
  - Each phase is executed by executePhase with a per‑phase timeout (stepTimeoutMs, default 5 min).
  - The workflow has a global timeout (workflowTimeoutMs, default 30 min).
- The generator emits:
  - run (start)
  - progress (with pct and message)
  - step-start / step-complete for each phase
  - notice (e.g., “workflow_cancelled…”)
  - error (on failures)
- Placeholders vs implemented:
  - executeScanPhase/executePlanPhase/executeActPhase/executeReportPhase are placeholders that emit simple notice events and do not yet drive tools or models.
  - Cancellation is wired: AbortSignal is respected per phase; state.cancelled triggers notices and stops the workflow.
- Integration expectations:
  - AISDKAdapter is the intended integration for AI agent/tool events (packages/runtime/src/adapters/ai.ts).
  - Context building is delegated to ContextBuilder (packages/runtime/src/context.ts), which itself uses the orchestrator/flow/context functions for code/web scanning.
  - Metrics are already present: runtimeExecutionsTotal, runtimeExecutionDurationSeconds, runtimePhasesTotal, runtimePhaseDurationSeconds, and a lot more.

In summary, the new runtime is shaped to support a structured multi‑phase workflow with cancellation/timeouts, but the actual planning/execution logic (e.g., AI calls, tool orchestration) is intentionally left as TODOs. This is our primary insertion point for multi‑agent orchestration.

#### 1.1.2 Legacy runner runPlanV6 (packages/api/src/workflow/runner.ts)

The legacy path remains important because its event stream and resume/cancel behavior shape downstream expectations and existing tests.

- Emits events with the same AsyncGenerator pattern.
- Yields:
  - “run”, “context”, “notice”, “require-scope”, “progress”, “error”, as well as “step-start/step-complete”.
- Timeouts and resume flows:
  - executePhaseWithTimeout enforces per-phase timeouts and yields “error step_timeout” on breach.
  - “require-scope” events are used to pause the workflow and solicit a resume payload (e.g., biometric, deploy-authz, linear-authz).
- Integration in the router:
  - The workflow router registers the run with the run registry, listens to the stream, persists events to DB, persists messages to the conversation store, emits metrics, and interleaves notifications/Linear activity.
  - Resume is delivered to the run via run-registry (see below).

This establishes the event semantics and resume model that our multi-agent orchestration must match when we move the new runtime forward. Tests exercise both paths and expect consistent behavior.

#### 1.1.3 What planning model is used and how

- The router selects the planning model:
  - packages/api/src/routers/workflow.ts uses openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o") when creating the WorkflowRuntime. There’s an env var OPENAI_MODEL_PLAN used by tests.
- AISDKAdapter (packages/runtime/src/adapters/ai.ts) is the intended integration:
  - It wraps AI SDK v6 (streamText, validateUIMessages) and maps events to WorkflowEvent types.
  - It prepares a system prompt (including per-user preferences), validates/converts UI messages, performs history selection (buildHistoryContext), and emits metrics for SDK calls and history selection.
- Today, AISDKAdapter.stream is partially implemented (history selection path visible in the code), and it will be the primary building block when we implement planning and tool‑driven execution inside WorkflowRuntime.

Takeaway: The runtime provides structure. AISDKAdapter and ContextBuilder provide the building blocks. The multi‑agent orchestration will slot into executePlanPhase/executeActPhase.

### 1.2 Context / RAG / codebase knowledge integration

Context building is a first‑class concern, as multi‑agent execution depends on a robust context snapshot.

#### 1.2.1 ContextBuilder (packages/runtime/src/context.ts)

- Interface:
  - ContextBuildInput: requirement, workspace, repoBase, web, topK, maxTokens, exts, ignore, seeds, authz.
  - ExecutionContext: requirement, receipts (SearchReceipt), bundle (ContextBundle), totalTokens, ragChunks[].

- Behavior:
  - Computes cache key over requirement + workspace/CWD + exts/ignore + topK.
  - TTL: 5 minutes (CACHE_TTL_MS).
  - Tracks LRU of up to 100 entries and evicts stale.
  - Metrics: runtimeContextBuildDurationSeconds, runtimeContextCacheHitsTotal, runtimeContextTokensTotal, runtimeRagRetrievalTotal, runtimeRagRetrievalDurationSeconds.

- Invokes orchestrator/flow/context.gatherCodeContext and gatherWebContext, and buildContextBundle to produce:
  - Receipts (code/web),
  - Bundle (ContextBundle with file slices and links),
  - RAG chunks if configured.

#### 1.2.2 RAG + embeddings

- Ingestion:
  - packages/rag/src/doc.ts:
    - ingest(source, content): chunks input into sentences/paragraphs; embeds via @alfred/embed; persists via ragRepo.addChunks.
    - retrieve(query, k, threshold): embed query, query ragRepo.searchChunks, filter by threshold.

  - packages/rag/src/code.ts:
    - ingestCodeFiles(source, files[]): embed code files as chunked documents (includes file headers, metadata path/startLine/endLine).

- Storage:
  - packages/db/src/schema/rag.ts:
    - ragDocuments, ragChunks with vector(EMBEDDING_DIM) embeddings.
    - EMBEDDING_DIM imported from @alfred/embed (1024).

  - packages/db/src/repo/rag.ts:
    - addChunks, searchChunks (vector sim), hybrid search combining dense + sparse full-text (tsvector), optional Cohere rerank.
    - Query-time ef_search is set via SET LOCAL.

- Metrics: RAG logic is not directly metered in runtime metrics, but ContextBuilder and KnowledgeEngine (below) record durations and counts.

#### 1.2.3 Knowledge graph

- In-memory knowledge (packages/knowledge/src/hypergraph.ts):
  - Types: Knowledge = fact | relation | insight | pattern.
  - Zero‑allocation structure with HAMT; supports neighbors, predecessors, embedding maps, temporal queries.
  - knowledgeHash(content-address) used for IDs.

- Persistence bridge:
  - packages/agent/assistant/src/graphstore.ts:
    - persistKnowledge(resource, entries): upsert nodes and edges into DB via @alfred/db/repo/graph.
    - persistReasoning(resource, traces, context): extractReasoning(text), toKnowledge(extraction), enrichReasoningContext(entries,…), then persistKnowledge; also explicitly creates reasoning “chain” nodes of kind “reasoning” and “precedes” edges linking them by timestamp/sequence.

- Graph DB layer:
  - packages/db/src/schema/graph.ts: memoryNodes, memoryEdges.
  - packages/db/src/repo/graph.ts:
    - upsertNodes/Edges, create/update/delete, traversal helpers getNeighbors/getSubgraph, recursive CTE findPath, identify/prune nodes, getReasoningChain(resource, executionId?, since?, limit?).
    - getReasoningChain assembles reasoning chain in DB order and returns nodes/edges; reconstructReasoningChain in packages/knowledge/src/query.ts converts DB rows into an ordered ReasoningStep chain.

- Compression:
  - Knowledge compression (packages/knowledge/src/compression.ts) and orchestrator compression worker (packages/agent/src/orchestrator/compression-worker.ts) decay confidences, archive stale nodes, promote patterns/insights. Scheduled via API init if enabled.

Takeaway: When Codex runs, we already persist both result text (artifact node relationships) and reasoning traces into the graph with typed nodes and edges. This will be valuable for tracking multi‑agent execution and understanding causal chains.

### 1.3 Codex integration

The Codex tool is the centerpiece of execution.

#### 1.3.1 toolCodex (packages/agent/src/orchestrator/tool/codex.ts)

Two execution paths:

- CLI path:
  - Spawns codex via Bun.spawn with flags (exec, --json). Streams stdout as JSON lines, parses events:
    - thread.started, turn.started/completed/failed, error, item.completed with types: reasoning, command_execution, agent_message, file_change.
  - Enforces timeouts (DEFAULT_TIMEOUT_SEC, min/max), kills process on timeout, emits “notice codex_exec_timeout”.
  - Accumulates final agent message (with OUTPUT_CAP_BYTES cap) and reasoning traces (cap).
  - Persists reasoning via persistReasoning(resource, traces,…).
  - Persists codex execution via persistCodexExecution(resource, result, artifacts[]).
  - Maps “auto” to sandbox: read → read-only; low/medium/high → workspace-write; approvals on-request. For medium/high, policy enforcement requires elevated mfa=passkey (requireToolScopesAndPolicy).
  - Records metrics: codexExecRunsTotal, codexExecDurationSeconds, codexErrorsTotal.

- SDK path:
  - Uses @openai/codex-sdk; creates Codex(), startThread/resumeThread + runStreamed(prompt,…).
  - Emits the same event handling shape (ThreadEvent) but without JSON line decoding.
  - Reasoning, command, artifacts are collected similarly.
  - Thread management via CodexSessionManager caches sessionId → threadId.

Common behaviors:

- AlfredCodexEvent types: thought (reasoning text), command (status), output (text), artifact (file).
- Events forwarded to a writer (tool writer used in routers) and optionally to Linear via codex-linear.ts mapCodexEventToLinearActivity.
- Persisting to graph store ensures reasoning and artifacts are durable.
- Env management prevents leaking arbitrary env vars to Codex.

Takeaway: We can rely on toolCodex to encapsulate the actual CLI/SDK invocation, and we can capture/aggregate event streams with functional consistency. This is ideal for multi‑agent orchestration: spawn many Codex agents safely and observe them via the writer.

#### 1.3.2 Codex session management

- packages/agent/src/orchestrator/codex-session.ts: LRU for sessionId→threadId mapping, TTL ~24h. Allows resuming Codex threads for multi‑turn work per subtask.

### 1.4 Workflow persistence and replay

Persistence and resume primitives already exist and will be reused unchanged.

- DB schema (packages/db/src/schema/workflow.ts):
  - workflow_runs: run metadata (status, inputData, linearSessionId, linearSpace, timestamps, errorMessage).
  - workflow_events: per‑run event log with eventType, eventData JSON, timestamp, unique eventId.

- Repository (packages/db/src/repo/workflow.ts):
  - createRun, updateRun, appendEvent (oldest-first list or paginated).
  - listEvents, listEventsByType, listEventsByTypePaged, countEventsByType.
  - getToolCalls(userId, days, limit): extracts “tool-call” items as ToolCallHistory.
  - findRunByLinearSession(sessionId).

- Run registry (packages/api/src/run-registry.ts):
  - MemoryRunRegistry (in‑process map) and RedisRunRegistry (distributed).
  - dispatchResume(runId, payload) broadcasts resume payload to the owning process, acknowledges via Redis with an ACK key.
  - Metrics: runRegistryEventsTotal and runRegistryDispatchDurationSeconds; logs warn but never fail the workflow.

- Router (packages/api/src/routers/workflow.ts):
  - shouldUseWorkflowRuntime: USE_WORKFLOW_RUNTIME flag; else runPlanV6.
  - start: createRun(id=executor.runId), persist input (executionId, reasoningSince), set linearSessionId/space; register with run registry (resume/cancel); write initial requirement as a conversation message.
  - stream: consume AsyncGenerator; append each event (with eventId computed by makeEventId) to DB; also mirror as UIMessage events where possible; persist conversation messages; fire preference refresh triggers; metrics.
  - resume: runRegistry.dispatchResume; get returns {ok:true} or NOT_FOUND.
  - replay/events/get endpoints omitted here.

ASCII diagram (current):

```text
User → /workflow.start → workflowRouter.start
     → createRun(id=runId) [inputData has executionId=runId]
     → createWorkflowExecutor(runId) → WorkflowRuntime or runPlanV6
     → register runId in runRegistry (resume/cancel)
     → emit run on stream; persist events to DB (workflow_events)
     → persist some events as UI messages (conversation)
     → persist knowledge (when Codex runs via toolCodex → graphstore)
     → metrics + logs + (optionally) Linear activities
```

Takeaway: The router is a stable adapter; the new orchestration should minimize invasive changes. We will plug multi‑agent logic into WorkflowRuntime’s act phase and continue emitting a single runId’s event stream.

---

## Section 2: Multi‑Agent Design (Core Architecture)

This section defines a minimal but complete multi‑agent model that fits the runtime and router as-is.

### 2.1 Conceptual model: root plan → subtasks → waves → merge → review

We will transform a high‑level requirement into a set of precise sub‑requirements, each owning an ExecPlan, executed by a Codex agent (CLI/SDK), sequenced in “waves.” After all sub‑agents complete, a merge agent consolidates changes, and a review agent validates the result.

- Root ExecPlan: describes the big picture, context, acceptance criteria, decomposition rationale, and the plan of work.
- Subtasks: each contains a single clear goal (atomic increment), constraints, deliverables, and validation steps. Each subtask has its own ExecPlan.
- Waves: one or more groups of agents run in parallel (if independent). Successive waves run only when dependencies are satisfied.
- Merge agent: fetches all code changes (from worktrees/branches), merges them, resolves non‑conflicting changes, and flags conflicts for specialized handling.
- Review agent: runs checks (tests, linting, heuristics) and either accepts or reports issues (then sub‑agents remediate or user intervenes).

Reasoning Block: Why waves and not full concurrency?

- Option A: Launch all sub‑agents concurrently.
- Option B: Process strictly sequentially.
- Option C (Chosen): Batch in waves based on dependency graph and simplicity.

Evaluation:
- Simplicity: C is simple enough (BFS layers) and avoids cross‑agent contention on files; A is riskier for merges and infra cost.
- Performance: C balances throughput and conflict risk.
- Observability: C is easier to reason about—waves create clear boundaries.
- Compatibility: C maps to our existing run with grouped events per wave; no nested runs.

Thus, we adopt wave‑by‑wave execution, with concurrency within a wave limited by a cap (configurable, e.g., 2–3 agents).

### 2.2 Pure function interfaces

We define pure functions for decomposition, wave planning, merge and review synthesis, and a tracker for stuck detection. These functions introduce no side effects and return typed plans/outcomes—fitting ALFRED’s "purity" principle (side effects isolated in tool invocations).

Proposed module layout (pure):

```text
packages/agent/src/orchestrator/multi/
  decompose.ts      // task decomposition, pure
  spawn.ts          // wave planning and agent assignment, pure
  merge.ts          // merge plan synthesis, pure
  review.ts         // review plan synthesis, pure
  tracker.ts        // state machine representation + stuck detection, pure
  execplan.ts       // ExecPlan file contract and interpretation, pure
```

Key types and signatures:

```ts
// Shared identifiers
export type RunId = string;
export type SubTaskId = string;
export type WaveId = string;
export type AgentId = string;

// Context types we already have
import type { ContextBundle } from "@alfred/type/plan";
import type { Chunk } from "@alfred/rag";

// Pure decomposition output
export type SubTask = {
  id: SubTaskId;
  title: string;
  requirement: string;     // what this sub-agent must achieve
  deps: SubTaskId[];       // subtask ids that must complete first
  priority: number;        // 0..1 (higher means earlier)
  estimateHours?: number;
  acceptance: string[];    // plain-language acceptance checks
  filesHint?: string[];    // optional relevant files
  risk?: "low" | "medium" | "high";
};

// Pure decomposition function
export function decomposeTask(
  requirement: string,
  context: {
    code: ContextBundle | null;
    rag: Chunk[];
    history?: unknown; // placeholder for future
  }
): SubTask[];
```

Spawn agents for a wave (logical plan only):

```ts
export type AgentSpec = {
  agentId: AgentId;           // stable per subtask attempt
  subTaskId: SubTaskId;
  sessionId: string;          // codex session id to maintain thread
  workingDirectory: string;   // cwd
  auto: "read" | "low" | "medium" | "high";
  model?: string;             // optional model override
  profile?: string;           // Codex profile if any
  execPlanPath: string;       // path to this subtask’s ExecPlan.md
  context: {
    linearIssueId?: string;
    linearSessionId?: string;
    linearSpace?: string;
    linearAuthz?: string;
    relevantFiles?: string[];
  };
};

export type WavePlan = {
  waveId: WaveId;
  agents: AgentSpec[];
  dependsOn: WaveId[];     // previous waves that must complete
};

// Pure function to plan wave groupings based on deps/priority
export function planWaves(
  subTasks: SubTask[],
  options?: { maxParallel?: number }
): WavePlan[];
```

Agent lifecycle status (pure representation):

```ts
export type AgentStatus = "created" | "running" | "completed" | "failed" | "stuck" | "paused";

export type AgentOutcome = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  status: AgentStatus;
  result?: {
    summary: string;
    artifacts: Array<{ path: string; kind: string }>;
    changes?: string[];       // list of changed files or branches
    notes?: string[];         // highlights for merge/review
  };
  error?: { code: string; message: string };
  metrics?: {
    durationMs: number;
    commandsRun?: number;
    filesChanged?: number;
  };
};

export type WaveOutcome = {
  waveId: WaveId;
  agents: AgentOutcome[];
  status: "completed" | "partial" | "failed";
};
```

Merge and review are pure plans:

```ts
export type MergePlan = {
  summary: string;
  branches?: string[];         // if using worktrees/branches
  expectedFiles?: string[];    // key files to verify exist/merge
  strategy?: "worktree" | "branch" | "direct";
};

export function buildMergePlan(
  subOutcomes: AgentOutcome[]
): MergePlan;

export type ReviewPlan = {
  summary: string;
  checks: Array<{
    id: string;
    description: string;
    type: "tests" | "lint" | "static" | "scenario";
  }>;
};

export function buildReviewPlan(
  mergedHint: { files: string[]; summary?: string }
): ReviewPlan;
```

Tracker models orchestrator state and stuck detection (pure):

```ts
export type AgentEvent = 
  | { type: "codex/thought"; agentId: AgentId; text: string; ts: number }
  | { type: "codex/command"; agentId: AgentId; command: string; status: "running"|"completed"|"failed"; ts: number }
  | { type: "codex/file"; agentId: AgentId; path: string; kind: string; ts: number }
  | { type: "notice"; agentId: AgentId; message: string; ts: number };

export type TrackerState = {
  agents: Record<AgentId, {
    subTaskId: SubTaskId;
    status: AgentStatus;
    lastEventTs: number;
    commands: string[];
    filesChanged: string[];
    loopScore: number;    // heuristic
  }>;
  waves: Record<WaveId, { status: "pending"|"running"|"completed"|"failed" }>;
};

export function updateTracker(state: TrackerState, event: AgentEvent): TrackerState;

export function detectStuck(state: TrackerState, agentId: AgentId, now: number, opts?: {
  noProgressMs?: number;          // default e.g., 120000
  maxRepeats?: number;            // repeated similar commands
  maxFileFlipFlops?: number;      // file changed back/forth
}): boolean;
```

ExecPlan contract (pure; no file I/O here):

```ts
export type ExecPlanSnapshot = {
  purpose: string;
  progress: Array<{ ts: string; text: string; done: boolean }>;
  decisions: Array<{ ts: string; text: string }>;
  surprises: Array<{ ts: string; text: string }>;
  outcomes?: { summary: string; checks: string[] };
};

export function interpretExecPlan(markdown: string): ExecPlanSnapshot;

// Optional: helpers that suggest next updates to plan sections
export function planProgressUpdate(prev: ExecPlanSnapshot, delta: {
  completed?: string; remaining?: string;
}): ExecPlanSnapshot;
```

These pure functions allow:
- deterministic, testable decomposition/wave planning,
- orchestration state updates and stuck detection logic,
- pure merge/review planning to be handed to toolCodex/toolGit.

### 2.3 Integration with WorkflowRuntime

We will integrate multi‑agent orchestration into the act phase of WorkflowRuntime (packages/runtime/src/core.ts). Conceptually:

- executeScanPhase: Build context via ContextBuilder, persist “context” events (already placeholder).
- executePlanPhase: Call decomposeTask(requirement, context…). Emit a data event carrying the SubTask[] (e.g., {type: "data-subtasks"} or “plan”). Persist root ExecPlan creation as an event.
- executeActPhase:
  - Build wave plans via planWaves(subTasks).
  - For each wave:
    - Emit “notice/wave-start”.
    - For each AgentSpec in the wave:
      - Create a Codex sessionId (deterministic from runId + subTaskId).
      - Create ExecPlan path (see Section 3).
      - Invoke toolCodex.execute with:
        - input.prompt crafted to read/update ExecPlan, perform work within sandbox, and commit scoped changes.
        - input.context (linear integration fields).
        - authz token required for repo/tool scopes (request via require-scope if needed).
      - Attach a ToolWriter that:
        - Forwards AlfredCodexEvents into runtime events (stdout, tool-call/result analogues).
        - Calls updateTracker on each event and detectStuck → if stuck, abort.
    - Wait for all agents in the wave to complete/fail/stuck → produce WaveOutcome and emit a data event (type: "wave-result").
    - If too many failures or a critical failure: abort (emit error).
  - After final wave completes, synthesise MergePlan and ReviewPlan (pure), then run merge/review agents similarly.

- executeReportPhase: Summarize, persist final plan/review statuses, emit progress 100%.

Cancellation and timeouts:
- The AbortSignal passed down to executeActPhase should be plumbed into Codex (SDK uses signal already; CLI path can be killed via timer). When WorkflowRuntime cancels, running agents should be aborted gracefully.

Resume flows:
- When toolCodex enforces policy for medium/high, if mfa is required it throws “biometric_required”. In the router today, this is mapped to TRPC PRECONDITION_FAILED.
- In multi‑agent act phase, when a given AgentSpec requires elevation or special scopes (git push, merge, network, docker), emit a “require-scope” event with a dedicated event code (bio-authz / deploy-authz). The router already forwards resume via runRegistry resume; WorkflowRuntime.waitForResume (currently stubbed) can be used to pause until a resume payload is received (the code exists and returns ResumePayload | null after timeout). We will wire this into executeActPhase around agent pre‑flight.

### 2.4 Should agents be nested workflows?

Two options:

- Option 1: Model each sub‑agent as its own WorkflowRuntime instance (child run):
  - Pros: Clean isolation, separate runIds, per‑agent replay, independent cancel/resume.
  - Cons: Explosion of workflow_runs rows, nested run registries, more complexity in router and tests, cross‑run data correlation required for merge/review, added latency overhead.

- Option 2: Model each sub‑agent as part of the parent WorkflowRuntime (single runId):
  - Pros: Simple persistence—single runId, a single event log; existing conversation mapping remains; simpler resume and cancel; fewer DB entries; simpler metrics.
  - Cons: Less isolation for tool failures (but we can still attribute to agentId in event payloads), longer event logs.

Reasoning Block: Choice

We choose Option 2 (single run; agents as child activities). The existing router is optimized for one runId at a time. Tests expect a single stream per run, and the persistence is simple. We will include agentId, subTaskId, waveId in the eventData to disambiguate. This keeps our system austere and avoids additional orchestration complexity.

---

## Section 3: ExecPlan Integration (File‑Based Planning)

Agents must operate via ExecPlans that meet .agent/PLANS.md requirements. We define deterministic file layout, lifecycle, and consistency.

### 3.1 File naming and layout

We will store ExecPlans under .agent/plans, keyed by the parent workflow run id. This avoids collisions across runs.

```text
.agent/
  PLANS.md                          # spec and methodology (existing)
  plans/
    <runId>.root.md                 # root ExecPlan (created at workflow start or plan phase)
    <runId>/
      <subtaskId>.md                # per-subtask ExecPlan
```

Properties:

- runId is the WorkflowRuntime runId (router persists it).
- subtaskId is from pure decomposition (deterministic, e.g., incremental or stable hash).
- This coexists with .agent/PLANS.md; the root and subtask plans point back to PLANS.md methodology and remain self‑contained.

### 3.2 ExecPlan lifecycle

Creation moments:

- Root ExecPlan:
  - Created in plan phase (or at start) once decomposeTask returns SubTask[].
  - Content includes: Purpose/Big Picture, initial decomposition, acceptance, environment (cwd, sandbox), links to SubTask ExecPlans.

- Subtask ExecPlan:
  - Created when the subtask is assigned to an agent (just‑in‑time on wave start) to avoid creating many unattended files.
  - Must include:
    - Purpose: restate the subtask requirement as a novice-readable goal.
    - Progress: checklist; initial entry “Subtask assigned to agent at <ts>”.
    - Surprises & Discoveries: empty.
    - Decision Log: empty.
    - Plan of Work & Concrete Steps: initial skeleton.
    - Validation and Acceptance: from SubTask.acceptance synthesized as checkboxes.
    - Idempotence & Recovery: standard stub; commit messages guidelines.

Sections (aligning to .agent/PLANS.md verbatim):

- Purpose / Big Picture
- Progress (with timestamps)
- Surprises & Discoveries
- Decision Log
- Outcomes & Retrospective
- Context & Orientation
- Plan of Work
- Concrete Steps
- Validation and Acceptance
- Idempotence and Recovery
- Artifacts and Notes
- Interfaces and Dependencies

### 3.3 Who updates ExecPlans and how

Codex agents update plans:

- The prompt passed to toolCodex must instruct the agent to:
  - Load the assigned ExecPlan file.
  - Before any action, append a Progress entry documenting the intended step.
  - After each significant step, append to Progress and Decision Log.
  - Use idempotent edits (avoid rewriting whole files; use relative small updates).
  - Commit ExecPlan updates before code changes where appropriate, so we can see trace.
- Single-writer policy:
  - A subtask ExecPlan is only updated by its assigned agent. We avoid multi‑writer conflicts by wave planning (no two agents on the same subtask).
  - The root ExecPlan is updated by the orchestrator (via a dedicated merge agent or through a single “coordinator” agent) at designated milestones; not by all sub-agents.

Consistency:

- Subtasks are assigned exclusively; waves ensure dependencies are respected.
- The orchestration layer ensures that only one agent has the ExecPlan path open.
- If multiple waves run, each subtask ExecPlan lives under runId/<subtaskId>.md—no overlap.

### 3.4 ExecPlan persistence in knowledge graph

We mirror ExecPlans into the knowledge graph by emitting knowledge nodes and edges. We do not require new schema tables; memory_nodes/edges are flexible.

Node kinds (string labels):

- “execplan” nodes for root and subtask plans.
  - properties: { runId, subTaskId?, path, updatedAt, status, acceptance[], links[] }

Edges:

- “subtask_of” between subtask execplan → root execplan.
- “implements” edges linking execplan nodes to code artifacts (codex_artifact nodes created by persistCodexExecution).
- “produces” edges linking execplan → commit nodes (if we model commits as nodes later).
- “explains” edges linking execplan → reasoning nodes created by persistReasoning.

Example shapes:

```sql
-- Node (memory_nodes)
-- kind = 'execplan'
-- label = title (plan file heading)
-- properties = {
--   runId: string,
--   subTaskId?: string,
--   path: string,
--   status: 'pending'|'running'|'completed'|'failed'|'stuck',
--   updatedAt: ISO string,
--   acceptance: string[],
--   links: string[]  -- file links, card URLs, etc.
-- }

-- Edge (memory_edges)
-- kind = 'subtask_of' or 'implements' or 'explains' or 'has_artifact'
```

Status inference heuristics:

- From ExecPlan “Progress” section (checklist): if all items marked done → completed; if any “blocked” comment → stuck or paused; otherwise running.
- The orchestrator updates the node’s properties (status, updatedAt) when emitting plan events.

This mapping preserves the living plan as knowledge, cross-links to codex artifacts and reasoning, and allows later analytics.

---

## Section 4: Multi‑Agent Orchestration Gaps and Error Scenarios

For each scenario, we specify detection signals, thresholds, actions, and surfacing to the user (events/Linear/logs). We leverage existing data sources: workflow_events, graph nodes for reasoning/artifacts, workflow.getToolCalls, and toolCodex events.

### 4.1 Agent stuck in loop

Signals:

- Repeated command executions:
  - Same command prefix (e.g., “npm test”) > K times within M minutes.
  - Detect via AgentEvent “codex/command” with stable prefix (normalized).
- Oscillating file changes:
  - Same file changed > N times with small deltas or deleted/recreated.
  - Detect via AgentEvent “codex/file”.
- No meaningful new events:
  - No file_change or agent_message with new content in > noProgressMs.

Suggested thresholds (tunable):

- noProgressMs = 120,000 ms.
- maxRepeats = 5 for identical/similar commands.
- maxFileFlipFlops = 4 for the same file path.

Actions:

- Mark agent status = “stuck”.
- Abort the agent execution gracefully (signal abort; kill process if necessary).
- Emit workflow event:
  - { type: "agent-stuck", agentId, subTaskId, reason, metrics }.
- Optional: Spawn a diagnostic agent (next wave) with a small ExecPlan: “Investigate stuck agent X; propose top‑3 actions.”

Surfacing:

- Emit Linear “error” or “thought” activity (emitLinearActivity) with body summarizing stuck reason.
- Log: logger.warn("multi_agent_agent_stuck", { runId, agentId, subTaskId, reason, metrics… }).

### 4.2 Agent needs guidance

Signals:

- Codex reasoning content indicating uncertainty:
  - “I’m not sure…”, “I need more information…”, “uncertain”, “not clear”.
  - Detect via thought events (regex).
- Repeated approval requests without progress:
  - The agent asks to escalate (policy) multiple times quickly; track require‑scope events and see no new artifacts or final messages.

Actions:

- Pause subtask (status “paused”).
- Emit require‑scope or notice to the user:
  - If it’s an authz issue: emit {type: "require-scope", event: "bio-authz" or "deploy-authz"}.
  - If it’s informational: emit {type: "notice", message: "agent_needs_guidance", details}.
- Optionally add a Linear comment via emitLinearActivity("thought", …) summarizing the question.

Surfacing:

- Workflow event for UI with details.
- Linear thought activity with guidance request summary.

### 4.3 Merge conflicts

Signals:

- Merge agent uses toolGit with action “merge/push” and detects non‑zero exit or conflict markers.
- Alternatively, codex agent merges and emits file changes containing conflict markers (<<<<<<<, =======, >>>>>>>).

Actions:

- Spawn a dedicated conflict‑resolution agent with a targeted ExecPlan (“Resolve conflict in files A, B. Document decisions. Validate build.”).
- Limit attempts: if unresolved after N=2 attempts, mark subtask “stuck” and surface to human.

Surfacing:

- Emit workflow event: { type: "merge-conflict", files, branch }.
- Linear action activity: “Merge conflict on files: …; resolution plan started.”

### 4.4 Review failures

Signals:

- Review agent returns a negative outcome: tests fail, linting fails, or heuristics fail.
- toolDocker/probe or toolDroid output indicates failing status.

Actions:

- Roll back or stow changes:
  - Prefer using worktree/branch strategies: if merge fails, maintain feature branch, revert main.
- Spawn remediation agents targeted at the failing tests/metrics, or mark workflow as “needs manual intervention” when failures persist beyond thresholds.

Surfacing:

- Workflow event: { type: "review-failed", checksFailed, summary }.
- Linear action activity summarizing failure with links to logs or failing test output.

### 4.5 Cascading failures across agents

Signals:

- In a wave, more than X% (e.g., 50%) of agents failed/stuck.
- Across all waves so far, failure rate > Y% (e.g., 40%).

Actions:

- Abort remaining waves or downgrade autonomy level: e.g., from “low” to “read”.
- Emit global “workflow” error event with suggestion to intervene.

Surfacing:

- Workflow event: { type: "wave-aborted", waveId, failRate }.
- Linear error activity summarizing the abort and next steps.

Data sources leveraged:

- workflow_events: tool‑call/tool‑result events, errors, notices.
- graph nodes: reasoning chain for “uncertainty” classification; artifacts track file change counts.
- getToolCalls: frequency/parameters of tool calls per time window.

---

## Section 5: Concrete Implementation Blueprint (Per‑Phase)

We propose a minimal set of file additions/modifications, pure interfaces, DB considerations (no schema changes required initially), and acceptance criteria.

### Phase 1: Task decomposition + root ExecPlan creation

Files to create:

- packages/agent/src/orchestrator/multi/decompose.ts
  - export decomposeTask(requirement, context): SubTask[]
  - Basic rule‑based decomposition (MVP) that splits by obvious boundaries (e.g., UI/backend/test) using ContextBundle and RAG signals (top files). Deterministic IDs.

- packages/agent/src/orchestrator/multi/execplan.ts
  - export ExecPlanSnapshot, interpretExecPlan, planProgressUpdate (pure).
  - export helpers to generate a skeleton ExecPlan string for a subtask.

- packages/agent/src/orchestrator/multi/spawn.ts
  - export planWaves(subTasks, {maxParallel}): WavePlan[] (topological layering by deps; within layer order by priority).

Router/runtime integration:

- In WorkflowRuntime.executePlanPhase:
  - Build context via ContextBuilder (scan phase can store context; for now pass requirement).
  - Call decomposeTask to get SubTask[].
  - Emit WorkflowEvent:
    - type: "data-subtasks", data: SubTask[] (or conform existing “context” event envelope).
  - Create root ExecPlan content string (pure generator) and emit an event “execplan-root-created”; optionally persist file now or defer to act phase when a “coordinator” Codex agent writes the file.

No DB schema changes.

Acceptance criteria:

- Given a requirement and a simple repo, executePlanPhase emits a “data-subtasks” event with 2–3 subtasks and yields a follow‑up progress event.
- Root ExecPlan text is deterministically generated (emitted as a data event or written by first act step).

### Phase 2: Single‑agent ExecPlan execution

Goal: wire a single Codex agent to execute one subtask ExecPlan (no waves yet).

Files to create/modify:

- packages/agent/src/orchestrator/multi/spawn.ts
  - add buildAgentSpec(subTask, runId, cwd): AgentSpec (pure).
- packages/runtime/src/core.ts
  - In executeActPhase: for MVP, pick the first subtask and run a single AgentSpec.
  - Invoke toolCodex with input:
    - action: "exec"
    - prompt: built from execplan instructions (see below).
    - auto: "low" (or from options).
    - cw: workspace
    - context: linear fields (if any).
  - Attach a ToolWriter that emits:
    - “stdout”, “stderr” events,
    - “codex_event” mapping to “tool-call”/“tool-result”/“data-…” event forms as needed,
    - updates a local tracker for stuck detection.

Prompt content (MVP):

- Read the subtask ExecPlan file at path.
- Update Progress and Plan sections as you act.
- Make changes within the workspace; run only read‑only commands unless approved by policy.
- Produce a final summary (the agent_message captured by toolCodex).

ExecPlan persistence:

- For MVP, let Codex write the ExecPlan file; persist at file system level. We will capture its creation/update through file_change artifacts. Optionally, we can emit a specific event when the file is created.

Acceptance criteria:

- Running the workflow for a trivial repo yields:
  - A subtask ExecPlan file created under .agent/plans/<runId>/<subTaskId>.md.
  - Codex produces an agent message and at least one artifact/file change event.
  - Events persist to DB and the flow completes with progress 100.

### Phase 3: Multi‑agent coordination (waves)

Files to modify:

- packages/agent/src/orchestrator/multi/spawn.ts
  - Implement planWaves layered by deps/priority; set maxParallel default to 2.

- packages/runtime/src/core.ts (executeActPhase):
  - Obtain WavePlan[] from planWaves.
  - For each wave:
    - Emit notice {type: "notice", message: `wave_${waveId}_start`} and a data event carrying WavePlan.
    - Launch agents concurrently (bounded parallelism).
    - For each AgentSpec:
      - Determine codex sessionId = `${runId}:${subTaskId}` stable string.
      - Derive ExecPlan path and ensure it exists (Codex will create/update).
      - Invoke toolCodex.execute with per‑agent abort controller (tied to phase abort or user cancel).
      - Track per‑agent outcomes (success/failure/stuck) and durations.
    - Emit "wave-result" with WaveOutcome.

- packages/agent/src/orchestrator/multi/tracker.ts:
  - Implement updateTracker and detectStuck. The runtime writer calls updateTracker on each Codex event; detectStuck used periodically or on a timer.

Dependencies vs parallelism:

- Only schedule agents whose deps are completed.
- Avoid assigning multiple agents to overlapping file hints when risk is high (MVP: rely on wave dependencies to reduce conflicts).

Acceptance criteria:

- With 2–3 subtasks with simple DAG, execute waves in correct order.
- Persist per‑wave “wave-start” and “wave-result” events.
- If one agent fails, subsequent waves dependent on it are not scheduled; the workflow still reaches a terminal state.

### Phase 4: Merge agent integration

Files:

- packages/agent/src/orchestrator/multi/merge.ts
  - Implement buildMergePlan(subOutcomes) using changed files and artifacts.
  - Strategy toggles:
    - “worktree” or “branch”: if agents commit to branches, merge them.
    - “direct”: if agents committed in place, simply collate and commit.

Runtime integration:

- After all waves complete, create a merge AgentSpec (role=“merge”, agentId “merge”) and run:
  - Either use toolGit directly for merge commands (simple merges), OR
  - Use toolCodex if we want the agent to resolve conflicts (more flexible).
- On conflicts:
  - Spawn a “conflict‑resolution” Codex agent (MVP threshold N=2 attempts).

Acceptance criteria:

- For multi‑file changes without conflicts, merge agent completes and emits a “merge” completion event.
- For conflicting changes (simulated in test), a conflict resolution attempt is spawned and either resolves or surfaces a failure event.

### Phase 5: Review agent integration

Files:

- packages/agent/src/orchestrator/multi/review.ts
  - Implement buildReviewPlan(mergedHint): returns a list of checks.

Runtime integration:

- Create a “review” AgentSpec post‑merge:
  - If checks include “tests”: can use toolDroid or toolDocker to run tests (depending on project).
  - If “lint”: run commands.
  - Alternatively, toolCodex can orchestrate reading logs and suggesting fixes.

Acceptance criteria:

- In a trivial repo, review agent runs a minimal check (e.g., “build compiles”).
- For a failing condition, review emits “review-failed” and marks workflow appropriately.

### Phase 6: Error detection and recovery

Files:

- packages/agent/src/orchestrator/multi/tracker.ts (add heuristics)
  - detectStuck based on signals/thresholds.
  - Expose a “needs-guidance” method (regex on thought content).

- packages/runtime/src/core.ts
  - In act phase, periodically evaluate tracker between agent events.
  - On stuck or needs‑guidance:
    - Emit workflow events and either pause/resume or abort as per policy.
  - Wave abort logic for cascading failures.

Acceptance criteria:

- Tests simulate loops and missing progress; tracker flags stuck within thresholds.
- Router surfaces {type: "agent-stuck"} and {type: "require-scope"} events.

---

## Section 6: Performance and Observability

We commit to quantitative budgets and define concrete metrics and logs that correlate with DB and run registry.

### 6.1 Performance budgets

- Task decomposition: < 100 ms p99 per requirement
  - Pure function, low complexity; avoid heavy tokenization or model calls here.
- Agent status checks: < 10 ms p99
  - updateTracker/detectStuck operate on in‑memory structures.
- Graph lookups for reasoning/execplans: < 1 ms p99
  - Use repo functions with indexes; any heavy traversal should be off‑critical path.
- RAG queries:
  - Leverage existing repo budgets. ContextBuilder already measures; we reuse.

### 6.2 Metrics

Add to packages/api/src/metrics.ts and/or packages/runtime/src/metrics.ts:

```ts
export const multiAgentTasksTotal = new client.Counter({
  name: "multi_agent_tasks_total",
  help: "Count of multi-agent subtasks grouped by status",
  labelNames: ["status"] as const, // created|running|completed|stuck|failed|paused
  registers: [metricsRegistry],
});

export const multiAgentWavesTotal = new client.Counter({
  name: "multi_agent_waves_total",
  help: "Count of multi-agent waves grouped by status",
  labelNames: ["status"] as const, // started|completed|aborted|partial
  registers: [metricsRegistry],
});

export const multiAgentAgentDurationSeconds = new client.Histogram({
  name: "multi_agent_agent_duration_seconds",
  help: "Duration of agent runs grouped by role/outcome",
  labelNames: ["role", "outcome"] as const, // worker|merge|review ; ok|error|stuck|paused
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

export const multiAgentErrorsTotal = new client.Counter({
  name: "multi_agent_errors_total",
  help: "Count of multi-agent errors grouped by kind",
  labelNames: ["kind"] as const, // stuck|conflict|review|auth|unknown
  registers: [metricsRegistry],
});
```

Where to increment/observe:

- On decomposeTask return: multiAgentTasksTotal.inc({status: "created"}, subTasks.length)
- When wave starts/completes/aborts: multiAgentWavesTotal.inc({status: "started"/"completed"/"aborted"})
- Per agent completion: multiAgentAgentDurationSeconds.observe({role, outcome}, seconds)
- On stuck/conflict/review failure: multiAgentErrorsTotal.inc({kind: "stuck"/"conflict"/"review"})

Existing metrics already cover Codex execs, tool invocations, context selection.

### 6.3 Structured logging

Log entires correlate runId, waveId, subTaskId, agentId:

```ts
logger.info("multi_agent_wave_start", {
  runId,
  waveId,
  taskIds: wave.agents.map(a => a.subTaskId),
  agentCount: wave.agents.length,
});

logger.info("multi_agent_agent_complete", {
  runId,
  waveId,
  agentId,
  subTaskId,
  outcome: "completed",
  durationMs,
  filesChanged: outcome.result?.changes?.length ?? 0,
});

logger.warn("multi_agent_agent_stuck", {
  runId,
  waveId,
  agentId,
  subTaskId,
  reason: "no_progress",
  metrics: { repeats, flipFlops, noProgressMs },
});
```

These should be emitted inside executeActPhase adjacent to metrics increments, so logs and metrics are aligned.

---

## Section 7: Testing Strategy

We define unit, integration, failure, and performance tests to validate the multi‑agent orchestration.

### 7.1 Unit tests (pure functions)

Paths:

- packages/agent/test/multi/decompose.test.ts
  - decomposeTask: inputs with trivial and moderate requirements; asserts stable SubTask IDs, priorities, deps.

- packages/agent/test/multi/spawn.test.ts
  - planWaves: DAG inputs; asserts wave layering, respecting maxParallel.

- packages/agent/test/multi/merge.test.ts
  - buildMergePlan: given AgentOutcome arrays (with changes), asserts merge strategy and expected files.

- packages/agent/test/multi/review.test.ts
  - buildReviewPlan: given merged hints, asserts checks list.

- packages/agent/test/multi/tracker.test.ts
  - updateTracker/detectStuck: simulate sequences of events; asserts stuck detection thresholds.

- packages/agent/test/multi/execplan.test.ts
  - interpretExecPlan: parse a minimal ExecPlan.md and assert snapshot fields.

### 7.2 Integration tests

Extend existing workflow tests:

- packages/api/test/workflow.runtime-integration.test.ts
  - Add a new test “multi-agent waves”:
    - Mock toolCodex to emit minimal events and “file_change” per agent.
    - Provide a simple decomposition (inject SubTask[] via a hook or sugar in runtime for tests).
    - Assert:
      - Correct wave sequencing (notice wave_start/wave_result order).
      - DB events appended for each agent’s stdout/tool events.
      - Final progress 100.

- packages/api/test/workflow.runner.phase.test.ts
  - Ensure phases still emit basic start/completion ordering with multi-agent act.

- packages/api/test/workflow.capture.integration.test.ts
  - Extend to verify ExecPlan files created and that reasoning nodes/edges exist linking to execplan nodes.

### 7.3 Failure‑mode tests

- Simulate stuck agents:
  - Mock toolCodex writer to repeatedly emit the same command and no file changes.
  - Assert the orchestrator aborts agent, emits “agent-stuck” event, logs metrics.

- Merge conflicts:
  - Mock toolGit merge to fail; assert conflict resolution agent spawns and either resolves or errors after N attempts.

- Review failures:
  - Mock review agent to emit a failure; assert “review-failed” event and abort/downgrade strategy.

### 7.4 Performance tests

- Unit-level micro‑bench:
  - decomposeTask with 100 file hints: run 100 iterations and ensure < 100ms p99 on CI hardware (skipping heavy I/O or models).
- Tracker checks on 10,000 events to remain < 10ms p99.

---

## Section 8: Open Questions and Risks

### 8.1 Open design questions

- SubTask schema alignment vs @alfred/type/plan codexPlan/codexReport types:
  - We proposed SubTask minimally. We may unify with codexPlanTask/codexPlanAcceptance later or provide mapping functions.
- Agents per wave:
  - Practical concurrency depends on Codex latency and merge risk. Start with maxParallel=2, tune later.
- Planning vs review model:
  - Use GPT‑4o (OPENAI_MODEL_PLAN default) for decomposition or introduce GPT‑5.1 when available? Keep the “plan model” consistent with AISDKAdapter; decouple later if needed.

### 8.2 Technical risks and mitigations

- Destructive Codex changes:
  - Sandbox default read‑only; workspace-write only for auto ≠ read; policy enforcement requires MFA for medium/high; use Git worktrees/branches where possible.
- Under-specified ExecPlans:
  - ExecPlan skeletal sections must be filled by agents; orchestrator should fail fast if acceptance checks are empty; root plan includes acceptance criteria and is persisted.
- Persistent loops/flapping states:
  - Tracker thresholds, cooling-off for retrials, and diagnostic agent approach reduce endless loops. Logs/metrics allow manual tuning.

### 8.3 Dependencies & scalability

- External dependencies:
  - Codex CLI/SDK must be available and stable; integrate SDK path for environments where CLI not permitted; ensure MCP env allowlist safe.
  - Linear integration is optional; rate-limiting caution when emitting activities; batched or “ephemeral:true” for noisy events.
  - Redis run registry optional but recommended for production.

- Scalability limits:
  - Max concurrent agents per workflow: 2–3 per host initially; scale by parallel runs on multiple pods/hosts with run registry.
  - Max concurrent workflows per host: depends on Codex concurrency and RAG; set system limits and backoff noisy features.

---

# Appendix A: How This Fits Together At Runtime

End‑to‑end flow:

```text
User → workflow.start({ requirement }) 
  → workflowRouter.createRun(runId) 
  → WorkflowRuntime created with model & AbortSignal
  → register runId in runRegistry (resume/cancel callbacks)

WorkflowRuntime.execute():
  emit run + progress 0
  scan → ContextBuilder builds context (receipts, bundle)
  plan → decomposeTask(requirement, context) → SubTask[]
         emit data-subtasks; create root ExecPlan event
  act  → planWaves(SubTask[])
         for wave in waves:
           emit notice wave_start
           run N agents in parallel:
             create ExecPlan file paths
             toolCodex.exec with prompt referencing ExecPlan
             writer→events: stdout/stderr/codex_event
             tracker updates and detectStuck
             persist Codex reasoning + execution (graphstore)
           emit wave-result event
         build MergePlan; run merge agent (toolGit/toolCodex)
         build ReviewPlan; run review agent (toolDroid/toolDocker/toolCodex)
  report → summarize → emit progress 100 "completed"

Router:
  consumes events, appendEvent(runId,…), persists UI messages when applicable,
  manages resume on require-scope (runRegistry.dispatchResume),
  emits metrics and Linear activities, updates conversation, preference refreshes.
```

---

# Appendix B: Example Pure TypeScript Blocks

Task decomposition:

```ts
export function decomposeTask(
  requirement: string,
  context: { code: ContextBundle | null; rag: Chunk[]; history?: unknown }
): SubTask[] {
  // MVP heuristic:
  // - If code bundle contains both frontend and backend files, create two subtasks.
  // - If tests are present, create a "tests" subtask.
  // - Assign simple deps: backend before frontend if shared API changed; tests depend on both.
  // Deterministic ids via hash(requirement + pathPrefixes).
  return [
    { id: "T1", title: "Backend update", requirement: "...", deps: [], priority: 1, acceptance: ["Server starts"], filesHint: ["api/"] },
    { id: "T2", title: "Frontend update", requirement: "...", deps: ["T1"], priority: 0.8, acceptance: ["UI renders"], filesHint: ["web/"] },
    { id: "T3", title: "Tests", requirement: "...", deps: ["T1","T2"], priority: 0.7, acceptance: ["Tests pass"], filesHint: ["tests/"] },
  ];
}
```

### 2.3 Worktree lifecycle and deterministic merge

Every agent that edits the repo now works inside a dedicated git worktree rooted under `.agent/worktrees/<run>/<agent>`. Creation writes a `.alfred-worktree.json` manifest capturing `branch` and `baseRef`, which allows the orchestrator to remove the worktree with `git worktree remove --force` and delete the derived branch without touching user branches. Agent outcomes inherit their worktree branch names so the merge planner can reason about which feature branches exist. During Phase 9 the orchestrator builds a `MergePlan` that records `targetBranch`, changed files, and changed packages. `executeMergePlan` uses `worktreeManager.safeMerge` to create a detached preview worktree, run `git merge --no-commit`, and collect conflicting files. Only conflict-free branches are merged into the target via `toolGit`. This keeps the operator workspace clean, orders merges deterministically, and ensures review validation always runs against a known-good branch tip.

Wave planning:

```ts
export function planWaves(subTasks: SubTask[], { maxParallel = 2 } = {}): WavePlan[] {
  // Topological layering, stable ordering by priority
  // Return array of WavePlan with <= maxParallel agents per wave
  // Implementation details left for code; design intent is clear.
  return [];
}
```

Tracker usage:

```ts
// Writer handling codex events
async function onCodexEvent(e: AlfredCodexEvent, agent: AgentSpec) {
  switch (e.type) {
    case "thought":
      // emit runtime event, update tracker
      break;
    case "command":
      // update tracker repeats
      break;
    case "artifact":
      // update filesChanged
      break;
    // ...
  }
  if (detectStuck(tracker, agent.agentId, Date.now(), { noProgressMs: 120000 })) {
    // abort agent, mark stuck, emit event
  }
}
```

---

# Conclusion

This proposal extends ALFRED’s runtime with a simple, pure, and observable multi‑agent orchestration model that:

- Decomposes work into independent subtasks powered by ExecPlans.
- Executes agents in waves using Codex with strong sandboxing and policy.
- Persists all events, artifacts, and reasoning to the DB and knowledge graph.
- Consolidates via a merge agent and validates via a review agent.
- Detects stuck agents and error scenarios using transparent heuristics.
- Fits into existing router/runtime without architectural disruption.
- Provides metrics and logs with stable IDs for clear observability.
- Adheres to .agent/PLANS.md methodology (self‑contained, living plans).

It is intentionally austere—no heavy actor frameworks, no nested workflows. The design relies on pure functions for planning and tracking, with side effects isolated to tool execution. This makes it easy to implement, test, and evolve in small steps while preserving reliability and performance.
