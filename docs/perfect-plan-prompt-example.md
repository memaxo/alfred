Use this prompt structure to generate a perfect plan for a new feature or refactor.

````
You are an AI architect and systems designer investigating how to implement **multi-agent Codex orchestration** for the ALFRED project.

Your job is to produce an **extremely detailed written report** (minimum ~3000+ words) that analyzes the current architecture and proposes a concrete, implementable multi-agent design — not to write code. Assume the reader is a strong engineer but *new to this repo*.

---

## 0. Grounding and Required Inputs

Before you start reasoning, you **must**:

1. **Read these project rules and methodologies carefully and treat them as binding constraints:**
   - `./.agent/PLANS.md` – ExecPlan methodology and expectations.
   - Any `AGENTS.md` or `docs/reference/ai-sdk-v6/agents.md`– agent guidance and conventions.

2. **Use the codebase itself as primary truth**, focusing especially on (paths are repo-relative):

   **Workflow / runtime:**
   - `packages/api/src/routers/workflow.ts`
   - `packages/api/src/workflow/runner.ts` (legacy `runPlanV6`)
   - `packages/runtime/src/core.ts` (`WorkflowRuntime`)
   - `packages/runtime/src/context.ts` (`ContextBuilder`)
   - `packages/runtime/src/adapters/ai.ts` (`AISDKAdapter`)
   - `packages/runtime/src/metrics.ts`
   - `packages/runtime/src/engines/*` (cognitive, knowledge, learning)

   **Codex / tools / orchestration:**
   - `packages/agent/src/orchestrator/tool/codex.ts`
   - `packages/agent/src/orchestrator/tool/codex-linear.ts`
   - `packages/agent/src/orchestrator/tool/droid.ts`
   - `packages/agent/src/orchestrator/tool/docker.ts`
   - `packages/agent/src/orchestrator/tool/git.ts`
   - `packages/agent/src/orchestrator/codex-session.ts`
   - `packages/agent/src/orchestrator/flow/context.ts`
   - `packages/agent/src/orchestrator/config.ts`
   - `packages/agent/src/agents.ts` (assistant/orchestrator agents)
   - `packages/agent/src/v6.ts` (tool wrapping for AI SDK v6)

   **Knowledge / RAG / graph:**
   - `packages/knowledge/src/hypergraph.ts`
   - `packages/knowledge/src/extractor.ts`
   - `packages/knowledge/src/persist.ts`
   - `packages/knowledge/src/compression.ts`
   - `packages/knowledge/src/query.ts`
   - `packages/rag/src/doc.ts`
   - `packages/rag/src/code.ts`
   - `packages/rag/src/rerank.ts`
   - `packages/db/src/schema/graph.ts`
   - `packages/db/src/repo/graph.ts`
   - `packages/agent/assistant/src/graphstore.ts`

   **Workflow persistence / reasoning:**
   - `packages/db/src/schema/workflow.ts`
   - `packages/db/src/repo/workflow.ts`
   - `packages/api/src/run-registry.ts`
   - `packages/api/src/ai/generate.ts`
   - `packages/api/src/ai/messages.ts`
   - `packages/api/src/scheduler/preference-inference.ts` (for patterns of historical analysis)
   - `packages/api/src/utils/audit.ts`, `packages/api/src/gate.ts`, `packages/auth/src/token.ts`

   **Tests that exercise workflow & reasoning:**
   - `packages/api/test/workflow.runner.test.ts`
   - `packages/api/test/workflow.runner.phase.test.ts`
   - `packages/api/test/workflow.runner.linear.test.ts`
   - `packages/api/test/workflow.runtime-integration.test.ts`
   - `packages/api/test/workflow.router.test.ts`
   - `packages/api/test/workflow.router.resume.flow.test.ts` (skipped but informative)
   - `packages/api/test/workflow.reasoning.test.ts`
   - `packages/api/test/workflow.reasoning.integration.test.ts`
   - `packages/api/test/workflow.capture.integration.test.ts`
   - `packages/agent/assistant/test/graphstore.integration.test.ts`

   **Metrics and observability:**
   - `packages/api/src/metrics.ts`
   - `packages/metrics/src/*` (especially `performance.ts`, `cognitive.ts`, `registry.ts`, `logger.ts`)

You may browse other files as needed, but treat the above as primary.

---

## 1. Mindset and Reasoning Instructions

Adopt the following mindset:

- **Carmack-style austerity**: Prefer the simplest possible working design. Strip away ceremony. Avoid feature flags, over-abstraction, or heavyweight frameworks. Keep data structures and control flow straightforward.
- **Karpathy-style understanding**: Don’t hand-wave. If something is not simple, you do not yet understand it. Dig until you can express it simply.
- **Deep multi-chain reasoning**: For each major architectural decision, you must:
  1. Generate at least **3–5 distinct design options** in your head.
  2. Evaluate them along axes: simplicity, performance, observability, error handling, compatibility with existing code.
  3. Choose one and justify concretely (not “feels nicer”).
- **No code changes**: You are producing a design/report only. Do not invent APIs that contradict existing code; extend them realistically.

Document your reasoning explicitly in the report (e.g., in “Reasoning Blocks”) when you converge on key decisions.

---

## 2. Overall Task

Produce a **single, self-contained technical report** that explains **how to design and implement a multi-agent Codex orchestration system inside ALFRED**, tightly aligned with the existing architecture and rules.

Your report must be so detailed that a new engineer could implement the system *entirely* from your document plus the current codebase.

The user’s high-level requirement:

> ALFRED should be able to:
> - Take a high-level technical task from the user.
> - Gather context (Droid/Codex scans + RAG/embeddings + semantic search).
> - Use a planning model (GPT‑5.1 / latest OpenAI) to decompose the task into atomic subtasks.
> - Spawn **waves of Codex agents** (CLI or SDK) that each:
>   - Create an ExecPlan file for its subtask.
>   - Iteratively execute that plan until its subtask is done.
> - After all subtasks are complete:
>   - A **merge agent** consolidates all code changes.
>   - A **review agent** validates the merged result.
> - The system must handle:
>   - Stuck agents.
>   - Infinite or bad loops.
>   - Agents needing guidance.
>   - Merge conflicts.
>   - Review failures.
> - All within ALFRED’s existing constraints: computational austerity, strong observability, and purity (side effects at clear boundaries).

---

## 3. Section-by-Section Requirements

Your report must be structured with the following headings and contents.

### Section 1: Current State Deep Dive

**Goal:** Demonstrate deep understanding of how ALFRED currently plans and orchestrates work, and how Codex is integrated.

Cover at least:

1. **Workflow planning architecture**
   - How `WorkflowRuntime` in `packages/runtime/src/core.ts` works today:
     - Phase sequence (`scan → plan → act → report`).
     - Where planning is *supposed* to happen (e.g., `executePlanPhase`) and what is currently placeholder vs implemented.
   - How the **legacy** `runPlanV6` in `packages/api/src/workflow/runner.ts` works:
     - Event stream structure.
     - Where timeouts, `require-scope`, and resume flows appear.
     - How it is integrated by `packages/api/src/routers/workflow.ts`.
   - What planning model is used:
     - Role of `OPENAI_MODEL_PLAN` and defaults in the workflow router.
     - How the runtime’s AI adapter (`AISDKAdapter`) is intended to be used (even if not fully wired yet).

2. **Context / RAG / codebase knowledge integration**
   - How `ContextBuilder` in `packages/runtime/src/context.ts` builds context:
     - Use of `gatherCodeContext`, `gatherWebContext`, `buildContextBundle` from `packages/agent/src/orchestrator/flow/context.ts`.
     - Caching behavior, token budgets, and metrics.
   - How RAG and embeddings are used:
     - `packages/rag/src/doc.ts`, `code.ts`, `rerank.ts`.
     - `packages/db/src/schema/rag.ts` and `packages/db/src/repo/rag.ts`.
   - How knowledge graph is used:
     - `packages/knowledge/src/*` and `packages/db/src/repo/graph.ts`.
     - How reasoning is persisted and later queried (e.g., `getReasoningChain`).

3. **Codex integration**
   - How `toolCodex` works:
     - Execution path: `codex exec --json` (Rust CLI) spawned with secure cwd handles (no SDK backend).
     - How approval/sandbox are configured from `auto` (read/low/medium/high).
     - How Codex threads are managed via `CodexSessionManager`.
   - What events Codex emits and how ALFRED consumes them:
     - `AlfredCodexEvent` types (`thought`, `command`, `output`, `artifact`).
     - How these are forwarded to writers, logged, or mapped into Linear via `codex-linear.ts`.
   - How Codex executions are persisted:
     - `persistReasoning` and `persistCodexExecution` in `packages/agent/assistant/src/graphstore.ts`.
     - How reasoning traces are converted to knowledge entries and stored as graph nodes/edges.

4. **Workflow persistence and replay**
   - How workflow runs and events are stored:
     - `packages/db/src/schema/workflow.ts`, `packages/db/src/repo/workflow.ts`.
     - Role of `appendEvent`, `createRun`, `updateRun`, `listEvents`, `listEventsByType`, and `getToolCalls`.
   - How run registry dispatches resume payloads:
     - `packages/api/src/run-registry.ts` – memory vs Redis registry, metrics, and cancel/resume semantics.

Use ASCII diagrams where helpful, e.g.:

```text
User → /workflow.start → workflowRouter.start
     → createRun() → createWorkflowExecutor() → WorkflowRuntime / runPlanV6
     → event stream → workflowRouter.stream → DB appendEvent + conversation persistence
     → knowledge (persistReasoning) + metrics + Linear (emitLinearActivity)
````

Your task here is **not** to design anything new yet, but to clearly map out what exists.

---

### Section 2: Multi-Agent Design (Core Architecture)

Now design a **multi-agent orchestration model** that fits into the existing runtime and router.

You must:

1. **Design the conceptual model of agents and waves:**
   - How a high-level requirement becomes:
     - A single **root ExecPlan**.
     - A set of **subtasks** with their own ExecPlans.
     - A sequence of **agent waves** (each wave = some number of Codex agents, each assigned one or more subtasks).
   - How the _merge_ and _review_ agents fit into this sequence.

2. **Define pure function interfaces (no side effects) for the core logic**. Give TypeScript-level signatures and describe semantics, e.g.:

```ts
// Pure task decomposition from high-level requirement + context into subtasks.
export type SubTask = {
  id: string; // stable identifier
  title: string;
  requirement: string; // what this sub-agent must achieve
  deps: string[]; // ids of subtasks that must complete first
  priority: number; // simple 0..1 or integer scale
};

export function decomposeTask(
  requirement: string,
  context: {
    code: ContextBundle | null;
    rag: Chunk[];
    history: unknown;
  }
): SubTask[];
```

Similarly define **pure** functions for:

- `spawnPlan` / “plan from requirement” (if separate from decomposition).
- `mergeResults(agentOutputs): MergedCode`.
- `reviewMerge(merged, original): ReviewResult`.

These pure functions should live conceptually under:

```text
packages/agent/src/orchestrator/multi/
  decompose.ts      // task decomposition, pure
  spawn.ts          // wave planning and agent assignment, pure
  merge.ts          // merge plan synthesis, pure
  review.ts         // review plan synthesis, pure
  tracker.ts        // state machine *representation* and stuck detection, pure
  execplan.ts       // ExecPlan file structure contracts (but pure)
```

You are not implementing them, but you must define:

- Types for:
  - `SubTask`
  - `AgentSpec` (what a Codex agent needs to know to run)
  - `AgentStatus` and `AgentOutcome`
  - `WavePlan`
  - `MergePlan`
  - `ReviewPlan`
- Return values, preconditions, and invariants.

3. **Explain integration with `WorkflowRuntime`**:
   - Where in `WorkflowRuntime.executeActPhase` you would conceptually:
     - Call task decomposition.
     - Build agent waves.
     - Drive the lifecycle of agents (wave by wave).
   - How this interacts with:
     - Cancellation (`this.state.cancelled`, AbortSignal).
     - Workflow timeouts.
     - Resume flows (bio-authz, deploy-authz, linear-authz).

4. **Discuss whether agents should be modeled as nested workflows**
   - Pros/cons of:
     - Treating each agent execution as its own `WorkflowRuntime` run.
     - Versus treating each agent as a “child” of the main runtime but not full workflows.
   - You must pick **one** approach and justify it with multi-chain reasoning.

Make the design **minimal** but complete; avoid fancy actor systems or message buses.

---

### Section 3: ExecPlan Integration (File-Based Planning)

Design how ExecPlans are used by agents.

Requirements:

1. **File naming and layout:**
   - Propose a deterministic scheme, e.g.:

     ```text
     .agent/plans/<workflow-id>.root.md             # root plan
     .agent/plans/<workflow-id>/<subtask-id>.md     # per-subtask plans
     ```

   - Explain how this coexists with existing `.agent/PLANS.md`.

2. **ExecPlan lifecycle:**
   - How and when plans are created:
     - Root ExecPlan from the initial requirement (probably at `workflow.start` time).
     - Per-subtask ExecPlan created when assigning a subtask to a Codex agent.
   - Required **sections** (as dictated by `.agent/PLANS.md`):
     - `Purpose`
     - `Progress` (checklist with timestamps)
     - `Surprises & Discoveries`
     - `Decision Log`
     - `Outcomes & Retrospective`
     - `Plan of Work` / `Concrete Steps` / `Validation` etc.

3. **Who updates ExecPlans and how:**
   - How Codex agents (via prompts) are instructed to:
     - First _read_ the relevant ExecPlan.
     - Then _update_ Progress/Decision Log as work proceeds.
   - Explain how these modifications are kept consistent and idempotent (e.g., avoid two agents editing the same ExecPlan).

4. **ExecPlan persistence in knowledge graph:**
   - How each ExecPlan is mirrored as knowledge:
     - Node(s) in `memory_nodes` with kind like `execplan` or `document`.
     - Edges linking:
       - Root plan ↔ subtask plans.
       - Plans ↔ code changes.
       - Plans ↔ Codex executions and reasoning traces.
   - Describe how you’d store:
     - Plan id, workflow id, subtask id.
     - Last updated time.
     - Status (inferred from Progress section).

You do **not** need to propose concrete SQL here, just schema shapes and how they map onto the existing graph repository.

---

### Section 4: Multi-Agent Orchestration Gaps and Error Scenarios

You must design detection and recovery strategies for at least these scenarios. For each, specify:

- **Signals / features** used to detect the problem.
- **Thresholds** (numbers, timeouts, counts).
- **Actions** taken by the orchestrator.
- **How this is surfaced** to the user (events, Linear activities, logs).

Scenarios to cover in depth:

1. **Agent stuck in loop**
   - Example signals:
     - Same file edited > N times within M minutes.
     - Same command executed > K times with similar arguments.
     - No meaningful new events (no new `file_change`, no progress increments).
   - Actions:
     - Stop the agent.
     - Mark the subtask as `stuck`.
     - Emit a `workflow` event (`type: "agent-stuck"`).
     - Optionally spawn a _diagnostic_ agent or request human guidance.

2. **Agent needs guidance**
   - Signals:
     - Explicit Codex reasoning messages (“I’m not sure…”, “I need more info…”).
     - Repeated approval requests without progress.
   - Actions:
     - Pause the subtask.
     - Emit a `require-scope` or `notice` event requesting user input.
     - Optionally open a Linear comment / activity via `emitLinearActivity`.

3. **Merge conflicts**
   - Signals:
     - Git operations in merge agent detect conflicts.
     - Presence of conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Actions:
     - Spawn a dedicated **conflict resolution agent** with a targeted ExecPlan.
     - If unresolved after N attempts, surface to human.

4. **Review failures**
   - Signals:
     - Review agent returns negative outcome (e.g., failing checks, style, tests).
     - Test suite fails after merge.
   - Actions:
     - Roll back or stow changes into a branch/worktree.
     - Spawn remediation agents, or mark workflow as needing manual intervention.

5. **Cascading failures across agents**
   - Signals:
     - More than X% of agents in a wave fail or get stuck.
   - Actions:
     - Abort or downgrade autonomy level.
     - Emit a global `workflow` error event.

For each scenario, clearly relate your detection logic to existing data sources:

- Workflow events (`workflow_events`).
- Knowledge graph nodes/edges for reasoning.
- Tool call history (`getToolCalls`).
- Codex artifacts and reasoning traces.

---

### Section 5: Concrete Implementation Blueprint (Per-Phase)

Design a **phased implementation roadmap** matching (but not coding) the following phases. For each phase, describe:

- **Files to create/modify** (full paths).
- **New types and function signatures** (TypeScript + where to put them).
- **Any DB schema or migration needs** (high-level only, but realistic).
- **Integration points** in existing code.
- **Per-phase acceptance criteria** (behaviorally described).

**Phase 1: Task decomposition + root ExecPlan creation**

- Implement pure decomposition function(s) and specify where they live.
- Integrate the _idea_ of root ExecPlan creation into `workflow.start` / `WorkflowRuntime` behavior.

**Phase 2: Single-agent ExecPlan execution**

- Treat a single Codex agent executing a single ExecPlan (no waves yet).
- Describe how:
  - The agent is configured and invoked (using `toolCodex`).
  - Outputs are persisted as workflow events and knowledge.
  - The ExecPlan is updated.

**Phase 3: Multi-agent coordination (waves)**

- Describe the data model for waves, dependencies between subtasks.
- How the orchestrator decides:
  - Which subtasks to run in parallel vs sequentially.
  - How to respect dependencies.

**Phase 4: Merge agent integration**

- Design how the merge agent:
  - Knows what to merge (set of code changes / branches / worktrees).
  - Uses Git and/or Codex to perform merges.
- Specify integration with `toolGit` and `toolDocker` if relevant.

**Phase 5: Review agent integration**

- Define how the review agent:
  - Receives the merged state.
  - Runs checks (tests, linting, simple heuristics).
  - Produces a structured review result.

**Phase 6: Error detection and recovery**

- Integrate the failure-mode logic from Section 4 into the orchestration loop.
- Describe:
  - Which module owns detection (likely `tracker.ts`).
  - How detection hooks into WorkflowRuntime’s phase execution and run registry.

---

### Section 6: Performance and Observability

You must propose **quantitative performance budgets** and **concrete metrics**.

1. **Performance budgets**
   - Task decomposition: < 100ms p99 per requirement.
   - Agent status checks: < 10ms p99.
   - Graph lookups (for reasoning chain / execplan nodes): < 1ms p99 at repo scale.
   - RAG queries: existing budgets from `rag` modules.

2. **Metrics**
   - Propose new metrics (names + label sets) to be added to `packages/api/src/metrics.ts` and/or `packages/runtime/src/metrics.ts`, such as:

     ```ts
     multiAgentTasksTotal{status="created|running|completed|stuck|failed"}
     multiAgentWavesTotal{status="started|completed|aborted"}
     multiAgentAgentDurationSeconds{role="worker|merge|review", outcome="ok|error|stuck"}
     ```

   - Explain how you’d increment/observe them for:
     - Agent creation/completion.
     - Wave start/finish.
     - Merge/review events.
     - Error conditions.

3. **Structured logging**
   - Define log event shapes and keys, e.g.:

     ```ts
     logger.info("multi_agent_wave_start", {
       runId,
       waveId,
       taskIds,
       agentCount,
     });
     ```

   - Show how logs correlate with metrics and DB rows via IDs (runId, waveId, subTaskId, agentId).

---

### Section 7: Testing Strategy

Design a **testing approach** (no code) that covers:

1. **Unit tests (pure functions)**
   - `decomposeTask` with various requirements & contexts.
   - `mergeResults` given intentionally overlapping/safe change sets.
   - `reviewMerge` given synthetic “good” and “bad” changes.

2. **Integration tests**
   - Extend existing workflow tests (e.g., `workflow.runner.test.ts`, `workflow.runtime-integration.test.ts`) with:
     - A simple multi-agent run where 2–3 subtasks are decomposed and "completed" (you can describe using stubbed Codex responses in tests).
     - Observations:
       - Correct wave sequencing.
       - Correct event persistence and reasoning chain.

3. **Failure-mode tests**
   - Simulate stuck agents (e.g., by emitting repeated similar events).
   - Simulate merge conflicts.
   - Simulate review failures.

4. **Performance tests**
   - Suggest how to test that decomposition and status checks remain within budget without overcomplication.

Describe **where** these tests would live (paths under `packages/api/test`, `packages/runtime/test`, `packages/agent/test`, etc.) and what they assert.

---

### Section 8: Open Questions and Risks

End your report with a realistic assessment of:

1. **Open design questions** that must be resolved before coding, e.g.:
   - Exact structure of SubTask JSON vs existing `@alfred/type/plan` schemas.
   - How many agents per wave are practical given Codex latency and cost.
   - Whether to use GPT‑5.1 exclusively for planning or also for review.

2. **Technical risks and mitigations**, including:
   - Risk of Codex agents making destructive changes even with sandboxing.
   - Risk of under-specified ExecPlans leading to incomplete work.
   - Risk of persistent loops or flapping stuck/un-stuck states.

3. **Dependencies & scalability**
   - Dependencies on external systems:
     - Codex CLI & SDK behavior.
     - Linear integration and rate limits.
     - Redis run registry behavior.
   - Expected scalability limits:
     - Max concurrent agents per workflow.
     - Max concurrent workflows per host, given ALFRED’s performance goals.

---

## 4. Style and Output Requirements

- **Single Markdown document** as output.
- Clear heading hierarchy: `#`, `##`, `###`.
- Use **TypeScript code blocks** for interface examples.
- Use **SQL code blocks** when illustrating DB schema shapes (but these need not be final migrations).
- Include **ASCII diagrams** where helpful.
- Use explicit, imperative language:
  - Avoid “we could…”; prefer “we **will**…” where appropriate, assuming the design proceeds.
- Make all reasoning explicit when choosing between designs.

---

## 5. Recap

You are not writing code or changing the repo. You are:

- Understanding the existing ALFRED workflow + Codex + knowledge architecture.
- Designing a **simple**, **pure**, **multi-agent orchestration model** with:
  - Decomposition → ExecPlans → agent waves → merge agent → review agent.
- Carefully specifying:
  - Types.
  - Interfaces.
  - Integration points.
  - Metrics.
  - Failure detection and recovery strategies.
- Producing a report that lets another engineer implement the feature confidently.

Take your time, be concrete, and favor brevity in implementation mechanics while being exhaustive in architecture and reasoning.`

```

```
