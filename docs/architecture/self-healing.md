# Self-Healing Architecture

**Status**: ✅ Complete (Verified 2025-01-27)
**Owner**: Orchestration / Cognition

The Self-Healing Architecture enables Alfred to recover autonomously from heterogeneous errors, infinite loops, and physiological stress without manual intervention. It moves from "Error Handling" (reactive) to "Cognitive Regulation" (homeostatic).

## 1. Brainstem Supervisor (Orchestration Layer)

A low-latency, deterministic monitor that runs parallel to the agent's "Cortex" (LLM).

*   **Location**: `packages/agent/src/orchestrator/loops/supervisor.ts`
*   **Responsibility**:
    1.  **Entropy Monitoring**: Detects low-entropy thought loops (Levenshtein/Jaccard similarity > 0.85).
    2.  **Heartbeat Monitoring**: Detects zombie processes (tools silent for > 60s).
*   **Action**: Triggers a hard `SIGINT`/Interrupt signal, injecting a `Boredom` or `Heartbeat` event into the cognitive stream.

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
*   **Mechanism**:
    1.  **Detection**: `git merge-tree` checks for conflicts without dirtying the tree.
    2.  **Arbitration**: Spawns a specialized **Arbiter Agent** (Codex) to resolve conflicts if detected.
    3.  **Recovery**: The Arbiter edits files to remove markers, commits, and returns the clean branch.
*   **Outcome**: Parallel agents can edit the same files; conflicts are resolved AI-to-AI.

## 4. Episodic Dreaming (Learning Layer)

A background process that consolidates failed workflow runs into reusable heuristics.

*   **Location**: `packages/agent/src/orchestrator/learning-worker.ts` (`processDreaming()`)
*   **Mechanism**:
    1.  **Cluster**: Groups failed runs by error message similarity (first 100 chars as cluster key).
    2.  **Dream**: Synthesizes heuristic rules from clusters (e.g., "Avoid causing error: X. Previously observed N times.").
    3.  **Persist**: Stores heuristics as `kind: "heuristic"` nodes in knowledge graph with embeddings.
    4.  **Inject**: Heuristics retrieved via `findHeuristics()` in `packages/db/src/repo/codex-learning.ts` and injected into Codex prompts via `buildCodexLearningContext()`.
*   **Integration**: Enabled via `DREAMING_ENABLED` env var (default: true), runs every `DREAMING_INTERVAL_MS` (default: 6 hours).
*   **Tests**: `packages/agent/test/dreaming-heuristic-integration.test.ts`, `packages/db/test/dreaming-heuristic-retrieval.test.ts`

## Observability

These systems expose metrics to Prometheus (`@alfred/api/metrics.ts`):
*   `cognitive_physiology_gauge`
*   `cognitive_entropy_events_total`
