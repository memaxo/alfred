# Cognitive Runtime Architecture

**Owner:** Cognitive  
**Last Updated:** 2025-11-26

## Purpose

This document provides detailed technical documentation for ALFRED's cognitive runtime loop, including event types, state transitions, state hydration, effect handling, and voice integration.

## Overview

The cognitive runtime loop (`runCognitiveLoop`) is an event-sourced state machine that drives ALFRED's cognitive processes. It implements a pure, deterministic state machine with side effects isolated at boundaries.

## Core Components

### 1. Event Sourcing

All cognitive state changes are driven by events stored in `cognitive_events` table:

**Event Types:**

- `input` - User input received
- `timeout` - Operation timed out
- `feedback` - User feedback (positive/negative)
- `interrupt` - System interrupt (loop detected, etc.)
- `outcome` - Execution result (success/failure)
- `complete` - Operation completed

**Storage:**

- `cognitive_events` - Immutable event log
- `cognitive_snapshots` - Periodic state checkpoints for fast hydration

**Repository:** `packages/db/src/repo/cognitive.ts`

### 2. State Machine

The state machine has these states:

- **`idle`** - Waiting for input
- **`capturing`** - Processing user input
- **`thinking`** - Analyzing and reasoning
- **`deciding`** - Choosing between options
- **`executing`** - Running a plan
- **`reflecting`** - Learning from outcomes

**Transition Function:** `applyTransition(state, autonomy, event)` - Pure function meeting <100µs budget

**Implementation:** `packages/cognitive/src/transition.ts`

### 3. Physiology System

Tracks cognitive "health" metrics:

- **Energy** (0..1) - Decreases with steps, increases with rest
- **Boredom** (0..1) - Increases with repetition
- **Frustration** (0..1) - Increases with errors

Physiology updates based on event types:

- `step` - Decreases energy
- `success` - Increases energy, decreases frustration
- `error` - Increases frustration
- `entropy_high` - Increases boredom

**Function:** `updatePhysiology(physiology, eventType)` - Pure function

**Implementation:** `packages/cognitive/src/state.ts` lines 305-350

### 4. Autonomy Gradient

Bayesian system for autonomous decision-making:

- **Beta Prior** (`alpha`, `beta`) - Tracks success/failure history
- **Level** (0..1) - Derived from Beta mode
- **Confidence** - `1 - variance` of Beta distribution

Autonomy updates:

- On success → Increase `alpha`
- On failure → Increase `beta`
- On feedback → Weighted update based on `strength`
- Reliability weighting → Evidence with `reliability=0` is ignored

**Function:** `updateAutonomy(timestamp, autonomy, evidence, physiology)` - Pure function

**Implementation:** `packages/cognitive/src/state.ts`

## The Runtime Loop

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

**File:** `packages/runtime/src/loops/cognitive.ts`

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

### State Hydration

**Current Implementation:** Replays all events (simplified)

**Future Optimization:** Use snapshots + events since snapshot:

```typescript
// Optimized hydration (pending)
const snapshot = await cognitiveRepo.getLatestSnapshot(streamId);
let state = snapshot ? hydrateFromSnapshot(snapshot) : idle(Date.now());
const events = await cognitiveRepo.getEventsSince(streamId, snapshot.createdAt);
// Replay only recent events
```

**Repository Functions:**

- `getAllEvents(streamId)` - Get all events (current)
- `getLatestSnapshot(streamId)` - Get latest snapshot (future)
- `getEventsSince(streamId, since)` - Get events since timestamp (future)

### Transition Function

**Pure Function:** `applyTransition(state, autonomy, event)`

**Budget:** <100µs

**Instrumentation:** Wrapped with `performance.now()` timer and Prometheus histogram

**Implementation:** `packages/cognitive/src/transition.ts`

**State Transitions:**

```
idle + input → thinking
thinking + complete → reflecting
reflecting → idle
[all states] + interrupt → idle (with updated physiology)
```

### Effect Computation

Effects are pure data structures returned for caller to execute:

**Effect Types:**

- `generate_response` - Generate AI response
- `execute_plan` - Execute a multi-step plan
- `log_reflection` - Record learning outcome

**Function:** `computeEffects(state)` - Pure function

**Implementation:** `packages/runtime/src/loops/cognitive.ts` lines 128-136

## Voice Integration

### Input Flow

Voice inputs feed into the cognitive loop:

**File:** `packages/api/src/voice/assistant.ts` lines 173-195

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
  runtimeCtx: ctx,
  runLoop: runCognitiveLoop,
  streamId: threadId,
  effects: result.effects,
  sanitized,
  durationSeconds,
});
```

### Effect Handling

Cognitive effects are handled by voice assistant:

**`generate_response` effect:**

- Already handled (response generated before cognitive loop)
- Emit `complete` event with outcome

**`execute_plan` effect:**

- Execute plan via `PlanRunner`
- Emit `complete` event with outcome

**`log_reflection` effect:**

- Record outcome to learning system
- Update knowledge graph

## Performance Budgets

- **State Hydration**: <10ms (snapshot + recent events)
- **Transitions**: <100µs (pure functions)
- **Event Persistence**: <5ms per event
- **Effect Computation**: <1ms (pure function)

All hot paths are instrumented with Prometheus metrics.

## Metrics

Prometheus metrics exposed on `/api/metrics`:

- `cognitive_physiology_gauge{metric}` - Energy, boredom, frustration
- `cognitive_entropy_events_total{type}` - Loop detection events
- `cognitive_transition_duration` - Transition calculation time
- `cognitive_autonomy_update_duration` - Autonomy calculation time
- `cognitive_physiology_update_duration` - Physiology update time

**Location:** `packages/api/src/metrics.ts`

## Error Handling

### Event Persistence Failures

If event persistence fails:

- Log error with structured context
- Return effects anyway (non-blocking)
- Caller can retry persistence

### State Hydration Failures

If state hydration fails:

- Start with `idle` state
- Log error with structured context
- Continue with new event

### Transition Failures

If transition fails:

- Log error with structured context
- Return current state (no change)
- Emit error effect

## Testing

### Unit Tests

**File:** `packages/runtime/test/cognitive-loop.test.ts`

Tests cover:

- State hydration from events
- Transition correctness
- Effect computation
- Error handling

### Integration Tests

**File:** `packages/runtime/test/cognitive-loop.integration.test.ts`

Tests cover:

- Full loop execution
- Event persistence
- Voice integration
- Effect handling

## Future Improvements

### Snapshot Optimization

- Implement snapshot-based hydration
- Save snapshots periodically (every N events)
- Reduce event replay overhead

### Parallel Event Processing

- Process independent events in parallel
- Maintain determinism via event ordering

### Event Compression

- Compress old events
- Archive to cold storage
- Keep recent events hot

## Related Documentation

- [Cognitive Architecture Guide](../guides/cognitive-architecture.md) - High-level overview
- [ExecPlan: Cognitive Runtime Loop](../execplans/cognitive-runtime-loop.md) - Implementation plan
- [ExecPlan: Cognitive Architecture Maturity](../execplans/cognitive-architecture-maturity.md) - Maturity improvements
