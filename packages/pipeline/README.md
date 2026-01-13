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
