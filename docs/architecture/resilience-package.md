# Resilience Package Architecture

## Purpose

The `@alfred/resilience` package provides battle-tested primitives for building resilient async operations and workflows. It extracts patterns from pipeline and agent execution that prevent common failure modes: hung operations, infinite loops, and stuck workflows.

## Why It Exists

Before this package, resilience patterns were duplicated across `@alfred/pipeline`, `@alfred/agent`, and `@alfred/runtime`. Each implementation had subtle differences, making it hard to:

- Reason about abort signal propagation
- Configure MAX_TRANSITIONS consistently  
- Handle escalation uniformly
- Test resilience behavior in isolation

This package consolidates these patterns with clear semantics and comprehensive test coverage.

## Design Principles

### 1. Composable Primitives

Each module provides focused utilities that compose together:

```typescript
// Combine abort signals and guard transitions
const controller = combineAbortSignals(userSignal, timeoutSignal);
const guard = new TransitionGuard(50);

await guardedLoop(
  () => hasWork() && !controller.signal.aborted,
  async () => {
    await doWork();
    guard.tick();
  }
);
```

### 2. Zero Runtime Overhead

All utilities are lightweight wrappers around native JavaScript primitives:
- `AbortSignal` and `AbortController` (native)
- Simple counter for transition guard
- Map-based storage for escalation history

No frameworks, no heavy dependencies.

### 3. Type-Safe APIs

Every function and class has precise TypeScript types:

```typescript
// Type inference works correctly
const result = await raceWithAbort(
  fetchData(),  // Promise<Data>
  signal
); // result: Data (throws on abort)
```

## Module Overview

### Abort Module (`abort.ts`)

**Purpose:** Manage AbortSignal propagation across async boundaries.

**Key Functions:**
- `createLinkedAbortController(parent)` - Child signal that aborts with parent
- `raceWithAbort(operation, signal)` - Race against abort with proper typing
- `combineAbortSignals(...signals)` - Merge multiple signals into one

**Common Use Case:** Propagating user cancellation through nested async operations.

```typescript
async function complexOperation(parentSignal: AbortSignal) {
  const childController = createLinkedAbortController(parentSignal);
  
  try {
    await raceWithAbort(
      performSteps(childController.signal),
      childController.signal
    );
  } finally {
    childController.abort(); // Clean up
  }
}
```

### Transitions Module (`transitions.ts`)

**Purpose:** Prevent infinite loops in state machines and workflows.

**Key Classes:**
- `TransitionGuard` - Counter with configurable max limit
- `guardedLoop()` - Protected iteration with callbacks

**Common Use Case:** Detecting stuck workflows in orchestration.

```typescript
const guard = createGuardFromEnv("MAX_WORKFLOW_TRANSITIONS", 50);

while (workflow.needsTransition()) {
  guard.tick(); // Throws if exceeded
  await workflow.transition();
}
```

### Escalation Module (`escalation.ts`)

**Purpose:** Detect and handle stuck workflows with recovery mechanisms.

**Key Classes:**
- `EscalationDetector` - Centralized escalation handling
- `detectStuck()` - Multi-signal stuck detection

**Common Use Case:** Monitoring long-running workflows for stuck conditions.

```typescript
const detector = new EscalationDetector();

detector.onEscalation(async (event) => {
  logger.error("Workflow stuck", event);
  await notifyOps(event);
});

// During workflow execution
const reason = detectStuck(config, {
  transitionCount: guard.getCount(),
  elapsedMs: Date.now() - startTime,
  errorCount: errors.length,
});

if (reason) {
  await detector.escalate({
    reason,
    context: { runId, attemptCount },
    timestamp: new Date(),
  });
}
```

## Integration Points

### Pipeline Integration

```typescript
// packages/pipeline/src/runner.ts
import { TransitionGuard, EscalationDetector } from "@alfred/resilience";

class PipelineRunner {
  private guard = new TransitionGuard(50);
  private detector = new EscalationDetector();
  
  async execute(ctx: PipelineContext) {
    while (this.needsTransition(ctx)) {
      this.guard.tick();
      await this.transition(ctx);
    }
  }
}
```

### Agent Integration

```typescript
// packages/agent/src/executor.ts
import { createLinkedAbortController, raceWithAbort } from "@alfred/resilience/abort";

async function executeAgent(parentSignal: AbortSignal) {
  const controller = createLinkedAbortController(parentSignal);
  
  return raceWithAbort(
    runAgentSession(controller.signal),
    controller.signal,
    "Agent execution cancelled"
  );
}
```

### Runtime Integration

```typescript
// packages/runtime/src/workflow.ts
import { detectStuck, defaultEscalationDetector } from "@alfred/resilience/escalation";

async function monitorWorkflow(runId: string) {
  const reason = detectStuck(config, workflowMetrics);
  
  if (reason) {
    await defaultEscalationDetector.escalate({
      reason,
      context: { runId },
      timestamp: new Date(),
    });
  }
}
```

## Testing Strategy

The package uses three testing approaches:

### 1. Unit Tests (per module)

Test each utility in isolation:

```typescript
test("createLinkedAbortController aborts child when parent aborts", () => {
  const parent = new AbortController();
  const child = createLinkedAbortController(parent.signal);
  
  expect(child.signal.aborted).toBe(false);
  parent.abort();
  expect(child.signal.aborted).toBe(true);
});
```

### 2. Integration Tests (cross-module)

Test utilities working together:

```typescript
test("guarded loop with abort signal", async () => {
  const controller = new AbortController();
  const guard = new TransitionGuard(10);
  
  let count = 0;
  await guardedLoop(
    () => !controller.signal.aborted,
    () => {
      guard.tick();
      count++;
      if (count > 5) controller.abort();
    }
  );
  
  expect(count).toBe(6);
});
```

### 3. Behavioral Tests (from consumers)

Test behavior when integrated into pipeline/agent:

```typescript
test("pipeline respects abort signal", async () => {
  const controller = new AbortController();
  const runner = new PipelineRunner();
  
  setTimeout(() => controller.abort(), 100);
  
  await expect(
    runner.run(ctx, controller.signal)
  ).rejects.toThrow("pipeline_aborted");
});
```

## Performance Characteristics

All utilities are designed for minimal overhead:

- **Abort utilities**: O(1) signal creation, O(n) for combining n signals
- **Transition guard**: O(1) per tick (simple counter increment)
- **Escalation detector**: O(1) escalation emission, O(m) history lookup for m events

Memory usage:
- Abort controllers: ~100 bytes per controller
- Transition guard: ~50 bytes (single counter)
- Escalation detector: ~200 bytes + (n events × event size)

## Common Pitfalls

### 1. Forgetting to cleanup abort listeners

```typescript
// ❌ Wrong: listener leaks memory
const onAbort = () => cleanup();
signal.addEventListener("abort", onAbort);

// ✅ Correct: cleanup listener
signal.addEventListener("abort", onAbort);
signal.addEventListener("abort", () => {
  signal.removeEventListener("abort", onAbort);
  cleanup();
});
```

### 2. Not propagating signals through async calls

```typescript
// ❌ Wrong: signal not passed to nested call
async function outer(signal: AbortSignal) {
  await inner(); // Can't be cancelled!
}

// ✅ Correct: signal propagated
async function outer(signal: AbortSignal) {
  await inner(signal);
}
```

### 3. Setting MAX_TRANSITIONS too low

```typescript
// ❌ Wrong: fails for legitimate complex workflows
const guard = new TransitionGuard(5);

// ✅ Correct: reasonable limit based on workflow complexity
const guard = new TransitionGuard(50);
```

## Migration Guide

### From inline abort handling

**Before:**
```typescript
const controller = new AbortController();
if (parent.aborted) controller.abort();
parent.addEventListener("abort", () => controller.abort());
```

**After:**
```typescript
const controller = createLinkedAbortController(parent);
```

### From manual loop guards

**Before:**
```typescript
let count = 0;
while (hasWork()) {
  if (++count > MAX) throw new Error("Loop exceeded");
  await work();
}
```

**After:**
```typescript
await guardedLoop(
  () => hasWork(),
  async () => await work(),
  { maxIterations: MAX }
);
```

### From ad-hoc stuck detection

**Before:**
```typescript
if (transitions > max || time > timeout || errors > maxErrors) {
  logger.error("Stuck!");
  // Manual recovery logic
}
```

**After:**
```typescript
const reason = detectStuck(config, { transitions, time, errors });
if (reason) await detector.escalate({ reason, context, timestamp });
```

## Future Enhancements

Potential additions (not yet implemented):

1. **Retry policies** - Exponential backoff, circuit breakers
2. **Rate limiting** - Token bucket, sliding window
3. **Deadline propagation** - Context-style deadlines with hierarchies
4. **Metrics integration** - Automatic Prometheus metrics for guards/escalations

These would extend the package while maintaining the core principle: lightweight, composable primitives for resilience.
