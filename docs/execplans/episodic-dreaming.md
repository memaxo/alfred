# ExecPlan: Episodic Dreaming (Offline Learning)

**Status**: Proposed
**Goal**: Synthesize "Intuitions" (Heuristics) from past failures during system idle time.

## Core Concept
The system currently records execution results. "Dreaming" is an offline process that reviews these records, specifically looking for high-frustration episodes, and distills them into compact heuristics to prevent recurrence.

## Architecture

### 1. The Mistake Ledger
Leverage existing `packages/learning/src/mistake_ledger.ts`.
- Ensure every `Frustration` spike logs a structured `Episode`.

### 2. The "Dreamer" Worker
A background job (cron/scheduler) that runs when `System.Load` is low.
- **Input**: Last 24h of `Frustrated` episodes.
- **Process**:
    1.  Cluster episodes by semantic similarity (error message, tool used).
    2.  For each cluster, ask an LLM: "What is the root cause and the fix?"
    3.  Output: A `Heuristic` rule. e.g., "Context: Python 3.12 + Pip. Rule: Use --break-system-packages."
- **Storage**: Save `Heuristic` to Graph (`Insight` node).

### 3. Intuition Injection
Update `packages/db/src/repo/codex-learning.ts` (`buildCodexLearningContext`).
- **Query**: Fetch applicable `Heuristic` nodes for the current task environment.
- **Prompt**: Inject as "Intuition": *"I have a strong feeling that `pip install` will fail unless you use..."*

## Implementation Steps

1.  [x] **Ledger Update**: Ensure `CognitiveEngine` writes to Mistake Ledger on failure. (Already handled by existing infrastructure, focused on `workflowRuns` table for this MVP).
2.  [x] **Dreamer Job**: Create `packages/agent/src/orchestrator/learning-worker.ts` (or update existing).
3.  [x] **Heuristic Schema**: Define the Graph Node structure for `Heuristic` (Context Vector + Text Rule). (Implemented via `upsertNodes` with `kind="heuristic"`).
4.  [x] **Injection**: Wire up the retrieval in `codex-learning.ts`.

## Progress
- [x] Implemented `processDreaming` in `learning-worker.ts`.
- [x] Implemented heuristic retrieval and injection in `codex-learning.ts`.
- [x] Added configuration to `env.example`.
- [x] Verified with integration test.

## Benefits
- **Anti-Fragility**: The system gets stronger with every error.
- **Efficiency**: Fixes are learned once and applied forever, preventing repeated token waste on known issues.

## Risks
- **Bad Habits**: The system might "learn" a wrong heuristic (e.g., "Always skip tests").
- **Mitigation**: Heuristics should have a confidence score and decay if they don't solve the problem.

## Verification
- **Test**: `packages/agent/test/dreaming.test.ts` (Ran as `dreaming.integration.test.ts` and passed).
- **Scenario**:
    - Inject 3 failures of "Error X".
    - Run Dreamer.
    - Verify new Heuristic exists.
    - Run Agent. Verify Heuristic is in prompt. (Verified heuristic existence via test).
