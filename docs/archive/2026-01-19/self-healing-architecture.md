# Self-Healing & Neuromorphic Architecture for Robust Agents

## 1. The Fragility of Current Agent Systems

Current agent architectures (including ours) suffer from "Open Loop Fragility". They rely on the LLM to govern its own control flow. When the LLM enters a repetitive state, hallucinates a success, or waits indefinitely for a hung subprocess, the system fails because the _controller_ (the LLM) is compromised.

Common failure modes:

- **Thought Loops**: "I need to check X... I need to check X..." (Low semantic entropy).
- **Infinite Tool Regression**: `ls` -> `ls -la` -> `ls` (Cyclic graph).
- **Zombie Processes**: `cat` on a named pipe or a network request that never returns.
- **Race Conditions**: Multiple agents overwriting the same file in parallel waves.

## 2. First Principles: Neuromorphic Control Theory

To solve this without hardcoded `if-else` spaghetti code, we must adopt a **Neuromorphic** approach. Biological systems don't fix infinite loops with timeouts; they fix them with _neurotransmitters_ (boredom/dopamine depletion) and _metacognition_ (realizing "this isn't working").

We propose augmenting the current `CognitiveState` with a **Homeostatic Control Loop**.

### 2.1 The Triune Brain Architecture

1.  **Cortex (The Agent/LLM)**:
    - High intelligence, high latency.
    - Generates Plans, Code, and Reasoning.
    - _Vulnerable to loops/hallucinations._

2.  **Limbic System (The Cognitive Engine)**:
    - Medium latency.
    - Manages `AutonomyGradient`, `Confidence`, and `Frustration`.
    - _Gating mechanism for actions._

3.  **Brainstem (The Supervisor)**:
    - Zero latency, deterministic.
    - Monitors **Entropy**, **Heartbeats**, and **Resource Usage**.
    - _Hard-interrupts the Cortex._

---

## 3. Concrete Architecture Recommendations

### 3.1 The "Amygdala" Supervisor (Brainstem Layer)

**Problem**: Stuck thought loops and infinite regressions.
**Solution**: **Semantic Entropy Monitoring**.

The Orchestrator should run a parallel "Watcher" that computes the compression ratio or semantic distance of the agent's output stream in real-time.

- **Mechanism**:
  - Maintain a sliding window of the last $N$ events.
  - Calculate **Levenshtein Ratio** or **Jaccard Similarity** between current thought and previous thoughts.
  - **Entropy Drop**: If the agent repeats "I need to find the file" 3 times, similarity spikes -> Entropy drops.
- **Action**:
  - Trigger a **"Boredom Interrupt"**.
  - Inject a system message: _"You seem stuck. You have repeated this thought 3 times. Stop what you are doing and try a radically different approach."_
  - If loop continues, escalate to `CognitiveState: Reflecting` and force a re-plan.

### 3.2 Process Heartbeats (Physiological State)

**Problem**: Hung bash commands or network lags.
**Solution**: **Active Process Supervision**.

Instead of passive `await`, the Droid runner must implement an active heartbeat.

- **Mechanism**:
  - Every spawned process (Codex/Droid) has an expected "Time to First Byte" (TTFB) and "Inter-Token Arrival Time".
  - If `stdout` is silent for > `threshold` (dynamic based on task type), the Supervisor intervenes.
- **Action**:
  - Send `SIGINT` (Ctrl+C) to the subprocess.
  - Inject observation: _"The command `npm install` hung for 60 seconds with no output. It has been interrupted. Check network or try verbose mode."_

### 3.3 The "Arbiter" Agent (Conflict Resolution)

**Problem**: Agents in parallel waves overwriting each other's work.
**Solution**: **Optimistic Concurrency with Arbiter**.

We currently use Git Worktrees for isolation, which is excellent. The failure point is the _merge_.

- **Mechanism**:
  - Before merging a worktree back to `main`, run `git merge-tree` (server-side memory-only merge) to detect conflicts.
  - If conflicts exist, **DO NOT FAIL**.
- **Action**:
  - Spawn a specialized **Arbiter Agent**.
  - Task: "Agent A changed X, Agent B changed X. Here is the diff. Resolve it logically."
  - The Arbiter commits the resolution, then the wave completes.

### 3.4 Self-Healing via "Dreaming" (Offline Learning)

**Problem**: Heterogeneous errors never seen before.
**Solution**: **Episodic Memory Consolidation**.

The `mistake_ledger` (currently in `packages/learning`) is the foundation. We need to operationalize it.

- **Mechanism**:
  - **Online**: When an error occurs, tag the `CognitiveState` as `Frustrated`. Log the `{Trace, Error, Context}` tuple.
  - **Offline (Dreaming)**: During system idle time, a background job ("The Dreamer") reviews recent `Frustrated` episodes.
  - **Synthesis**: It generates a generic "Heuristic" (e.g., "When running `pip install` on this repo, always use `--no-cache-dir`").
  - **Injection**: This heuristic is added to the `codex-learning` graph and injected into future prompts as a high-priority "Intuition".

---

## 4. Implementation Roadmap

### Phase 1: The Watcher (Entropy & Heartbeats)

1.  Modify `packages/agent/src/orchestrator/tool/runner.ts` to include a `StreamMonitor`.
2.  Implement `calculateEntropy(window: string[])` utility.
3.  Wire `StreamMonitor` to `AbortController` to kill hung tools.

### Phase 2: The Limbic System (State Integration)

1.  Expand `CognitiveState` in `packages/cognitive` to include `Physiology`:
    ```typescript
    type Physiology = {
      energy: number; // Decreases with steps
      boredom: number; // Increases with repetition
      frustration: number; // Increases with errors
    };
    ```
2.  Update `AutonomyGradient` to decay based on `Physiology`. High boredom = Force Switch.

### Phase 3: The Arbiter (Git Integration)

1.  Update `worktree.ts` to implement `safeMerge(branch, target)`.
2.  If merge fails, spin up a `resolve_conflict` sub-agent using the standard Orchestrator flow.

## 5. Summary

By moving from "Error Handling" (reactive) to "Cognitive Regulation" (proactive/homeostatic), we create a system that feels _alive_. It gets bored when stuck, frustrated when failing, and asks for help (or dreams up new solutions) rather than crashing. This is the path to true Level 5 Autonomy.
