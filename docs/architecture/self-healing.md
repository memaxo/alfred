# Self-Healing Architecture

**Status**: ✅ Complete (Updated 2025-12-20)
**Owner**: Orchestration / Cognition

The Self-Healing Architecture enables Alfred to recover autonomously from heterogeneous errors, infinite loops, and physiological stress without manual intervention. It moves from "Error Handling" (reactive) to "Cognitive Regulation" (homeostatic).

## 1. Brainstem Supervisor (Orchestration Layer)

A low-latency, deterministic monitor that runs parallel to the agent's "Cortex" (LLM).

*   **Location**: `packages/cognitive/src/brainstem.ts` (implementation), `packages/runtime/src/core.ts` (integration)
*   **Status**: ✅ Complete
*   **Responsibility**:
    1.  **Entropy Monitoring**: Detects low-entropy loops via layered checks culminating in embedding similarity (cosine similarity is canonical).
    2.  **Heartbeat Monitoring**: Detects zombie processes (tools silent for > 60s).
*   **Action**: Triggers a hard interrupt signal, injecting an `interrupt` event into the cognitive stream via `runCognitiveLoop()`.
*   **Integration**: Fully integrated into `WorkflowRuntime` - supervisor observes workflow events, detects loops/heartbeat failures, bridges to cognitive loop, and fails workflows gracefully.
*   **Tests**: `packages/runtime/test/supervisor.integration.test.ts` - Comprehensive tests including cognitive loop bridge verification

## 2. Cognitive Physiology (State Layer)

Augments the functional `CognitiveState` with homeostatic variables that regulate autonomy.

*   **Location**: `packages/cognitive/src/state.ts`
*   **Metrics**:
    *   `energy` (0..1): Decays per step. Low energy reduces risk appetite.
    *   `frustration` (0..1): Spikes on error. High frustration (>0.7) halves autonomy.
    *   `boredom` (0..1): Spikes on loop detection. High boredom increases temperature (planned).
*   **Integration**: `updateAutonomy` now accepts `Physiology` to enforce constraints naturally.

## 3. Arbiter (Conflict Resolution)

Implements Optimistic Concurrency Control for multi-agent waves.

*   **Location**: `packages/agent/src/orchestrator/conflict.ts`
*   **Status**: ✅ Complete
*   **Mechanism**:
    1.  **Detection**: Uses `git merge --no-commit --no-ff` to detect conflicts (not `git merge-tree` as originally planned).
    2.  **Arbitration**: Spawns a specialized **Arbiter Agent** (Codex) to resolve conflicts if detected.
    3.  **Recovery**: The Arbiter edits files to remove markers, commits, and returns the clean branch.
*   **Outcome**: Parallel agents can edit the same files; conflicts are resolved AI-to-AI.
*   **Integration**:
    *   Branch-to-branch merge conflicts are now automatically arbitrated from `executeMergePlan` (`packages/agent/src/orchestrator/multi/merge-executor.ts`) when `auto ∈ {"medium","high"}`.
    *   The runtime conflict phase (`packages/runtime/src/orchestrator/conflict.ts`) remains a separate flow for resolving conflict markers already present in the workspace.

## 4. Dreaming (Offline Learning)

Automatic heuristic generation from failed workflow runs.

*   **Location**: `packages/agent/src/orchestrator/learning-worker.ts`
*   **Status**: ✅ Complete
*   **Current State**:
    1.  **Learning Context Injection**: ✅ Complete - `buildCodexLearningContext()` retrieves similar Codex executions and injects into prompts
    2.  **Explicit Heuristics**: ✅ Complete - `learn_mistake` tool creates heuristic nodes from user input
    3.  **Automatic Dreaming**: ✅ Complete - `processFailedRuns()` analyzes failed runs (`status = "failed"`, `dreamedAt IS NULL`) and persists `kind="heuristic"` nodes under `resource="user"` with stable hash deduplication.
*   **Integration**:
    *   Failed-run heuristics are injected into Codex prompts via `buildCodexHeuristicContext()` (`packages/db/src/repo/codex-learning.ts`) alongside the existing similar-executions context.

## Observability

These systems expose metrics to Prometheus (`@alfred/api/metrics.ts`):
*   `cognitive_physiology_gauge`
*   `cognitive_entropy_events_total`
