# ExecPlan: Brainstem Supervisor (Entropy & Heartbeats)

**Status**: ✅ Complete
**Goal**: Prevent infinite loops and zombie processes by monitoring Semantic Entropy and Process Heartbeats.

## Core Concept
Agents often get stuck in loops (low semantic entropy) or wait indefinitely for hung processes (zombie state). A "Brainstem" layer—low-level, fast, and deterministic—will monitor these physiological signs and interrupt the "Cortex" (LLM) when homeostasis is lost.

## Architecture

### 1. Semantic Entropy Monitor
A stream monitoring utility that calculates the information density of the agent's output window.
- **Location**: `packages/agent/src/orchestrator/streams/entropy.ts`
- **Metric**: Levenshtein Ratio or Jaccard Similarity over a sliding window (last N=3 thoughts).
- **Trigger**: If `Similarity(Current, Previous) > 0.9` for 3 consecutive turns -> **BOREDOM_INTERRUPT**.

### 2. Active Process Heartbeats
Replace passive `await` for subprocesses with an active heartbeat monitor.
- **Location**: `packages/agent/src/orchestrator/tool/runner.ts`
- **Mechanism**:
    - Wrap `Bun.spawn` streams.
    - Reset `last_byte_ts` on every chunk.
    - `setInterval` check: if `now - last_byte_ts > threshold`, kill process.
- **Dynamic Thresholds**:
    - `npm install`: 300s
    - `ls`: 5s
    - Default: 60s

### 3. The Interrupt Signal
When a monitor triggers, we must inject a signal into the cognitive loop.
- **Signal**: `InterruptEvent` with reason (`low_entropy`, `heartbeat_failure`).
- **Handling**: The `CognitiveEngine` transitions to `Reflecting` state immediately, bypassing the current `Executing` step.

## Implementation Steps

1.  ✅ **Entropy Utility**: Create `packages/agent/src/utils/entropy.ts` with string similarity functions (`detectLoop`, `jaccardSimilarity`).
2.  ✅ **Supervisor Loop**: In `packages/agent/src/orchestrator/loops/`, create a `Supervisor` class (`BrainstemSupervisor`) that holds the state of active monitors.
3.  ✅ **Integration**: Integrated into `WorkflowRuntime` (`packages/runtime/src/core.ts`):
    - Supervisor instantiated in runtime constructor
    - `observe()` method called for thought events
    - `checkPhysiology()` method called periodically for heartbeat monitoring
    - `registerProcess()` for active process tracking
    - Interrupt handling via `abortController`
4.  ✅ **Tests**: `packages/agent/test/supervisor.test.ts` exists and passes.

## Benefits
- **Robustness**: No more infinite loops costing tokens.
- **Responsiveness**: Hung tools fail fast instead of timing out after 30 minutes.
- **Bio-mimicry**: Natural "boredom" is a better control mechanism than hardcoded retries.

## Risks
- **False Positives**: Long-running valid compilations might be killed (mitigate with dynamic thresholds).
- **Repetitive Success**: Sometimes doing the same thing 5 times is correct (e.g., batch processing). We need "Semantic" entropy, not just string equality.

## Verification
- **Test**: `packages/agent/test/supervisor.test.ts`
- **Scenario 1 (Loop)**: Mock agent emitting "Thinking..." 5 times. Expect interrupt.
- **Scenario 2 (Hang)**: Mock tool sleeping for 120s. Expect kill at 60s.
