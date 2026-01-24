# Cognitive Architecture Guide

**Owner:** Cognitive  
**Last Updated:** 2025-11-26

## Purpose

This guide explains how ALFRED's cognitive architecture works end-to-end. It covers the event-sourced state machine, physiology system, autonomy gradient, brainstem supervisor, and integration with voice/chat.

## Overview

ALFRED's cognitive system is an event-sourced state machine that models cognitive processes (thinking, deciding, acting, reflecting) with physiological regulation (energy, boredom, frustration) and autonomous decision-making.

## Core Components

### 1. Cognitive State Machine

The state machine has these states:

- **`idle`** - Waiting for input
- **`capturing`** - Processing user input
- **`thinking`** - Analyzing and reasoning
- **`deciding`** - Choosing between options
- **`executing`** - Running a plan
- **`reflecting`** - Learning from outcomes

**Key Files:**

- `packages/cognitive/src/state.ts` - State type definitions
- `packages/cognitive/src/transition.ts` - Pure transition functions

### 2. Event Sourcing

All cognitive state changes are driven by events:

- **`input`** - User input received
- **`timeout`** - Operation timed out
- **`feedback`** - User feedback (positive/negative)
- **`interrupt`** - System interrupt (loop detected, etc.)
- **`outcome`** - Execution result (success/failure)

**Storage:**

- `cognitive_events` table - Immutable event log
- `cognitive_snapshots` table - Periodic state checkpoints for fast hydration

**Key Files:**

- `packages/db/src/schema/cognitive.ts` - Event/snapshot schemas
- `packages/db/src/repo/cognitive.ts` - Repository for events/snapshots
- `packages/runtime/src/loops/cognitive.ts` - Runtime loop implementation

### 3. Physiology System

Tracks cognitive "health" metrics:

- **Energy** (0..1) - Decreases with steps, increases with rest
- **Boredom** (0..1) - Increases with repetition
- **Frustration** (0..1) - Increases with errors

Physiology regulates autonomy:

- High frustration → Lower autonomy (more cautious)
- High boredom → May trigger interrupt
- Low energy → May gate execution

**Key Files:**

- `packages/cognitive/src/state.ts` - `Physiology` type, `updatePhysiology` function
- `packages/cognitive/src/logic/autonomy.ts` - `meetsConstraints` uses physiology

### 4. Autonomy Gradient

Bayesian system for autonomous decision-making:

- **Beta Prior** (`alpha`, `beta`) - Tracks success/failure history
- **Level** (0..1) - Derived from Beta mode
- **Confidence** - `1 - variance` of Beta distribution
- **Constraints** - Temporal, scope, confidence, approval gates

Autonomy updates:

- On success → Increase `alpha`
- On failure → Increase `beta`
- On feedback → Weighted update based on `strength`
- Reliability weighting → Evidence with `reliability=0` is ignored

**Key Files:**

- `packages/cognitive/src/state.ts` - `AutonomyGradient` type, `updateAutonomy` function
- `packages/cognitive/src/logic/autonomy.ts` - Autonomy logic and constraints

### 5. Brainstem Supervisor

Monitors cognitive health and interrupts loops:

- **Entropy Detection** - Detects semantic loops (repeating thoughts)
- **Heartbeat Monitoring** - Detects zombie processes (no activity)
- **Physiology Checks** - Monitors frustration/boredom thresholds

**Key Files:**

- `packages/cognitive/src/brainstem.ts` - `BrainstemSupervisor` class
- `packages/cognitive/src/loop.ts` - `LoopDetector` (COUNT → TIME → HASH → QUANTIZED)
- `packages/runtime/src/core.ts` - Integration into `WorkflowRuntime`

## The Cognitive Loop

### Flow

```
1. Load State
   ├─ Get latest snapshot (if exists)
   └─ Replay events since snapshot

2. Apply Transition
   ├─ Pure function: (State, Event) → New State
   ├─ Update physiology based on event type
   └─ Update autonomy if feedback event

3. Persist Event
   ├─ Append event to cognitive_events table
   └─ Save snapshot periodically (every N events)

4. Compute Effects
   ├─ Generate effects based on new state
   └─ Return effects for caller to execute
```

### Implementation

**Key File:** `packages/runtime/src/loops/cognitive.ts`

```typescript
export async function runCognitiveLoop(
  ctx: RuntimeContext,
  streamId: string,
  incomingEvent: Event
): Promise<CognitiveLoopResult> {
  // 1. Hydrate state from events
  const events = await cognitiveRepo.getAllEvents(streamId);
  let state = idle(Date.now());
  let autonomy = createInitialAutonomy();

  // Replay history
  for (const record of events) {
    const result = applyTransition(state, autonomy, record.payload);
    state = result.state;
    autonomy = result.autonomy;
  }

  // 2. Apply new event
  const transition = applyTransition(state, autonomy, incomingEvent);

  // 3. Persist event
  await cognitiveRepo.appendEvent(streamId, incomingEvent._, incomingEvent);

  // 4. Compute effects
  const effects = computeEffects(transition.state);

  return { state: transition.state, effects };
}
```

## Integration Points

### Voice Assistant

**File:** `packages/api/src/voice/assistant.ts`

Voice inputs feed into the cognitive loop:

```typescript
// After generating response
const result = await runCognitiveLoop(ctx, threadId, {
  _: "input",
  content: input.text,
  source: "user",
  ts: Date.now(),
});

// Handle cognitive effects
await handleVoiceCognitiveEffects({
  effects: result.effects,
  // ... other params
});
```

### Chat Interface

Chat inputs similarly feed into `runCognitiveLoop` via the assistant router.

## Effects System

Cognitive loop emits effects that callers execute:

- **`generate_response`** - Generate AI response
- **`execute_plan`** - Execute a multi-step plan
- **`log_reflection`** - Record learning outcome

Effects are pure data structures. The caller (voice assistant, chat router) executes them safely.

## Performance Budgets

- **Transitions**: <100µs (pure functions)
- **State Hydration**: <10ms (snapshot + recent events)
- **Event Persistence**: <5ms per event

All hot paths are instrumented with Prometheus metrics.

## Metrics

- `cognitive_physiology_gauge{metric}` - Energy, boredom, frustration
- `cognitive_entropy_events_total{type}` - Loop detection events
- `cognitive_autonomy_update_duration` - Autonomy calculation time
- `cognitive_physiology_update_duration` - Physiology update time

## Related Documentation

- [Cognitive Runtime Architecture](../architecture/cognitive-runtime.md) - Detailed runtime loop documentation
- [ExecPlan: Cognitive Runtime Loop](../execplans/cognitive-runtime-loop.md) - Implementation plan
- [ExecPlan: Cognitive Architecture Maturity](../execplans/cognitive-architecture-maturity.md) - Maturity improvements
