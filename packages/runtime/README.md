# @alfred/runtime

Workflow execution runtime for ALFRED. Provides pure execution engine with AsyncGenerator interface.

## Purpose

The runtime package implements the core workflow execution engine that orchestrates:
- Context building and caching
- AI streaming via AI SDK v6
- Domain package integration (cognitive, knowledge, learning, policy)
- Tool execution and progress tracking
- Suspend/resume logic
- Error handling and recovery

## Architecture

Runtime is a **leaf package** that depends on domain packages but is never depended upon by them:

```
@alfred/runtime
├─→ @alfred/cognitive (pure state transitions)
├─→ @alfred/knowledge (graph queries)
├─→ @alfred/learning (supervision)
├─→ @alfred/policy (evaluation)
├─→ @alfred/agent (tool registry)
├─→ @alfred/db (persistence)
└─→ @alfred/type (shared types)
```

## Usage

```typescript
import { createRuntime } from '@alfred/runtime';

const runtime = createRuntime({
  user: session.user,
  input: {
    requirement: 'Build a todo app',
    workspace: '/path/to/repo',
    auto: 'medium',
  },
  signal: abortController.signal,
});

// Execute workflow and consume events
for await (const event of runtime.execute()) {
  console.log('Event:', event.type);
  
  // Handle specific events
  if (event.type === 'tool-call') {
    console.log('Tool:', event.toolName);
  }
}
```

## Key Features

- **Pure execution engine**: No HTTP/tRPC dependencies
- **Dependency injection**: All dependencies injected for testability
- **Hybrid state**: Memory for execution state, database for durability
- **AsyncGenerator interface**: Composable, backpressure-friendly streaming
- **AI SDK v6 native**: Uses `streamText()` with full event support
- **Resume support**: In-flight resume via promise queue
- **Cancellation**: Via AbortController signal

## Commands

- `bun run build` - Build TypeScript
- `bun run typecheck` - Type check without building
- `bun test` - Run unit tests

## Environment

Server-only package. Never import into browser bundles.

## Performance Budgets

- Context build: <5s (cached <50ms)
- Phase execution: <30 minutes
- Token budget validation: Immediate
- Event emission: <1ms per event

## Stuck Detection Configuration

The runtime detects stuck agents using three heuristics that can be tuned via environment variables or project configuration.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STUCK_NO_PROGRESS_MS` | `60000` | Time without events before agent is stuck (ms) |
| `STUCK_MAX_REPEATS` | `5` | Consecutive identical commands before stuck |
| `STUCK_MAX_FILE_FLIP_FLOPS` | `4` | Same file modifications before stuck |

### Project Configuration

Add `stuckDetection` to your project config:

```typescript
const projectConfig: ProjectConfig = {
  type: 'node',
  testCommand: 'bun test',
  // ... other config
  stuckDetection: {
    noProgressMs: 300_000,  // 5 minutes for complex tasks
    maxRepeats: 10,         // Allow more retries
    maxFileFlipFlops: 8,    // Allow more refactoring
  },
};
```

### Tuning Guidelines

- **Long-running tasks**: Increase `noProgressMs` for complex analysis or large codebases
- **Iterative tasks**: Increase `maxRepeats` for tasks requiring multiple test/fix cycles
- **Refactoring tasks**: Increase `maxFileFlipFlops` for tasks touching the same files repeatedly
- **Quick feedback**: Decrease all values for faster stuck detection in simple tasks

