# Pipeline Migration Guide

This guide explains how to migrate from the legacy workflow orchestrator to the new canonical pipeline architecture.

## Migration Strategy

The migration follows a three-phase approach:

### Phase 1: Parallel Testing (Current)

**Status:** ✅ Complete  
**Duration:** 1-2 weeks  
**Goal:** Validate new pipeline alongside legacy orchestrator

**Steps:**

1. Enable pipeline for development testing:
   ```bash
   export ALFRED_USE_PIPELINE=1
   bun run dev
   ```

2. Run comparison tests to verify behavior parity:
   - Execute same workflow with both pipelines
   - Compare event streams
   - Validate file outputs
   - Check performance metrics

3. Monitor for differences:
   - Linear sync timing
   - Error handling paths
   - Agent execution patterns
   - Memory usage

**Validation Criteria:**
- ✅ All 8 stages execute successfully
- ✅ Events map correctly to WorkflowEvent format
- ✅ Linear integration maintains rate limits
- ✅ Metrics collected properly
- ✅ No regressions in UI or persistence

### Phase 2: Gradual Rollout (Next)

**Status:** ⏳ Planned  
**Duration:** 2-4 weeks  
**Goal:** Enable pipeline for production traffic incrementally

**Steps:**

1. Enable for specific workflows:
   ```typescript
   // In router or orchestrator entry point
   if (shouldUsePipeline(input)) {
     process.env.ALFRED_USE_PIPELINE = "1";
   }
   ```

2. Rollout percentages:
   - Week 1: 10% of workflows
   - Week 2: 25% of workflows
   - Week 3: 50% of workflows
   - Week 4: 100% of workflows

3. Monitor metrics per rollout phase:
   - `pipeline_total{status="success"}` vs `pipeline_total{status="failure"}`
   - Stage duration percentiles
   - Agent success rates
   - Learning insights generated

**Rollback Criteria:**
- Error rate > 5%
- p95 latency increases > 20%
- Agent success rate drops > 10%

### Phase 3: Full Migration (Future)

**Status:** ⏳ Planned  
**Duration:** 1 week  
**Goal:** Remove legacy orchestrator completely

**Steps:**

1. Remove feature flag and bridge code:
   - Delete `packages/runtime/src/workflow/pipeline-bridge.ts`
   - Remove `isPipelineEnabled()` check from orchestrator
   - Update docs to remove "new pipeline" terminology

2. Clean up legacy orchestrator code:
   - Archive `packages/runtime/src/phases/`
   - Remove old PipelineRunner (if different from new one)
   - Update imports across codebase

3. Update tests:
   - Remove compatibility layer tests
   - Update mocks to use PipelineEvent instead of WorkflowEvent
   - Simplify test setup

## Code Changes Required

### Router Updates

**Before:**
```typescript
export async function* workflowStream(
  input: WorkflowInputPayload,
  session: Session
) {
  for await (const event of orchestrateWorkflowStream(input, session, callbacks)) {
    yield event;
  }
}
```

**After Phase 3:**
```typescript
export async function* workflowStream(
  input: WorkflowInputPayload,
  session: Session
) {
  // Direct pipeline usage (no feature flag)
  for await (const event of runWorkflowPipeline(input, session)) {
    yield event;
  }
}
```

### Observer Customization

**Adding Custom Observers:**

```typescript
import { PipelineRunner, registerDefaultStages } from '@alfred/pipeline';
import type { PipelineObserver, PipelineEvent } from '@alfred/pipeline';

class CustomObserver implements PipelineObserver {
  onEvent(event: PipelineEvent): void {
    if (event.type === 'agent:complete') {
      // Custom logic for agent completion
      notifySlack(event.agentId, event.outcome);
    }
  }
  
  onComplete(): void {
    // Cleanup logic
  }
}

const runner = new PipelineRunner();
registerDefaultStages(runner);
runner.addObserver(new CustomObserver());
```

### Event Handling Migration

**Before (WorkflowEvent):**
```typescript
if (event._ === 'step-start') {
  console.log('Phase started:', event.phase);
}
```

**After (PipelineEvent):**
```typescript
if (event.type === 'stage:enter') {
  console.log('Stage started:', event.stage);
}
```

## Breaking Changes

### None (Phase 1-2)

The bridge maintains full backwards compatibility. No breaking changes during parallel testing and gradual rollout.

### After Full Migration (Phase 3)

1. **Event structure changes:**
   - `WorkflowEvent` with `_` discriminant → `PipelineEvent` with `type` discriminant
   - Stage names: `phase` → `stage`
   - Timestamp format: consistent milliseconds since epoch

2. **Configuration changes:**
   - Old phase timeouts → `PipelineConfig.phaseTimeouts`
   - Wave config → `PipelineConfig.maxParallel`

3. **Removed APIs:**
   - `orchestrateWorkflowStream` (use `runWorkflowPipeline` directly)
   - Old phase implementations in `packages/runtime/src/phases/`

## Testing During Migration

### Validation Script

Create `scripts/compare-pipelines.ts` to run both architectures:

```typescript
#!/usr/bin/env bun

const requirement = "Create a simple test file";

console.log("Running legacy orchestrator...");
delete process.env.ALFRED_USE_PIPELINE;
const legacyEvents = await runWorkflow(requirement);

console.log("Running new pipeline...");
process.env.ALFRED_USE_PIPELINE = "1";
const pipelineEvents = await runWorkflow(requirement);

console.log("Comparing outputs...");
compareEventStreams(legacyEvents, pipelineEvents);
```

### Unit Test Migration

**Before:**
```typescript
const events = await collectWorkflowEvents(input);
expect(events.some(e => e._ === 'step-start')).toBe(true);
```

**After:**
```typescript
const events = await collectPipelineEvents(input);
expect(events.some(e => e.type === 'stage:enter')).toBe(true);
```

## Rollback Plan

If issues arise during rollout:

1. **Immediate rollback:**
   ```bash
   unset ALFRED_USE_PIPELINE
   # or
   export ALFRED_USE_PIPELINE=0
   ```

2. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   bun install
   bun run dev
   ```

3. **Database:** No schema changes required, rollback is safe

## Metrics to Monitor

### Success Indicators

- `pipeline_total{status="success"}` increasing
- `pipeline_stage_duration_seconds` within expected ranges
- `pipeline_agent_total{status="success"}` matching legacy rates
- No increase in error logs

### Warning Signs

- `pipeline_total{status="failure"}` > 5%
- Stage timeouts increasing
- Agent failure rates > legacy baseline
- Memory usage growth

## Questions and Support

**Q: Can I run both pipelines simultaneously?**  
A: Yes, during Phase 1-2. Use the feature flag to switch between them.

**Q: Will my existing workflows break?**  
A: No. The bridge maintains full backwards compatibility with WorkflowEvent API.

**Q: How do I debug pipeline issues?**  
A: Enable ConsoleObserver in development:
```typescript
runner.addObserver(new ConsoleObserver());
```

**Q: What if a stage times out?**  
A: Increase timeout in config:
```typescript
phaseTimeouts: {
  execute: 1200_000,  // 20 minutes
}
```

**Q: Can I customize stage behavior?**  
A: Yes. Implement `PipelineStage` interface and register with `runner.registerStage()`.

## Timeline

- **2026-01-12:** Core implementation complete
- **2026-01-19:** Phase 1 validation complete (target)
- **2026-02-02:** Phase 2 rollout begins (target)
- **2026-02-16:** Phase 3 full migration (target)

## References

- Architecture: `docs/architecture/pipeline.md`
- Usage Guide: `docs/guides/using-pipeline.md`
- ExecPlan: `docs/execplans/canonical-pipeline.md`
- Package: `packages/pipeline/`
