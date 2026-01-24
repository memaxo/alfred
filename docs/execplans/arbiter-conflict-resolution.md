# ExecPlan: Arbiter Conflict Resolution

**Status**: ✅ Complete
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

1.  ✅ **Merge Logic**: Conflict detection via `git merge --no-commit --no-ff` and conflict marker scanning (`packages/runtime/src/orchestrator/merge.ts`).
2.  ✅ **Arbiter Prompt**: System prompt for conflict resolution implemented (`packages/runtime/src/orchestrator/conflict.ts` lines 193-200).
3.  ✅ **Recovery Flow**: In `waves.ts`, conflict resolution integrated (`packages/runtime/src/orchestrator/waves.ts` lines 839-876):
    - Conflict detection via `mergeCheck`
    - Calls `conflictArbiter.resolve()` with Codex agent
    - Applies resolution and completes merge
4.  ✅ **Arbiter Implementation**: `conflictArbiter.resolve()` implemented (`packages/runtime/src/orchestrator/conflict.ts`).
5.  ✅ **Integration**: `runConflictPhase` implemented and integrated into orchestrator flow (`packages/runtime/src/orchestrator/index.ts` line 50).

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

### 2025-11-27 Update — Preview Worktree Cleanup (ALF-16)

- `worktreeManager.safeMerge` now registers preview cleanup intents before `git worktree add` runs, so any failure (rev-parse, add, merge) triggers retryable cleanup via a shared tracker.
- Added `flushPreviewCleanupBacklog()` to prune leaked preview directories (tracked tickets plus filesystem scans under `.agent/worktrees/**/preview-*`)—invoked on demand and before each new preview merge.
- Cleanup attempts now retry (git remove + `fs.rm`) with jitter and log `preview_worktree_cleanup_pending` when multiple passes fail so operators can diagnose stubborn worktrees.
- Coverage: `packages/agent/test/orchestrator/tool/worktree-cleanup.test.ts` validates both failure cleanup and orphan scans.
- `initApiServices()` now invokes `flushPreviewCleanupBacklog()` at startup and on a recurring interval (configurable via `WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS`) so leaked previews disappear even if no merges run for a while.
