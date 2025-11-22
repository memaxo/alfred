```md
# Comprehensive Engineering Capability Upgrade

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference to PLANS.md: `.agent/PLANS.md` - this document must be maintained in accordance with the project's execution plan standards.

## Purpose / Big Picture

This initiative upgrades Alfred from a "script-runner" to a "principled software engineer." Currently, Alfred decomposes tasks based on file location (frontend/backend folders) and relies on existing tests to verify correctness. This upgrade enables Alfred to:
1.  **Architect before coding**: Analyze feature dependencies (e.g., DB schema before API) rather than just file paths.
2.  **Critique its own plans**: A dedicated Critic Agent will reject vague or dangerous plans before execution.
3.  **Work in any language**: Auto-detect project types (Node, Rust, Python) and use appropriate toolchains.
4.  **Verify functionally**: Spin up the app in Docker, smoke-test endpoints, and use headless browsers for visual verification.
5.  **Practice TDD**: Mandate writing reproduction tests before implementing fixes or features.

The goal is to enable Alfred to build high-quality features in *external* repositories with minimal human hand-holding.

## Progress

- [x] **Phase 1: Semantic Decomposition**
  - [x] Create `SemanticDecomposer` to analyze file dependencies and feature logical graph.
  - [x] Replace `decomposeTask` heuristic with semantic analysis.
- [x] **Phase 2: Architecture & Critique**
  - [x] Implement `ArchitectAgent` in `core.ts` (Pre-Plan phase).
  - [x] Implement `CriticAgent` in `core.ts` (Post-Plan, Pre-Act phase).
  - [x] Wire agents into the `WorkflowRuntime` loop.
- [x] **Phase 3: Polyglot Tooling**
  - [x] Implement `ProjectDetector` to identify language/framework (Node, Cargo, Go, etc.).
  - [x] Abstract `toolRunner` to use detected toolchain (e.g., `cargo test` vs `bun test`).
- [x] **Phase 4: Test-Driven Development (TDD)**
  - [x] Update `Act` phase loop to mandate "Test First" step.
  - [x] Implement `TestGenerator` logic to scaffold reproduction tests.
- [x] **Phase 5: Ephemeral Verification**
  - [ ] Implement `PreviewManager` using Phase 11 Docker tools.
  - [x] Implement `SmokeTester` (curl/fetch) to verify app startup.
- [x] **Phase 6: Visual Verification**
  - [x] Integrate Playwright/Puppeteer for headless browser snapshots.
  - [ ] Implement `VisualVerifier` agent to inspect screenshots.

## Surprises & Discoveries

- Pending start.

## Decision Log

- Decision: Prioritize Semantic Decomposition first.
  Rationale: Better plans reduce downstream errors in all other phases.
  Date/Author: 2025-11-21 / Droid

## Outcomes & Retrospective

- Pending completion.

## Context and Orientation

The current orchestration logic resides in `packages/runtime/src/core.ts`.
- **Decomposition**: Uses `packages/agent/src/orchestrator/multi/decompose.ts` (file-path buckets).
- **Execution**: Runs `toolCodex` agents in waves.
- **Verification**: Runs `bun test` in `executeActPhase`.
- **Tooling**: Hardcoded to `bun` in `toolRunner.ts`.

We need to refactor `core.ts` to insert new phases (Architect, Critic) and make the execution loop smarter (TDD, Polyglot).

## Plan of Work

### Phase 1: Semantic Decomposition

1.  **Create `packages/agent/src/orchestrator/reasoning/decompose-semantic.ts`**:
    - Implement `analyzeDependencyGraph(files: string[])` using import parsing (simple regex or tree-sitter if available, regex for MVP).
    - Implement `clusterFeatures(graph)` to group files by feature (e.g., "Auth" = schema + api + login-form) rather than layer.
2.  **Update `decomposeTask`**:
    - Switch from `classifyPath` (buckets) to `clusterFeatures`.
    - Return tasks ordered by dependency (DB > API > UI).

### Phase 2: Architecture & Critique

1.  **Create `packages/agent/src/orchestrator/agents/architect.ts`**:
    - Prompt: "You are a System Architect. Produce a TECHNICAL SPEC."
    - Output: `ARCHITECTURE.md` containing schema changes, API contracts, and security notes.
2.  **Create `packages/agent/src/orchestrator/agents/critic.ts`**:
    - Prompt: "You are a Senior Code Reviewer. Critique this Plan."
    - Input: `ARCHITECTURE.md` + ExecPlans.
    - Output: Approval or Rejection with specific feedback.
3.  **Update `core.ts`**:
    - Insert `executeArchitectPhase` before `executePlanPhase`.
    - Insert `executeCriticPhase` after `executePlanPhase`.
    - If Critic rejects, loop back to Planner (max retries).

### Phase 3: Polyglot Tooling

1.  **Create `packages/agent/src/utils/project-detector.ts`**:
    - Detect `package.json` (Node), `Cargo.toml` (Rust), `go.mod` (Go), `pyproject.toml` (Python).
    - Return config object: `{ type: "rust", testCmd: "cargo test", runCmd: "cargo run" }`.
2.  **Update `toolRunner.ts`**:
    - Accept `ProjectConfig`.
    - Replace hardcoded `bun test` with `config.testCmd`.
3.  **Update `core.ts`**:
    - Run detection in `Scan` phase.
    - Store config in `RuntimeState`.

### Phase 4: Test-Driven Development (TDD)

1.  **Update `AgentSpec` in `spawn.ts`**:
    - Add `mandateTDD: boolean`.
2.  **Update `core.ts` Act Loop**:
    - Before `toolCodex.execute` (Implementation), run a "Test Gen" step.
    - Agent Prompt: "Write a FAILING test case that reproduces the requirement."
    - Verify test fails.
    - Then run Implementation Agent.
    - Verify test passes.

### Phase 5: Ephemeral Verification

1.  **Update `toolDocker.ts`**:
    - Ensure `exec.probe` is robust.
2.  **Create `packages/agent/src/orchestrator/verification/smoke.ts`**:
    - Logic to start app (using ProjectConfig `runCmd`) in Docker (detached).
    - Loop `curl localhost:PORT` until 200 OK or timeout.
3.  **Update `core.ts` Review Phase**:
    - Add `type: "smoke"` check to `ReviewPlan`.
    - Execute smoke test.

### Phase 6: Visual Verification

1.  **Add `playwright` to `packages/agent` dependencies**.
2.  **Create `packages/agent/src/orchestrator/tool/browser.ts`**:
    - Expose `screenshot(url)` tool.
3.  **Update `core.ts`**:
    - If `ReviewPlan` includes UI changes, trigger `VisualVerifier`.
    - Agent compares screenshot against description/expectations.

## Concrete Steps

### Step 1: Verify Environment
```bash
ls packages/agent/src/orchestrator
```

### Step 2: Semantic Decomposition
```bash
# Create new decomposer module
touch packages/agent/src/orchestrator/multi/decompose-semantic.ts
# (Implementation details in code)
```

### Step 3: Architect Agent
```bash
touch packages/agent/src/orchestrator/multi/architect.ts
```

### Step 4: Critic Agent
```bash
touch packages/agent/src/orchestrator/multi/critic.ts
```

## Validation and Acceptance

1.  **Start a complex workflow**: "Add a blog feature with database and frontend."
2.  **Observe Architecture**: Verify `ARCHITECTURE.md` is created and sensible.
3.  **Observe Plan**: Verify tasks are "Database" then "API" then "Frontend" (not "Backend" then "Frontend").
4.  **Observe Critique**: Inject a bad plan (manually or via mock) and verify Critic rejects it.
5.  **Observe TDD**: Verify a test file is created *before* the feature code.
6.  **Observe Polyglot**: Run in a dummy Rust repo and verify `cargo test` is called.

## Idempotence and Recovery

- All agents produce files on disk.
- `core.ts` Hydration (Phase 13) ensures we can resume if the server crashes during any phase.
- Docker containers are cleaned up via `createdContainers` tracking.

## Interfaces and Dependencies

- **New Interface**: `ProjectConfig` in `types.ts`
    ```typescript
    type ProjectConfig = {
      language: "node" | "rust" | "python" | "go" | "unknown";
      testCommand: string;
      runCommand: string;
      installCommand: string;
    }
    ```
- **New Agent Role**: `architect` and `critic` in `toolCodex` prompts.
```
