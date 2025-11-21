# Runtime Refactor: Self-Healing & Domain-Driven Design

This ExecPlan defines the architectural refactor to make the orchestration system composable, lean, and self-healing.

## Purpose / Big Picture

The current `WorkflowRuntime` and `Orchestrator` tightly couple "business logic" (what tasks to run) with "infrastructure logic" (how to run git/docker). This makes it hard to implement advanced self-healing (checkpoints, restarts) without creating spaghetti code.

We will introduce two core Domain-Driven Design (DDD) abstractions:
1.  **Workspace**: A unified interface for the execution environment (Host, Worktree, or Container). It handles isolation, persistence, and critical "Undo" (restore) capabilities.
2.  **Phase Pipeline**: A state-machine approach to workflow execution that allows phases to signal "Escalation" (dynamic re-planning) rather than just success/failure.

## Progress

- [x] **Phase 1: Workspace Domain**
  - [x] Define `Workspace` interface (acquire, release, checkpoint, restore, exec).
  - [x] Implement `LocalWorkspace` (Tier 1/2: Git Worktrees).
  - [x] Implement `ContainerWorkspace` (Tier 3: Docker).
  - [x] Refactor `toolRunner` and `toolCodex` to accept `Workspace` context.
- [x] **Phase 2: Integration**
  - [x] Refactor `waves.ts` to use `WorkspaceFactory` instead of manual logic.
  - [x] Implement "Wave Checkpointing" (git tag before wave).
  - [x] Implement "Wave Rollback" (git reset on catastrophic failure).
- [x] **Phase 3: Pipeline Architecture**
  - [x] Define `Phase` interface (input -> result | escalate).
  - [x] Implement `PipelineRunner` in `runtime/src/pipeline`.
  - [x] Migrate `core.ts` to use `PipelineRunner`.

## Context and Orientation

- **Current State**: `packages/runtime/src/orchestrator/waves.ts` uses `WorkspaceFactory` to manage environments. Checkpointing is active for waves and agents.
- **Target State**: `core.ts` should move away from monolithic loops to a composable `PipelineRunner` that handles state transitions and escalation.

## Plan of Work

### Phase 3: Pipeline Architecture

1.  Create `packages/runtime/src/pipeline/types.ts`:
    ```typescript
    export interface Phase<Input, Output> {
      id: string;
      run(input: Input, context: RuntimeContext): Promise<PhaseResult<Output>>;
    }
    export type PhaseResult<T> = 
      | { status: "success"; data: T }
      | { status: "failure"; error: Error }
      | { status: "escalate"; reason: string; targetPhase?: string };
    ```
2.  Create `packages/runtime/src/pipeline/runner.ts`:
    - Manages the phase stack.
    - Handles `escalate` by pushing/popping phases or switching tracks.
3.  Refactor `packages/runtime/src/core.ts`:
    - Replace the hardcoded `while (true)` loop with `PipelineRunner.run(initialPhase)`.

## Concrete Steps

```bash
mkdir -p packages/agent/src/environment
touch packages/agent/src/environment/types.ts
touch packages/agent/src/environment/worktree.ts
touch packages/agent/src/environment/container.ts
touch packages/agent/src/environment/factory.ts
```

## Validation

1.  **Unit Tests**: Test `WorktreeWorkspace` by creating one, writing a file, checkpointing, deleting file, restoring, and verifying file returns.
2.  **Integration**: Run a workflow. Verify `.agent/worktrees` are created and cleaned up. Verify Docker containers are spawned and killed.
