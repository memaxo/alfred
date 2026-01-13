# @alfred/pipeline

Canonical execution pipeline for ALFRED workflow orchestration.

## Overview

The `@alfred/pipeline` package provides the authoritative code path for all ALFRED workflow execution. It consolidates context gathering, planning, agent spawning, quality review, and learning into a unified, observable runtime with explicit stage boundaries and typed outputs.

## Architecture

The pipeline consists of 8 sequential stages:

1. **init** - Create project, link Linear
2. **context** - Gather code + web + RAG context
3. **plan** - Decompose requirement into subtasks
4. **schedule** - Decide execution order (sequential/parallel)
5. **execute** - Spawn and run agents
6. **review** - Quality checks, self-correction
7. **learn** - Extract knowledge, update hypergraph
8. **summarize** - Generate summary, notify consumers

## Usage

### Basic Example

```typescript
import { PipelineRunner, registerDefaultStages } from '@alfred/pipeline';
import { ConsoleObserver, MetricsObserver } from '@alfred/pipeline/observers';

const runner = new PipelineRunner({ maxParallel: 1 });
registerDefaultStages(runner);
runner.addObserver(new ConsoleObserver());
runner.addObserver(new MetricsObserver());

for await (const event of runner.run({
  runId: crypto.randomUUID(),
  requirement: 'Create a todo list app',
  workspace: '/path/to/repo',
  userId: 'user-123',
})) {
  console.log(event);
}
```

### With Linear Integration

```typescript
import { PipelineRunner, registerDefaultStages } from '@alfred/pipeline';
import { LinearSyncObserver } from '@alfred/pipeline/observers';

const runner = new PipelineRunner({
  maxParallel: 1,
  enableLinearSync: true,
  linearSyncInterval: 30_000, // 30 seconds
});

registerDefaultStages(runner);

// Add Linear observer
runner.addObserver(new LinearSyncObserver({
  syncIntervalMs: 30_000,
  issueId: 'ALF-123',
  authz: 'your-linear-token',
}));

for await (const event of runner.run(input)) {
  // Linear updates happen automatically via observer
}
```

### Custom Observer

```typescript
import type { PipelineObserver, PipelineEvent } from '@alfred/pipeline';

class SlackNotifier implements PipelineObserver {
  onEvent(event: PipelineEvent): void {
    if (event.type === 'pipeline:complete') {
      sendSlackMessage(`✓ Workflow complete: ${event.summary.requirement}`);
    } else if (event.type === 'pipeline:failed') {
      sendSlackMessage(`✗ Workflow failed: ${event.error}`);
    }
  }
}

runner.addObserver(new SlackNotifier());
```

### CLI Usage

```bash
# Run pipeline from command line
bun scripts/pipeline.ts --requirement "Create a hello.ts file"

# With custom workspace
bun scripts/pipeline.ts \
  --requirement "Add tests" \
  --workspace /path/to/repo

# Parallel execution
bun scripts/pipeline.ts \
  --requirement "Large refactor" \
  --parallel
```

## Observers

The pipeline emits typed events that observers can consume:

- **ConsoleObserver** - Logs events to console
- **MetricsObserver** - Records Prometheus metrics
- **LinearSyncObserver** - Syncs progress to Linear (rate-limited)
- **WorkflowEventObserver** - Bridges to existing WorkflowEvent system

## Configuration

```typescript
const config: PipelineConfig = {
  maxParallel: 1,           // Sequential by default
  maxAgentAttempts: 3,      // Retries per agent
  maxReviewAttempts: 3,     // Review fix attempts
  enableLearning: true,     // Enable learning stage
  enableLinearSync: false,  // Linear integration
  linearSyncInterval: 30_000, // Batch interval
};
```

## Testing

```bash
bun test packages/pipeline              # Unit tests
bun test packages/pipeline/test/integration  # Integration tests
```

## Status

✅ Core implementation complete (Milestones 0-4)
⏳ Integration with existing orchestrator (Milestone 5) - pending
⏳ Full golden path test (Milestone 6) - pending
