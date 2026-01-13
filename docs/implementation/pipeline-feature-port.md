# Pipeline Feature Port Guide

This document provides explicit integration instructions for porting features from the legacy orchestrator to the canonical pipeline.

## Feature Port Status

| Feature | Status | Target | Complexity |
|---------|--------|--------|------------|
| Resume/Suspend | 🔴 Not Started | `reconstruct.ts`, `runner.ts` | High |
| Event Replay | 🔴 Not Started | `PipelineReconstructor` | Medium |
| State Hydration | 🔴 Not Started | Execute stage | Medium |
| Stuck Detection | 🔴 Not Started | Execute stage | Low |
| Escalation Handling | 🔴 Not Started | Execute stage | Low |
| Agent Retries | 🔴 Not Started | Execute stage config | Medium |
| Review Fixer Loop | 🔴 Not Started | Review stage | Medium |
| Wave Abort Logic | 🔴 Not Started | Execute stage | Low |
| TrackerContext | 🔴 Not Started | Execute stage | Low |
| ReviewGate | 🔴 Not Started | Review stage | Low |
| Context Caching | 🔴 Not Started | Context stage | Low |
| Cost Tracking | 🔴 Not Started | `CostObserver` | Low |

---

## 1. Resume/Suspend (CRITICAL)

### Current Location
```
packages/runtime/src/workflow/reconstruct.ts   → WorkflowReconstructor
packages/runtime/src/workflow/history.ts       → loadHistory()
packages/runtime/src/orchestrator/hydrate.ts   → hydrateTrackerContext()
packages/runtime/src/orchestrator/resume.ts    → resumeWorkflowAfterClarification()
packages/runtime/src/orchestrator/suspend.ts   → suspendWorkflowForClarification()
```

### Integration Plan

**Files to Create:**
```
packages/pipeline/src/reconstruct.ts   # PipelineReconstructor class
packages/pipeline/src/checkpoint.ts    # CheckpointObserver
```

**Step 1: Create PipelineReconstructor**

```typescript
// packages/pipeline/src/reconstruct.ts
import type { PipelineEvent } from "./events";
import type { StageName } from "./pipeline";

export interface PipelineSnapshot {
  runId: string;
  lastCompletedStage: StageName | null;
  contextEntries: Array<[string, unknown]>;  // Serializable
  timestamp: number;
}

export class PipelineReconstructor {
  reduce(snapshot: PipelineSnapshot, event: PipelineEvent): PipelineSnapshot {
    // Handle stage:exit → update lastCompletedStage
    // Handle context:set → update contextEntries
  }

  reconstruct(events: Iterable<PipelineEvent>): PipelineSnapshot {
    // Fold events into snapshot
  }
}
```

**Step 2: Add context:set Event**

```typescript
// packages/pipeline/src/events.ts
export type PipelineEvent =
  | { type: "context:set"; key: string; value: unknown }
  // ... existing events
```

**Step 3: Emit context:set on ctx.set()**

```typescript
// packages/pipeline/src/runner.ts
const ctx: PipelineContext = {
  // ...
  set: (key, value) => {
    storage.set(key, value);
    this.emit(createEvent("context:set", { key, value }));  // NEW
  },
};
```

**Step 4: Add resume() Method**

```typescript
// packages/pipeline/src/runner.ts
async *resume(
  snapshot: PipelineSnapshot,
  input: PipelineInput
): AsyncGenerator<PipelineEvent, PipelineResult, void> {
  // Restore context from snapshot.contextEntries
  // Skip stages up to snapshot.lastCompletedStage
  // Execute remaining stages
}
```

**Step 5: Create CheckpointObserver**

```typescript
// packages/pipeline/src/observers/checkpoint.ts
export class CheckpointObserver implements PipelineObserver {
  constructor(private storage: CheckpointStorage) {}

  onEvent(event: PipelineEvent): void {
    if (event.type === "stage:exit") {
      this.storage.checkpoint(event.runId, event.stage, /* context */);
    }
  }
}
```

### Tests Required
- Resume from each stage boundary
- Resume after context modifications
- Resume with partial context
- Invalid snapshot handling

---

## 2. Stuck Detection (HIGH)

### Current Location
```
packages/runtime/src/orchestrator/agent.ts:11  → import { detectStuckWithContext }
packages/agent/src/orchestrator/multi/tracker.ts → detectStuckWithContext()
```

### Integration Plan

**Target:** Execute stage

**Step 1: Import Existing Function**

```typescript
// packages/pipeline/src/stages/execute.ts
import { detectStuckWithContext, type TrackerContext } from "@alfred/agent/orchestrator/multi/tracker";
```

**Step 2: Add to Agent Execution Loop**

```typescript
// In execute stage, after each agent completes:
const stuck = detectStuckWithContext(trackerContext, agentId, {
  noProgressMs: ctx.config.stuckDetection?.noProgressMs ?? 60_000,
  maxTransitions: ctx.config.stuckDetection?.maxTransitions ?? 200,
  similarityThreshold: ctx.config.stuckDetection?.similarityThreshold ?? 0.92,
});

if (stuck) {
  ctx.emit(createEvent("agent:stuck", { agentId, reason: "no_progress" }));
  outcome.stuck = true;
  outcome.status = "stuck";
}
```

**Step 3: Add Config Option**

```typescript
// packages/pipeline/src/pipeline.ts
export interface PipelineConfig {
  // ... existing
  stuckDetection?: {
    noProgressMs?: number;
    maxTransitions?: number;
    similarityThreshold?: number;
  };
}
```

### Tests Required
- Agent marked stuck after no progress
- Stuck detection respects config thresholds
- Stuck event emitted correctly

---

## 3. Escalation Handling (HIGH)

### Current Location
```
packages/runtime/src/orchestrator/agent.ts:306  → escalationFile
packages/runtime/src/orchestrator/agent.ts:694  → escalation file detection
```

### Integration Plan

**Target:** Execute stage

**Step 1: Import or Inline Detection Logic**

```typescript
// packages/pipeline/src/stages/execute.ts
async function detectEscalation(workingDirectory: string, agentId: string): Promise<string | null> {
  const escalationPath = path.join(workingDirectory, `ESCALATION-${agentId}.md`);
  const file = Bun.file(escalationPath);
  if (await file.exists()) {
    const content = await file.text();
    if (content.trim().length > 0) {
      return content;
    }
  }
  return null;
}
```

**Step 2: Check After Agent Completion**

```typescript
// In execute stage, after each agent completes:
const escalationReason = await detectEscalation(spec.workingDirectory, spec.agentId);
if (escalationReason) {
  ctx.emit(createEvent("agent:escalated", { agentId, reason: escalationReason }));
  outcome.status = "escalated";
  outcome.escalation = escalationReason;
}
```

**Step 3: Add Event Type**

```typescript
// packages/pipeline/src/events.ts
| { type: "agent:escalated"; agentId: string; reason: string }
```

### Tests Required
- Escalation file detected
- Escalation reason captured in outcome
- Agent marked as escalated

---

## 4. Agent Retries (MEDIUM)

### Current Location
```
packages/runtime/src/orchestrator/review.ts:356  → MAX_FIX_ATTEMPTS = 3
packages/runtime/src/orchestrator/review.ts:359  → fixAttempts tracking
```

### Integration Plan

**Target:** Execute stage config + Review stage

**Step 1: Add Retry Config**

```typescript
// packages/pipeline/src/pipeline.ts
export interface PipelineConfig {
  // ... existing
  agentRetries?: {
    maxAttempts?: number;      // Default: 1 (no retries)
    retryableStatuses?: Array<"failure" | "stuck" | "timeout">;
  };
}
```

**Step 2: Implement Retry Loop in Execute Stage**

```typescript
// packages/pipeline/src/stages/execute.ts
const maxAttempts = ctx.config.agentRetries?.maxAttempts ?? 1;
const retryableStatuses = ctx.config.agentRetries?.retryableStatuses ?? [];

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const result = await runAgent({ ... });
  
  if (result.status === "success" || !retryableStatuses.includes(result.status)) {
    break;  // Success or non-retryable
  }
  
  if (attempt < maxAttempts) {
    ctx.emit(createEvent("agent:retry", { agentId, attempt, reason: result.status }));
  }
}
```

**Step 3: Add Event Type**

```typescript
// packages/pipeline/src/events.ts
| { type: "agent:retry"; agentId: string; attempt: number; reason: string }
```

### Tests Required
- No retries by default
- Retries on configured statuses
- Max attempts respected
- Retry events emitted

---

## 5. Review Fixer Loop (MEDIUM)

### Current Location
```
packages/runtime/src/orchestrator/review.ts:285  → runReviewPhase()
packages/runtime/src/orchestrator/review.ts:356  → fixer loop logic
packages/agent/src/orchestrator/multi/review.ts  → buildReviewPlan(), buildFixerAgentSpec()
```

### Integration Plan

**Target:** Review stage

**Step 1: Add Fixer Config**

```typescript
// packages/pipeline/src/pipeline.ts
export interface PipelineConfig {
  // ... existing
  reviewFixer?: {
    enabled?: boolean;
    maxAttempts?: number;  // Default: 3
  };
}
```

**Step 2: Import Review Utilities**

```typescript
// packages/pipeline/src/stages/review.ts
import { buildReviewPlan, buildFixerAgentSpec } from "@alfred/agent/orchestrator/multi/review";
import { ReviewGate } from "@alfred/agent/workflow/review-gate";
```

**Step 3: Implement Fixer Loop**

```typescript
// packages/pipeline/src/stages/review.ts
async execute(input: ExecuteOutput, ctx: PipelineContext): Promise<ReviewOutput> {
  const gate = new ReviewGate();
  const checks = await this.runChecks(input, gate);
  
  if (!gate.isSatisfied() && ctx.config.reviewFixer?.enabled) {
    const maxAttempts = ctx.config.reviewFixer?.maxAttempts ?? 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      ctx.emit(createEvent("review:fix-attempt", { attempt, maxAttempts }));
      
      const fixerSpec = buildFixerAgentSpec(/* ... */);
      const fixResult = await this.runFixerAgent(fixerSpec, ctx);
      
      // Re-run checks
      const recheckResult = await this.runChecks(input, gate);
      if (gate.isSatisfied()) {
        break;
      }
    }
  }
  
  return { checks: gate.summary(), allPassed: gate.isSatisfied(), fixAttempts };
}
```

### Tests Required
- Fixer disabled by default
- Fixer runs on review failure
- Max attempts respected
- Fixer events emitted

---

## 6. Wave Abort Logic (MEDIUM)

### Current Location
```
packages/runtime/src/orchestrator/waves.ts:193  → failure tracking
packages/runtime/src/orchestrator/waves.ts:196  → abortedWave
```

### Integration Plan

**Target:** Execute stage

**Step 1: Add Abort Config**

```typescript
// packages/pipeline/src/pipeline.ts
export interface PipelineConfig {
  // ... existing
  waveAbort?: {
    waveFailureThreshold?: number;    // Default: 0.5 (50%)
    overallFailureThreshold?: number; // Default: 0.3 (30%)
  };
}
```

**Step 2: Track Failures in Execute Stage**

```typescript
// packages/pipeline/src/stages/execute.ts
let totalAgents = 0;
let totalFailed = 0;

for (const wave of waves) {
  let waveFailed = 0;
  
  for (const agentSpec of waveAgents) {
    totalAgents++;
    const result = await runAgent({ ... });
    
    if (result.status === "failure" || result.stuck) {
      totalFailed++;
      waveFailed++;
    }
  }
  
  // Check thresholds
  const waveFailRate = waveFailed / waveAgents.length;
  const overallFailRate = totalFailed / totalAgents;
  
  if (waveFailRate > (ctx.config.waveAbort?.waveFailureThreshold ?? 0.5) ||
      overallFailRate > (ctx.config.waveAbort?.overallFailureThreshold ?? 0.3)) {
    ctx.emit(createEvent("wave:aborted", { waveId: wave.id, waveFailRate, overallFailRate }));
    break;  // Abort remaining waves
  }
}
```

### Tests Required
- No abort below thresholds
- Abort on wave threshold breach
- Abort on overall threshold breach
- Abort event emitted

---

## 7. TrackerContext Integration (MEDIUM)

### Current Location
```
packages/runtime/src/orchestrator/agent.ts:38   → trackerContextRef
packages/runtime/src/orchestrator/waves.ts:44   → TrackerContext type
packages/agent/src/orchestrator/multi/tracker.ts → createTrackerContext, updateTrackerWithContext
```

### Integration Plan

**Target:** Execute stage

**Step 1: Import Types and Functions**

```typescript
// packages/pipeline/src/stages/execute.ts
import {
  createTrackerContext,
  updateTrackerWithContext,
  type TrackerContext,
} from "@alfred/agent/orchestrator/multi/tracker";
```

**Step 2: Initialize TrackerContext**

```typescript
// packages/pipeline/src/stages/execute.ts
const trackerContext = createTrackerContext(subtasks);
const trackerContextRef = { current: trackerContext };
```

**Step 3: Update After Each Agent**

```typescript
// After agent execution:
trackerContextRef.current = updateTrackerWithContext(
  trackerContextRef.current,
  agentId,
  {
    status: result.status,
    transitionCount: result.transitionCount,
    // ... other tracking data
  }
);
```

**Step 4: Use for Stuck Detection**

```typescript
// Stuck detection uses tracker context:
const stuck = detectStuckWithContext(trackerContextRef.current, agentId, options);
```

### Tests Required
- TrackerContext initialized correctly
- TrackerContext updated after each agent
- Stuck detection uses tracker context

---

## 8. ReviewGate Integration (MEDIUM)

### Current Location
```
packages/agent/src/workflow/review-gate.ts → ReviewGate class
packages/runtime/src/workflow/orchestrator.ts:188 → reviewGate usage
```

### Integration Plan

**Target:** Review stage

**Step 1: Import ReviewGate**

```typescript
// packages/pipeline/src/stages/review.ts
import { ReviewGate } from "@alfred/agent/workflow/review-gate";
```

**Step 2: Use in Review Stage**

```typescript
// packages/pipeline/src/stages/review.ts
async execute(input: ExecuteOutput, ctx: PipelineContext): Promise<ReviewOutput> {
  const gate = new ReviewGate();
  
  // Add checks based on outcomes
  for (const [taskId, outcome] of input.outcomes) {
    if (outcome.status === "success") {
      gate.add({ taskId, passed: true });
    } else {
      gate.add({ taskId, passed: false, reason: outcome.escalation });
    }
  }
  
  // Check if Linear requires review
  const linearSessionId = ctx.get<string>("linearSessionId");
  if (linearSessionId) {
    gate.requireAtLeast(1);
  }
  
  return {
    checks: gate.summary(),
    allPassed: gate.isSatisfied(),
    requiresReview: !gate.isSatisfied(),
  };
}
```

### Tests Required
- ReviewGate initialized correctly
- Checks added from outcomes
- Linear requirement honored
- Summary returned correctly

---

## Integration Order

1. **Week 1:** Resume/Suspend (foundation for all recovery)
2. **Week 2:** Stuck Detection + Escalation (critical for agent reliability)
3. **Week 3:** TrackerContext + ReviewGate (dependencies for other features)
4. **Week 4:** Agent Retries + Review Fixer Loop
5. **Week 5:** Wave Abort Logic + Context Caching
6. **Week 6:** Testing, documentation, performance optimization

---

## Validation Checklist

Before marking a feature as complete:

- [ ] Feature works correctly in isolation
- [ ] Feature integrates with existing pipeline flow
- [ ] Events emitted for observability
- [ ] Config options documented
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No boundary violations (check imports)
- [ ] Documentation updated
