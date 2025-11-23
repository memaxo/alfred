# ExecPlan: Arbiter Conflict Resolution

**Status**: Proposed
**Goal**: Handle multi-agent write conflicts gracefully using an Optimistic Concurrency + Arbitration model.

## Core Concept
When multiple agents (waves) edit the same repo, Git Worktrees isolate them during execution. However, merging back to `main` can fail. Instead of crashing the workflow, we spawn a specialized "Arbiter" agent to resolve the conflict logically.

## Architecture

### 1. Optimistic Merge
- **Current**: `git merge <branch>` -> Fail on conflict.
- **New**: `git merge-tree <base> <branch1> <branch2>` (server-side merge).
- **Detection**: Check exit code/output of merge command.

### 2. The Arbiter Agent
If a conflict is detected:
1.  **Pause**: The workflow holds the commit.
2.  **Spawn**: A new Agent with `Arbiter` profile/system prompt.
3.  **Context**:
    - "Branch A changed lines 10-20."
    - "Branch B changed lines 15-25."
    - "Goal: Merge these changes preserving both intents."
4.  **Action**: The Arbiter generates the resolved file content.
5.  **Commit**: The workflow applies the resolution and completes the merge.

### 3. Location
- `packages/agent/src/orchestrator/tool/worktree.ts`: Add `safeMerge` method.
- `packages/agent/src/orchestrator/conflict.ts`: Logic for spawning the Arbiter.

## Implementation Steps

1.  **Merge Logic**: Update `worktreeManager` to try a dry-run merge first.
2.  **Arbiter Prompt**: Create a specific system prompt for conflict resolution (highly logical, zero creativity).
3.  **Recovery Flow**: In `waves.ts`, wrap the "Merge" phase in a try-catch.
    - Catch `MergeConflict`.
    - Call `resolveConflict(conflictData)`.
    - Retry Merge.

## Benefits
- **Parallelism**: Allows aggressive parallelization of agents without fear of collision.
- **Autonomy**: Keeps the human out of the loop for trivial merges (imports, formatting).

## Risks
- **Bad Merges**: The Arbiter might generate broken code that compiles but is logically wrong. (Mitigation: Run tests after Arbiter merge).
- **Infinite Arbitration**: If the Arbiter fails to resolve, we fallback to manual human intervention.

## Verification
- **Test**: `packages/agent/test/conflict.test.ts`
- **Scenario**:
    - Agent A adds function `foo()` at bottom of file.
    - Agent B adds function `bar()` at bottom of file.
    - Run Arbiter.
    - Verify both `foo()` and `bar()` exist in final file.
