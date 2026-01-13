# Canonical Execution Pipeline

The `@alfred/pipeline` package provides the authoritative code path for all ALFRED workflow execution. It consolidates context gathering, planning, agent spawning, quality review, and learning into a unified, observable runtime.

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

## Key Components

### PipelineRunner

The core orchestrator that:
- Registers stages
- Manages observers
- Executes stages in sequence
- Emits typed events
- Handles timeouts and errors

### PipelineStage

Generic interface for pipeline stages:

```typescript
interface PipelineStage<TInput, TOutput> {
  readonly name: StageName;
  execute(input: TInput, ctx: PipelineContext): Promise<TOutput>;
  rollback?(output: TOutput, ctx: PipelineContext): Promise<void>;
}
```

### PipelineContext

Shared context available to all stages:

```typescript
interface PipelineContext {
  readonly runId: string;
  readonly requirement: string;
  readonly workspace: string;
  readonly userId: string;
  readonly signal: AbortSignal;
  readonly config: PipelineConfig;
  emit(event: PipelineEvent): void;
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}
```

### PipelineObserver

Event consumer interface:

```typescript
interface PipelineObserver {
  onEvent(event: PipelineEvent): void;
  onComplete?(): void;
}
```

## Usage

```typescript
import { PipelineRunner, registerDefaultStages } from '@alfred/pipeline';
import { ConsoleObserver, MetricsObserver } from '@alfred/pipeline/observers';

const runner = new PipelineRunner({ maxParallel: 1 });
registerDefaultStages(runner);
runner.addObserver(new ConsoleObserver());

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

## Event Flow

```
Input → init → context → plan → schedule → execute → review → learn → summarize → Result
         ↓       ↓         ↓       ↓          ↓         ↓        ↓        ↓
      Events  Events    Events  Events     Events    Events   Events   Events
         ↓       ↓         ↓       ↓          ↓         ↓        ↓        ↓
      Observers ────────────────────────────────────────────────────────→
```

Each stage:
1. Receives typed input from previous stage
2. Emits progress events via context
3. Returns typed output for next stage
4. Observers react to events asynchronously

## Stage Details

### Init Stage
- Detects or creates project
- Links Linear issue if configured
- Stores project metadata in context

### Context Stage
- Gathers code context from workspace
- Optionally fetches web context
- Retrieves RAG chunks
- Returns ContextBundle with total token count

### Plan Stage
- Decomposes requirement into subtasks
- Generates ExecPlan skeletons
- Creates root plan and subtask plans
- Stores plan metadata in context

### Schedule Stage
- Plans wave execution based on dependencies
- Determines sequential vs parallel execution
- Estimates total duration
- Returns WavePlan array

### Execute Stage
- Spawns agents for each wave
- Runs agents in sequence (POC)
- Collects outcomes and file changes
- Emits agent progress events

### Review Stage
- Checks agent outcomes
- Validates file changes
- Runs quality checks (future: lint, test, security)
- Returns pass/fail status

### Learn Stage
- Triggers learning worker
- Extracts knowledge from run
- Updates hypergraph (asynchronous)
- Returns insights (empty for async processing)

### Summarize Stage
- Generates wave summary
- Builds ATIF trajectory
- Updates Linear if configured
- Returns final summary

## Testing

```bash
bun test packages/pipeline              # Unit tests
bun test packages/pipeline/test/integration  # Integration tests
```

## Design Decisions

**Sequential by default:** The POC uses sequential execution (maxParallel: 1) for simplicity. Parallel execution can be enabled via configuration once the sequential path is proven.

**Observer pattern:** Observers are decoupled from the pipeline core, enabling rate-limited updates (e.g., Linear sync at 55 req/min) without blocking stage execution.

**AsyncGenerator for events:** Provides backpressure, natural composition with for-await-of, and aligns with existing WorkflowRuntime patterns.

**Dynamic imports:** Stages use `await import()` to avoid circular dependencies while still accessing functions from `@alfred/agent`, `@alfred/runtime`, and `@alfred/plan`.

**Typed stage boundaries:** Each stage has explicit input/output types, making the data flow visible and type-safe.

## Troubleshooting

### Pipeline Not Running

**Symptom:** Workflows still use legacy orchestrator

**Solution:** Verify environment variable is set:
```bash
echo $ALFRED_USE_PIPELINE  # Should output: 1
```

### Stage Timeouts

**Symptom:** `Stage {name} timed out after {ms}ms`

**Solution:** Increase timeout for specific stage:
```typescript
const runner = new PipelineRunner({
  phaseTimeouts: {
    execute: 1200_000,  // Increase to 20 minutes
  },
});
```

### Missing Events

**Symptom:** Observer not receiving events

**Solution:** Ensure observer is added before running pipeline:
```typescript
runner.addObserver(observer);  // Must come before runner.run()
```

### Agent Execution Failures

**Symptom:** All agents fail with "unauthorized" or "agentfs_workspace_not_initialized"

**Solution:** This is expected in test environments without Docker/auth. For production:
1. Ensure Docker is running
2. Verify auth credentials are configured
3. Check `LINEAR_API_KEY` if using Linear sync

### Import Errors

**Symptom:** `Cannot find module '@alfred/pipeline'`

**Solution:** Install dependencies:
```bash
bun install
```

Ensure package is in workspace:
```bash
grep -r "@alfred/pipeline" package.json
```

### Circular Dependency Errors

**Symptom:** Module resolution failures at runtime

**Solution:** Stages use dynamic imports internally. If you see circular dependency errors, ensure you're importing from the package root:
```typescript
// ✅ Correct
import { PipelineRunner } from '@alfred/pipeline';

// ❌ Avoid
import { PipelineRunner } from '@alfred/pipeline/src/runner';
```

## Performance Benchmarks

**Typical Stage Durations (Sequential Mode):**

| Stage     | p50    | p95     | p99      |
|-----------|--------|---------|----------|
| init      | 50ms   | 200ms   | 500ms    |
| context   | 2s     | 10s     | 30s      |
| plan      | 100ms  | 1s      | 5s       |
| schedule  | 10ms   | 100ms   | 500ms    |
| execute   | 60s    | 300s    | 600s     |
| review    | 1s     | 10s     | 60s      |
| learn     | 10ms   | 100ms   | 1s       |
| summarize | 2s     | 10s     | 30s      |

**Total Pipeline Duration:**
- Simple tasks: 1-2 minutes
- Medium tasks: 3-5 minutes
- Complex tasks: 10-15 minutes

## Future Enhancements

- Parallel execution support (maxParallel > 1)
- Stage rollback on failure
- Checkpoint/resume capability
- Fine-grained quality checks in review stage
- Real-time learning insights (not just async)
- ATIF trajectory visualization
- Stage-level caching for repeated operations
- Adaptive timeout calculation based on task complexity
