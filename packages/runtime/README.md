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

