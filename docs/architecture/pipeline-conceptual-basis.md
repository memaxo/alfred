# Pipeline Conceptual Basis

**Status:** Canonical  
**Owner:** Core Runtime  
**Last Updated:** January 2026

This document defines the explicit conceptual boundaries for `@alfred/pipeline` and its relationship to adjacent packages. It serves as the architectural contract that prevents the fragmentation that occurred in the legacy orchestrator.

---

## Core Thesis

**The pipeline is a stage orchestrator, not a workflow system.**

It sequences typed stages, emits events, and provides extension points. Everything else—persistence, UI, integrations, agent implementations—belongs elsewhere.

---

## Package Responsibility Matrix

### `@alfred/pipeline` — Stage Orchestration

#### Single-Sentence Responsibility
> Pipeline sequences typed stages, manages stage transitions, and provides observer-based extensibility for workflow execution.

#### IN SCOPE (Now and Forever)

| Capability | Rationale |
|------------|-----------|
| Stage registration and ordering | Core orchestration responsibility |
| Stage execution with timeouts | Core orchestration responsibility |
| Event emission via `ctx.emit()` | Observability is core |
| Observer pattern for extensibility | Extension model |
| Typed stage boundaries (`PipelineStage<TInput, TOutput>`) | Type safety |
| Context key-value storage (`ctx.get/set`) | Inter-stage communication |
| AbortSignal propagation | Cancellation is core |
| Stage-level error handling | Error boundaries |
| Execution summary generation | Observability |

#### OUT OF SCOPE (Now and Forever)

| Capability | Where It Belongs | Rationale |
|------------|------------------|-----------|
| Database persistence | Observers (`PersistenceObserver`) | Side effect, not orchestration |
| Linear API integration | Observers (`LinearSyncObserver`) | External integration |
| UI/presentation concerns | `@alfred/ui`, `apps/web` | Separation of concerns |
| Agent implementation details | `@alfred/agent` | Implementation detail |
| Authentication/authorization | `@alfred/auth`, `@alfred/policy` | Cross-cutting security |
| HTTP/tRPC routing | `@alfred/api` | Transport layer |
| Metrics collection | Observers (`MetricsObserver`) | Side effect |
| Cost tracking | Observers (`CostObserver`) | Side effect |
| Warm pool management | `@alfred/agent` | Agent lifecycle |
| Specific executor logic (codex/opencode/droid) | `@alfred/agent` | Implementation detail |
| Project detection | `@alfred/plan` | Domain logic |
| Task decomposition | `@alfred/plan` | Domain logic |
| Knowledge graph operations | `@alfred/knowledge` | Domain logic |
| Learning/error analysis | `@alfred/learning` | Domain logic |

#### Extension Model

**Observers Only.** All new capabilities that don't fit existing stages must be implemented as observers. The pipeline core (`runner.ts`, `pipeline.ts`) should rarely change after initial implementation.

```typescript
// ✅ Correct: Add observer for new capability
class SlackNotifierObserver implements PipelineObserver {
  onEvent(event: PipelineEvent): void { ... }
}
runner.addObserver(new SlackNotifierObserver());

// ❌ Wrong: Modify pipeline core for new capability
// Never add callbacks, parameters, or logic to PipelineRunner
```

---

### `@alfred/runtime` — Legacy + Utilities (DEPRECATED)

#### Current State
Contains the legacy orchestrator and workflow utilities. Being migrated to pipeline.

#### Migration Target
- `orchestrator.ts` → Replaced by `@alfred/pipeline`
- `phases/*` → Logic moved to pipeline stages
- `orchestrator/*` → Utilities extracted or deprecated
- `workflow/*` → Utilities moved to appropriate packages

#### Post-Migration Fate
Package will contain only:
- Utility functions that don't fit elsewhere
- Backward-compatibility shims (temporary)
- Eventually: Package deletion

---

### `@alfred/agent` — Agent Implementations

#### Single-Sentence Responsibility
> Agent provides executor implementations (codex, opencode, droid), workspace management, and agent-level lifecycle operations.

#### IN SCOPE

| Capability | Rationale |
|------------|-----------|
| Executor implementations (codex, opencode, droid) | Core agent functionality |
| Workspace creation and management | Agent execution environment |
| AgentFS integration | Agent filesystem |
| Prompt construction | Agent input preparation |
| Tool definitions | Agent capabilities |
| Session management | Agent lifecycle |
| Escalation file detection | Agent-level concern |
| Agent-specific error handling | Agent lifecycle |

#### OUT OF SCOPE

| Capability | Where It Belongs | Rationale |
|------------|------------------|-----------|
| Stage sequencing | `@alfred/pipeline` | Orchestration concern |
| Wave planning | `@alfred/plan` | Planning concern |
| Multi-agent coordination | Pipeline execute stage | Orchestration concern |
| Workflow-level events | `@alfred/pipeline` | Pipeline concern |
| Linear integration | Pipeline observers | Integration concern |

---

### `@alfred/plan` — Planning & Decomposition

#### Single-Sentence Responsibility
> Plan handles project detection, task decomposition, wave planning, and ExecPlan generation.

#### IN SCOPE

| Capability | Rationale |
|------------|-----------|
| Project detection (`detectProject`) | Planning prerequisite |
| Task decomposition (`decomposeTask`) | Core planning |
| Wave planning (`planWaves`) | Execution scheduling |
| ExecPlan generation | Planning output |
| Structured plan creation | Planning output |
| Dependency analysis | Planning concern |

#### OUT OF SCOPE

| Capability | Where It Belongs | Rationale |
|------------|------------------|-----------|
| Plan execution | `@alfred/pipeline` | Orchestration concern |
| Agent spawning | `@alfred/agent` | Agent concern |
| Linear ticket creation | Pipeline observers | Integration concern |

---

### `@alfred/db` — Persistence Layer

#### Single-Sentence Responsibility
> DB provides schema definitions, migrations, and repository functions for all persistent data.

#### IN SCOPE

| Capability | Rationale |
|------------|-----------|
| Drizzle schema definitions | Persistence |
| SQL migrations | Persistence |
| Repository functions (CRUD) | Data access |
| Transaction management | Data integrity |

#### OUT OF SCOPE

| Capability | Where It Belongs | Rationale |
|------------|------------------|-----------|
| Business logic | Domain packages | Separation of concerns |
| Event handling | Pipeline/observers | Orchestration concern |
| Caching strategies | Calling code | Implementation detail |

---

### `@alfred/api` — HTTP/tRPC Interface

#### Single-Sentence Responsibility
> API exposes tRPC routers and HTTP endpoints that wire together domain packages for external consumption.

#### IN SCOPE

| Capability | Rationale |
|------------|-----------|
| tRPC router definitions | API surface |
| HTTP endpoint handlers | API surface |
| Request validation | API boundary |
| Authentication checks | API security |
| Response formatting | API contract |
| SSE/streaming endpoints | API transport |

#### OUT OF SCOPE

| Capability | Where It Belongs | Rationale |
|------------|------------------|-----------|
| Business logic | Domain packages | Separation of concerns |
| Persistence | `@alfred/db` | Layer separation |
| Agent execution | `@alfred/agent` | Domain concern |
| Pipeline orchestration | `@alfred/pipeline` | Orchestration concern |

---

## Feature Port Matrix

### Features to Port from Orchestrator to Pipeline

| Feature | Current Location | Target Location | Priority | Complexity |
|---------|-----------------|-----------------|----------|------------|
| **Resume/Suspend** | `workflow/orchestrator.ts`, `workflow/reconstruct.ts` | New: `PipelineReconstructor` class + `resume()` method | **CRITICAL** | High |
| **Event Replay** | `workflow/reconstruct.ts` | `PipelineReconstructor.reconstruct()` | **CRITICAL** | Medium |
| **State Hydration** | `orchestrator/hydrate.ts`, `workflow/history.ts` | Execute stage + context persistence | **HIGH** | Medium |
| **Stuck Detection** | `orchestrator/agent.ts` (`detectStuckWithContext`) | Execute stage (import from `@alfred/agent`) | **HIGH** | Low |
| **Escalation Handling** | `orchestrator/agent.ts` (escalation file) | Execute stage (import from `@alfred/agent`) | **HIGH** | Low |
| **Agent Retries** | `orchestrator/review.ts` (MAX_FIX_ATTEMPTS) | Execute stage config + Review stage | **MEDIUM** | Medium |
| **Review Fixer Loop** | `orchestrator/review.ts` | Review stage | **MEDIUM** | Medium |
| **Wave Abort Logic** | `orchestrator/waves.ts` (failure thresholds) | Execute stage | **MEDIUM** | Low |
| **Context Caching** | `orchestrator/waves.ts` (cachedExecutionContext) | Context stage | **LOW** | Low |
| **Executor Fallback** | `orchestrator/agent.ts` (server profile fallback) | `@alfred/agent` (already there) | **LOW** | N/A |
| **Cost Tracking** | `workflow/cost-tracker.ts` | New: `CostObserver` | **LOW** | Low |
| **Warm Pool** | `workflow/agent-warm-pool.ts` | `@alfred/agent` | **LOW** | N/A |
| **TrackerContext** | `orchestrator/agent.ts`, `orchestrator/waves.ts` | Execute stage (import type) | **MEDIUM** | Low |
| **ReviewGate** | `agent/workflow/review-gate.ts` | Review stage (import from `@alfred/agent`) | **MEDIUM** | Low |

---

## Feature Integration Strategy

### Principle: Import, Don't Duplicate

Features should be **imported from their canonical location**, not re-implemented in the pipeline. The pipeline stages are **thin orchestration wrappers** around domain logic.

### Integration Patterns

#### Pattern 1: Direct Import (Preferred)

For self-contained utilities that don't need pipeline context:

```typescript
// stages/execute.ts
import { detectStuckWithContext } from "@alfred/agent/orchestrator/tracker";

async execute(input: ScheduleOutput, ctx: PipelineContext): Promise<ExecuteOutput> {
  // ... agent execution ...
  
  const stuck = detectStuckWithContext(trackerContext, agentId, options);
  if (stuck) {
    ctx.emit(createEvent("agent:stuck", { agentId }));
  }
}
```

#### Pattern 2: Observer Delegation

For cross-cutting concerns that shouldn't pollute stage logic:

```typescript
// observers/persistence.ts
import { persistStreamEvent } from "@alfred/runtime/workflow/persist";

export class PersistenceObserver implements PipelineObserver {
  onEvent(event: PipelineEvent): void {
    // Convert PipelineEvent to persistence format
    // Delegate to existing persistence logic
    persistStreamEvent({ event: this.convert(event), ... });
  }
}
```

#### Pattern 3: Stage Composition

For complex logic that spans multiple concerns:

```typescript
// stages/review.ts
import { ReviewGate } from "@alfred/agent/workflow/review-gate";
import { buildReviewPlan, runFixerAgent } from "@alfred/agent/orchestrator/multi/review";

export class ReviewStage implements PipelineStage<ExecuteOutput, ReviewOutput> {
  async execute(input: ExecuteOutput, ctx: PipelineContext): Promise<ReviewOutput> {
    const gate = new ReviewGate();
    
    // Import and use existing review logic
    const plan = buildReviewPlan(input.outcomes);
    
    // Run fixer if needed (delegates to @alfred/agent)
    if (!gate.isSatisfied() && ctx.config.enableFixerLoop) {
      await this.runFixerLoop(plan, ctx);
    }
    
    return { checks: gate.summary(), allPassed: gate.isSatisfied() };
  }
}
```

---

## Resume/Suspend Implementation Plan

This is the most critical missing feature. Here's the explicit design:

### New Files Required

```
packages/pipeline/src/
├── reconstruct.ts      # PipelineReconstructor class
├── checkpoint.ts       # Stage checkpoint persistence
└── resume.ts           # Resume logic
```

### PipelineReconstructor Design

```typescript
// packages/pipeline/src/reconstruct.ts
import type { PipelineEvent } from "./events";
import type { PipelineContext, StageName } from "./pipeline";

export interface PipelineSnapshot {
  runId: string;
  lastCompletedStage: StageName | null;
  context: Map<string, unknown>;
  timestamp: number;
}

export class PipelineReconstructor {
  readonly initialSnapshot: PipelineSnapshot = {
    runId: "",
    lastCompletedStage: null,
    context: new Map(),
    timestamp: 0,
  };

  reduce(snapshot: PipelineSnapshot, event: PipelineEvent): PipelineSnapshot {
    const next = { ...snapshot, context: new Map(snapshot.context) };
    
    switch (event.type) {
      case "pipeline:start":
        next.runId = event.runId;
        break;
      case "stage:exit":
        next.lastCompletedStage = event.stage;
        next.timestamp = Date.now();
        break;
      case "context:set":
        next.context.set(event.key, event.value);
        break;
    }
    
    return next;
  }

  reconstruct(events: Iterable<PipelineEvent>): PipelineSnapshot {
    let snapshot = this.initialSnapshot;
    for (const event of events) {
      snapshot = this.reduce(snapshot, event);
    }
    return snapshot;
  }
}
```

### Resume Method on PipelineRunner

```typescript
// packages/pipeline/src/runner.ts
export class PipelineRunner {
  // ... existing methods ...

  async *resume(
    snapshot: PipelineSnapshot,
    input: PipelineInput
  ): AsyncGenerator<PipelineEvent, PipelineResult, void> {
    // Restore context from snapshot
    const ctx = createPipelineContext({
      ...input,
      initialContext: snapshot.context,
    });

    // Find starting stage (after last completed)
    const startIndex = snapshot.lastCompletedStage
      ? STAGE_ORDER.indexOf(snapshot.lastCompletedStage) + 1
      : 0;

    // Execute remaining stages
    for (let i = startIndex; i < STAGE_ORDER.length; i++) {
      const stageName = STAGE_ORDER[i];
      // ... same execution logic as run() ...
    }
  }
}
```

### Checkpoint Observer

```typescript
// packages/pipeline/src/observers/checkpoint.ts
export class CheckpointObserver implements PipelineObserver {
  constructor(private storage: CheckpointStorage) {}

  onEvent(event: PipelineEvent): void {
    if (event.type === "stage:exit") {
      // Persist checkpoint after each stage
      this.storage.save({
        runId: event.runId,
        stage: event.stage,
        context: event.contextSnapshot,
        timestamp: Date.now(),
      });
    }
  }
}
```

---

## Boundary Violations to Watch For

### Red Flags (Automatic Review Triggers)

1. **Pipeline imports `@alfred/db` directly**
   - Violation: Pipeline should not know about persistence
   - Fix: Use observer for persistence

2. **Pipeline imports `@alfred/api`**
   - Violation: Pipeline should not know about HTTP layer
   - Fix: API imports pipeline, not vice versa

3. **Stage contains >200 lines**
   - Violation: Stage is accumulating non-orchestration logic
   - Fix: Extract domain logic to appropriate package

4. **New callback added to PipelineRunner**
   - Violation: Callback accumulation (god object pattern)
   - Fix: Use observer pattern

5. **Stage directly calls Linear/GitHub/external API**
   - Violation: Integration should be in observers
   - Fix: Create dedicated observer

6. **Context stores domain objects (not serializable)**
   - Violation: Context should be serializable for resume
   - Fix: Store IDs/keys, not objects

### Acceptable Patterns

1. **Stage imports from `@alfred/agent`** — Agent logic belongs in agent package
2. **Stage imports from `@alfred/plan`** — Planning logic belongs in plan package
3. **Observer imports from `@alfred/db`** — Observers handle side effects
4. **Observer imports from `@alfred/logger`** — Logging is a side effect

---

## Implementation Checklist

### Phase 1: Critical Features (Weeks 1-2)

- [ ] Implement `PipelineReconstructor` class
- [ ] Add `resume()` method to `PipelineRunner`
- [ ] Create `CheckpointObserver` for persistence
- [ ] Add `context:set` event type for context changes
- [ ] Write tests for resume from each stage

### Phase 2: High Priority Features (Weeks 3-4)

- [ ] Import `detectStuckWithContext` into execute stage
- [ ] Import escalation file detection into execute stage
- [ ] Add `TrackerContext` integration to execute stage
- [ ] Implement state hydration (skip completed stages)

### Phase 3: Medium Priority Features (Weeks 5-6)

- [ ] Implement retry logic in execute stage (configurable)
- [ ] Import `ReviewGate` into review stage
- [ ] Add fixer loop to review stage (configurable)
- [ ] Add wave abort logic with failure thresholds

### Phase 4: Low Priority Features (Weeks 7-8)

- [ ] Create `CostObserver` for cost tracking
- [ ] Add context caching to context stage
- [ ] Create `PersistenceObserver` for event persistence
- [ ] Performance optimization and benchmarking

---

## Governance

### Change Process

1. **New Stage:** Requires architectural review. Must have typed I/O, <200 lines.
2. **New Observer:** Self-service. Follow observer interface.
3. **Core Change (`runner.ts`, `pipeline.ts`):** Requires architectural review + documentation update.
4. **New Event Type:** Self-service. Add to `events.ts`, document purpose.

### Review Triggers

- Pipeline core exceeds 500 lines total
- Any stage exceeds 200 lines
- New import added to pipeline from `@alfred/db` or `@alfred/api`
- Feature request that "requires modifying pipeline core"

### Documentation Requirements

- Every new observer: Add to `observers/index.ts` exports, add JSDoc
- Every new event type: Add to `PipelineEvent` union, add JSDoc
- Every architectural decision: Update this document

---

## References

- **Implementation:** `packages/pipeline/`
- **Legacy Code:** `packages/runtime/src/workflow/`, `packages/runtime/src/orchestrator/`
- **Architecture Rules:** `.ruler/47-system-architecture.md`
- **Design Checklist:** `docs/architecture/system-design-checklist.md`
- **Retrospective:** `docs/retrospective/orchestrator-fragmentation.md`
