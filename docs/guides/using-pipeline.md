# Using the Canonical Pipeline

The `@alfred/pipeline` package provides the next-generation workflow execution architecture for ALFRED. This guide explains how to use it and migrate from the legacy orchestrator.

## Quick Start

### Enable the New Pipeline

Set the `ALFRED_USE_PIPELINE` environment variable to enable the canonical pipeline:

```bash
export ALFRED_USE_PIPELINE=1
bun run dev
```

That's it! All workflow executions will now use the new 8-stage pipeline architecture.

### Verify It's Working

You'll see log messages indicating pipeline usage:

```
using_pipeline_architecture { runId: "...", requirement: "..." }
pipeline_workflow_start { runId: "...", requirement: "...", mode: "sequential" }
```

## Architecture Overview

The new pipeline consists of 8 sequential stages:

1. **init** - Project detection, Linear integration
2. **context** - Code/web/RAG context gathering  
3. **plan** - Task decomposition, ExecPlan generation
4. **schedule** - Wave planning (sequential/parallel)
5. **execute** - Agent spawning and execution
6. **review** - Quality checks, validation
7. **learn** - Knowledge extraction (async)
8. **summarize** - Summary generation, Linear updates

Each stage emits typed events that observers can consume for:
- Console logging
- Prometheus metrics
- Linear progress updates
- Custom integrations

## Feature Flags

### `ALFRED_USE_PIPELINE`

**Type:** Boolean (set to `"1"` to enable)  
**Default:** Disabled (uses legacy orchestrator)  
**Purpose:** Enable canonical pipeline architecture

When enabled, `orchestrateWorkflowStream` routes all workflows through the new pipeline. When disabled, uses the existing orchestrator.

## Backwards Compatibility

The pipeline bridge maintains full compatibility with the existing WorkflowEvent API:

```typescript
// PipelineEvent (new)          →  WorkflowEvent (legacy)
{ type: "stage:enter" }          →  { _: "step-start" }
{ type: "agent:spawn" }          →  { _: "agent-start" }
{ type: "pipeline:complete" }    →  { _: "workflow-complete" }
```

This means:
- ✅ Existing UI components work unchanged
- ✅ Database persistence continues working
- ✅ Linear integration maintains compatibility
- ✅ Metrics and observability preserved

## Configuration

Pipeline behavior can be configured via `PipelineConfig`:

```typescript
const runner = new PipelineRunner({
  maxParallel: 1,              // Sequential execution (POC default)
  maxAgentAttempts: 3,         // Retries per agent
  maxReviewAttempts: 3,        // Review fix attempts
  enableLearning: true,        // Enable learning stage
  enableLinearSync: false,     // Linear progress updates
  linearSyncInterval: 30_000,  // Batch interval (ms)
  phaseTimeouts: {             // Per-stage timeouts
    init: 30_000,
    context: 120_000,
    plan: 120_000,
    schedule: 10_000,
    execute: 600_000,
    review: 300_000,
    learn: 60_000,
    summarize: 30_000,
  },
});
```

## Observability

### Console Logging (Development)

When `NODE_ENV=development`, the ConsoleObserver logs all pipeline events:

```
[pipeline] 2026-01-12T... → init
[pipeline] 2026-01-12T... ✓ init (523ms)
[pipeline] 2026-01-12T... → context
[pipeline] 2026-01-12T...   context: Gathered 12,543 tokens of context
[pipeline] 2026-01-12T... ✓ context (4,231ms)
```

### Prometheus Metrics

Automatic metrics collection via MetricsObserver:

- `pipeline_stage_total{stage, status}` - Stage execution counts
- `pipeline_stage_duration_seconds{stage}` - Stage durations
- `pipeline_agent_total{status}` - Agent execution counts
- `pipeline_total{status}` - Total pipeline executions

### Linear Integration

When configured, LinearSyncObserver batches updates to respect rate limits (55 req/min):

- Stage progress → Linear comments
- Agent completion → Linear comments  
- Pipeline completion → Status "Done"
- Pipeline failure → Status "Cancelled" + error comment

## Testing

### Unit Tests

```bash
bun test packages/pipeline/test/runner.test.ts
```

### Integration Tests

```bash
bun test packages/pipeline/test/integration/golden-path.test.ts
```

### Manual Testing

Use the CLI tool for manual pipeline execution:

```bash
bun scripts/pipeline.ts --requirement "Create a hello.ts file"
```

## Migration Guide

### Phase 1: Parallel Testing (Current)

Run new pipeline alongside legacy orchestrator using feature flag:

```bash
# New pipeline
ALFRED_USE_PIPELINE=1 bun run dev

# Legacy orchestrator (default)
bun run dev
```

### Phase 2: Gradual Rollout (Future)

Enable for specific workflows or users:

```typescript
if (shouldUsePipeline(input)) {
  process.env.ALFRED_USE_PIPELINE = "1";
}
```

### Phase 3: Full Migration (Future)

Once validated:
1. Remove legacy orchestrator code
2. Remove pipeline bridge  
3. Remove feature flag
4. Update docs to remove "new" terminology

## Troubleshooting

### Pipeline not enabled

Check environment variable:

```bash
echo $ALFRED_USE_PIPELINE  # Should be "1"
```

### Events not emitting

Verify observer registration:

```typescript
runner.addObserver(new ConsoleObserver());
```

### Stage timeouts

Increase timeout in config:

```typescript
phaseTimeouts: {
  execute: 1200_000,  // 20 minutes
}
```

### Linear sync issues

Check rate limiter configuration and credentials:

```bash
echo $LINEAR_API_KEY
```

## Reference

- **Architecture:** `docs/architecture/pipeline.md`
- **ExecPlan:** `docs/execplans/canonical-pipeline.md`
- **Package:** `packages/pipeline/`
- **Bridge:** `packages/runtime/src/workflow/pipeline-bridge.ts`
