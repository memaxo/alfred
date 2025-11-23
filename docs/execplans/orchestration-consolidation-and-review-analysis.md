# Orchestration Consolidation & Review Phase Analysis

**Date:** 2025-11-22  
**Scope:** Architecture investigation into orchestrator module consolidation and review phase ROI.  
**Status:** Analysis Complete.

## 1. Orchestrator Consolidation Strategy

### Current Architecture Friction
The orchestration logic is currently split between two packages:
- **`packages/agent/src/orchestrator`**: Contains domain definitions (`spawn.ts`, `AgentSpec`), decomposition logic (`decompose.ts`), and execution planning (`execplan.ts`).
- **`packages/runtime/src/orchestrator`**: Contains the execution runtime (`waves.ts`, `review.ts`, `merge.ts`) and state management (`tracker.ts` logic is split).

**Circular Dependency Risk:**
- `runtime` heavily imports from `agent` (e.g., `runtime/waves.ts` imports `buildAgentSpec` from `agent`).
- `agent` occasionally needs types from `runtime` (e.g., `WorkflowEvent`), creating fragility or forcing types into `@alfred/type` prematurely.
- **Cognitive Overhead:** Developers must mentally map whether "planning a wave" belongs to `agent` (logic) or `runtime` (execution).

### Proposal: Unify into `packages/core` (or `packages/orchestrator`)
A dedicated package for the orchestration engine would resolve these issues.

**Proposed Structure (`packages/orchestrator`):**
```
packages/orchestrator/
  src/
    definitions/      # AgentSpec, WavePlan, SubTask (from agent)
    planning/         # Decompose, ExecPlan generation (from agent)
    execution/        # Waves, Merge, Review execution loops (from runtime)
    tools/            # Tool definitions (from agent)
    state/            # Tracker, History (from runtime)
```

**Action Plan:**
1.  Move `packages/agent/src/orchestrator/*` to `packages/runtime/src/orchestrator/`.
2.  Rename `packages/runtime` to `packages/orchestrator` (or keep `runtime` as the unified home).
3.  Update `packages/api` to import from the unified location.

**Pros:**
- Single source of truth for "how an agent runs".
- Eliminates circular imports between `agent` and `runtime`.
- Simplifies `packages/agent` to focus purely on *Assistant* logic (chat, persona), not *Autonomous* logic (loops).

**Cons:**
- Large refactor diff.
- Requires updating all imports in `api`.

**Recommendation:** Phase this in. Start by moving `agent/src/orchestrator` code *into* `runtime/src/orchestrator` to colocate it, making `runtime` the definitive owner of autonomous loops. `agent` should just be the "personality" layer.

---

## 2. Review Phase ROI Analysis

### The Current Mechanism
The `runReviewPhase` in `runtime/src/orchestrator/review.ts` performs the following:
1.  **Build Plan:** Deterministically lists `tests`, `lint`, `static`, `scenario` based on file hints.
2.  **Generate ExecPlan:** Writes a markdown skeleton.
3.  **Planning Agent:** Spawns an LLM to "Plan" the checks (literally just reading the skeleton and deciding to run `bun test`). **(Redundant)**
4.  **Execution:** Runs the commands.
5.  **Fixer Loop:** If checks fail, spawns a "Fixer Agent" to read errors and auto-edit code.

### Value Assessment

| Component | Value | Cost (Latency/Tokens) | Verdict |
| :--- | :--- | :--- | :--- |
| **Deterministic Checks** | High | Zero (Local compute) | **Keep** (Run `typecheck`, `lint`, `test` blindly). |
| **Planning Agent** | **Negative** | High (LLM call + 5-10s latency) | **Cut**. The commands are known (`project-detector` knows them). We don't need an LLM to decide to run `bun test`. |
| **Fixer Agent** | High | High (LLM call) | **Keep as Fallback**. Only spawn if deterministic checks fail. |

### The "Planning Agent" Bottleneck
The current implementation spawns a `toolCodex` agent just to *say* it's going to run tests. This adds ~10 seconds of latency and input token costs for zero decision-making value. The `ReviewPlan` object already contains the intent.

### Recommendation
**Refactor `runReviewPhase` to:**
1.  Skip the "Planning Agent".
2.  Directly execute the deterministic checks (`lint`, `typecheck`, `test`) defined in `project-detector.ts`.
3.  **IF AND ONLY IF** a check fails:
    -   Spawn the "Fixer Agent" (Self-Correction) with the error output.
    -   This turns the feature into "Auto-Fix" rather than "Review Planning".

---

## 3. Conclusion

1.  **Consolidate:** Move `packages/agent/src/orchestrator` content into `packages/runtime/src/orchestrator`. This centralizes the autonomous loop logic and kills the split-brain architecture.
2.  **Optimize Review:** Delete the "Review Planning Agent". Hardcode the execution of standard verification commands. Retain the "Fixer" loop as a high-value safety net that only costs tokens when things actually break.
