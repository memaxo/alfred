# Investigation: Partial Cognitive Components

**Date**: 2025-01-27  
**Status**: Investigation Complete  
**Related**: ALF-142

## Summary

Investigation of two partial cognitive components:

1. **Conflict Arbiter** - Implementation exists but not used by runtime
2. **Dreaming/Heuristics** - Learning context injection works, automatic dreaming not implemented

## 1. Conflict Arbiter

### Current State

**Implementation**: `packages/agent/src/orchestrator/conflict.ts`

- ✅ Fully implemented with tests
- ✅ Creates isolated worktree for conflict resolution
- ✅ Spawns Codex agent to resolve conflicts
- ✅ Commits resolution and returns resolved branch
- ✅ Comprehensive test coverage (`conflict.test.ts`, `conflict.arbiter.test.ts`)

**Runtime Integration**: `packages/runtime/src/orchestrator/conflict.ts`

- ✅ Handles conflicts that already exist in workspace (passive scanning)
- ✅ Spawns Codex directly for analysis and resolution
- ❌ Does NOT use `conflictArbiter.resolve()` abstraction

### The Gap

**Two Different Use Cases:**

1. **Branch-to-Branch Merges** (Arbiter's design):
   - When merging agent worktrees back to main
   - `executeMergePlan` detects conflicts during `git merge`
   - Currently: Returns conflict status, doesn't resolve
   - Should: Call `conflictArbiter.resolve()` to resolve in isolated worktree

2. **Workspace Conflict Resolution** (Runtime's current approach):
   - Conflicts already exist in workspace (from passive scanning)
   - Runtime spawns Codex directly to resolve
   - This is a different flow and doesn't need the arbiter abstraction

### Where Arbiter Should Be Integrated

**Location**: `packages/runtime/src/orchestrator/merge.ts` → `executeMergePlan`

**Current Flow**:

```typescript
// executeMergePlan detects conflict
if (mergeResult.status === "conflict") {
  return { status: "conflict", conflictBranch, conflictFiles };
}
```

**Proposed Flow**:

```typescript
if (mergeResult.status === "conflict") {
  // Try arbiter resolution if auto level allows
  if (input.auto === "medium" || input.auto === "high") {
    const arbiterResult = await conflictArbiter.resolve(
      workspace,
      runId,
      targetBranch,
      conflictBranch,
      authz,
      userId
    );
    if (arbiterResult.status === "resolved") {
      // Continue merge with resolved branch
    }
  }
  return { status: "conflict", conflictBranch, conflictFiles };
}
```

### Recommendation

**Option A: Integrate Arbiter** (Recommended)

- Call `conflictArbiter.resolve()` from `executeMergePlan` when conflicts detected
- Provides isolated worktree safety and proper abstraction
- Maintains existing runtime conflict phase for workspace conflicts

**Option B: Document as Separate Use Case**

- Keep arbiter for future branch-to-branch merge scenarios
- Runtime conflict phase handles workspace conflicts differently
- Both approaches are valid for different contexts

**Decision**: Option A - Integrate arbiter for branch merges, keep runtime phase for workspace conflicts.

## 2. Dreaming/Heuristics

### Current State

**Learning Context Injection**: ✅ Working

- `buildCodexLearningContext()` retrieves similar Codex executions
- Injects context into Codex prompts
- Location: `packages/db/src/repo/codex-learning.ts`

**Explicit Heuristic Creation**: ✅ Working

- `learn_mistake` tool creates heuristics from explicit user input
- Stores as `heuristic` nodes in knowledge graph
- Location: `packages/agent/src/orchestrator/tool/learning/exec.ts`

**Automatic Dreaming**: ❌ Not Implemented

- `processUnlearnedRuns()` only processes `status = "completed"` runs
- Extracts general knowledge (facts, insights, patterns), not failure-specific heuristics
- Failed runs (`status = "failed"`) are never analyzed
- No automatic creation of "avoid this mistake" heuristics from failures

### The Gap

**What "Dreaming" Should Do**:

1. Process failed workflow runs (`status = "failed"`)
2. Analyze `errorMessage` and execution context
3. Extract failure patterns and root causes
4. Automatically create heuristic nodes with "avoid this" rules
5. Inject these heuristics into future similar workflows

**Current Limitation**:

```typescript
// packages/agent/src/orchestrator/learning-worker.ts:446
.where(
  and(eq(workflowRuns.status, "completed"), isNull(workflowRuns.learnedAt))
)
```

Only completed runs are processed. Failed runs are ignored.

### Recommendation

**Option A: Implement Automatic Dreaming** (Recommended)

- Add `processFailedRuns()` function to analyze failed runs
- Extract failure patterns from `errorMessage` and `stateData`
- Create heuristic nodes automatically (similar to `learn_mistake` but automated)
- Filter by failure patterns to avoid noise (e.g., transient errors)

**Option B: Document as Future Enhancement**

- Current learning system focuses on successful patterns
- Failure analysis requires more sophisticated pattern detection
- Keep explicit `learn_mistake` tool for now

**Decision**: Option A - Implement basic automatic dreaming for failed runs.

## Implementation Plan

### Phase 1: Conflict Arbiter Integration

1. **Modify `executeMergePlan`** (`packages/agent/src/orchestrator/multi/merge-executor.ts`)
   - Import `conflictArbiter` from `@alfred/agent/orchestrator/conflict`
   - When conflict detected, check `auto` level
   - Call `conflictArbiter.resolve()` if `auto === "medium" || auto === "high"`
   - Continue merge with resolved branch if successful

2. **Update Tests**
   - Add integration test for arbiter resolution in merge flow
   - Verify worktree cleanup after resolution

3. **Update Documentation**
   - Document two conflict resolution paths (branch merges vs workspace conflicts)
   - Update ExecPlan status

### Phase 2: Automatic Dreaming

1. **Add `processFailedRuns()`** (`packages/agent/src/orchestrator/learning-worker.ts`)
   - Query failed runs with `errorMessage` not null
   - Extract failure patterns using knowledge extraction
   - Create heuristic nodes with "avoid" rules
   - Mark runs as analyzed (add `dreamedAt` timestamp)

2. **Pattern Extraction Logic**
   - Analyze `errorMessage` for common patterns (timeouts, validation errors, etc.)
   - Extract context from `stateData` (which tools were called, what failed)
   - Create heuristics with appropriate confidence scores

3. **Integration**
   - Call `processFailedRuns()` from learning worker main loop
   - Ensure heuristics are retrieved by `buildCodexLearningContext()`

4. **Update Tests**
   - Test failed run analysis and heuristic creation
   - Verify heuristics are injected into Codex prompts

5. **Update Documentation**
   - Document automatic dreaming process
   - Update ExecPlan status

## Verification Checklist

### Conflict Arbiter

- [ ] Arbiter called from `executeMergePlan` when conflicts detected
- [ ] Worktree isolation maintained during resolution
- [ ] Resolved branch merged successfully
- [ ] Tests pass for arbiter integration
- [ ] Documentation updated

### Automatic Dreaming

- [ ] Failed runs processed by learning worker
- [ ] Heuristics created from failure patterns
- [ ] Heuristics retrieved by `buildCodexLearningContext()`
- [ ] Tests pass for dreaming flow
- [ ] Documentation updated

## Notes

- Both components are valuable but serve different purposes than initially documented
- Conflict arbiter is for branch merges, not workspace conflicts
- Dreaming requires failure analysis, not just general knowledge extraction
- Implementation is straightforward but requires careful integration testing
