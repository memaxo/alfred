# @alfred/resilience

Shared utilities for building resilient workflows and async operations.

## Features

- **Abort Signal Management** - Propagate and combine abort signals across async boundaries
- **Transition Guards** - Prevent infinite loops in state machines and workflows
- **Escalation Detection** - Detect and handle stuck workflows with recovery mechanisms

## Installation

```bash
bun add @alfred/resilience
```

## Usage

### Abort Signals

```typescript
import {
  createLinkedAbortController,
  raceWithAbort,
} from "@alfred/resilience/abort";

// Create child signal that aborts with parent
const parent = new AbortController();
const child = createLinkedAbortController(parent.signal);

// Race operation against abort
const result = await raceWithAbort(
  fetchData(),
  parent.signal,
  "Fetch was cancelled"
);

// Combine multiple signals
const combined = combineAbortSignals(signal1, signal2, signal3);
```

### Transition Guards

```typescript
import { TransitionGuard, guardedLoop } from "@alfred/resilience/transitions";

// Create guard with max transitions
const guard = new TransitionGuard(50);

// Check each transition
while (hasMoreWork()) {
  guard.tick(); // Throws if exceeded
  doWork();
}

// Or use guarded loop
await guardedLoop(
  () => hasMoreWork(),
  async () => await doWork(),
  {
    maxIterations: 50,
    onExceeded: (count) => logger.error("Loop exceeded", { count }),
  }
);
```

### Escalation Detection

```typescript
import {
  EscalationDetector,
  ESCALATION_REASONS,
  detectStuck,
} from "@alfred/resilience/escalation";

const detector = new EscalationDetector();

// Register handler
detector.onEscalation(async (event) => {
  logger.error("Workflow escalated", { event });
  await notifyOps(event);
});

// Detect and escalate
const reason = detectStuck(config, {
  transitionCount: 100,
  elapsedMs: 300000,
  errorCount: 5,
});

if (reason) {
  await detector.escalate({
    reason,
    context: { runId },
    timestamp: new Date(),
  });
}
```

## API Reference

### Abort Module

- `createLinkedAbortController(parent)` - Create child signal linked to parent
- `abortablePromise(signal, message)` - Promise that rejects on abort
- `raceWithAbort(operation, signal, message)` - Race operation against abort
- `throwIfAborted(signal, message)` - Check and throw if aborted
- `createTimeoutSignal(ms)` - Create signal that aborts after timeout
- `combineAbortSignals(...signals)` - Combine multiple signals

### Transitions Module

- `TransitionGuard` - Counter with max limit checking
  - `tick()` - Increment and check limit
  - `reset()` - Reset counter
  - `getCount()` - Get current count
  - `isExceeded()` - Check if limit reached
- `createGuardFromEnv(envKey, defaultMax)` - Create from env variable
- `guardedLoop(condition, fn, options)` - Execute with guard protection

### Escalation Module

- `EscalationDetector` - Detect and handle escalations
  - `onEscalation(handler)` - Register handler
  - `escalate(event)` - Trigger escalation
  - `getHistory(runId)` - Get escalation history
  - `clearHistory(runId)` - Clear history
  - `hasEscalated(runId)` - Check if escalated
  - `countByReason(runId, reason)` - Count by reason
- `ESCALATION_REASONS` - Standard escalation reasons
- `detectStuck(config, context)` - Detect stuck workflows
- `defaultEscalationDetector` - Shared detector instance

## Examples

See `packages/pipeline/test/resilience/` for comprehensive examples.

## Best Practices

1. **Always propagate abort signals** - Pass signals through async boundaries
2. **Set appropriate limits** - Configure MAX_TRANSITIONS based on workflow complexity
3. **Handle escalations** - Register handlers for stuck detection
4. **Clean up listeners** - Remove abort listeners to prevent memory leaks
5. **Log transitions** - Track transition counts for debugging

## Integration

This package is used by:

- `@alfred/pipeline` - Workflow orchestration
- `@alfred/agent` - Agent execution
- `@alfred/runtime` - Runtime operations

## License

MIT
