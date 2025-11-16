<chatName="Phase 3 Runtime Integration Architecture Analysis"/>

# Phase 3: Runtime Integration Layer - Architectural Analysis & Implementation Plan

**This ExecPlan is a living document.** The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with `.agent/PLANS.md`.

## Executive Summary

This document provides detailed answers to 20 architectural questions and presents a comprehensive implementation plan for Phase 3: Runtime Integration Layer. The runtime layer will replace the current `runPlanV6` implementation while maintaining full backward compatibility with existing event consumers.

**Key Design Decisions:**
- Runtime as a pure execution engine with AsyncGenerator interface
- Dependency injection for testability (AI SDK, storage, tools)
- Hybrid state management (memory + database)
- Domain packages integrated via pure function calls
- Zero breaking changes to event schema or router interface

---

## Progress

Use checkboxes to track granular implementation steps. Update this section at every stopping point. Timestamps measure progress rates.

### Phase 3.1: Runtime Core (Week 1)
- [ ] Create runtime package structure (package.json, tsconfig.json, turbo.json updates)
- [ ] Implement WorkflowRuntime class with AsyncGenerator interface
- [ ] Implement phase orchestration (scan, plan, act, report)
- [ ] Add cancellation support via AbortController
- [ ] Add resume support via promise queue
- [ ] Write unit tests for phase execution order
- [ ] Write unit tests for cancellation
- [ ] Write unit tests for resume logic
- [ ] Write unit tests for error handling

### Phase 3.2: Domain Package Integration (Week 1)
- [ ] Create CognitiveEngine wrapper for cognitive state functions
- [ ] Create KnowledgeEngine wrapper for knowledge graph queries
- [ ] Create LearningEngine wrapper for learning/supervision functions
- [ ] Create PolicyEngine wrapper for policy evaluation
- [ ] Create AISDKAdapter for event mapping
- [ ] Create StorageAdapter for database operations
- [ ] Implement context builder with caching (5-minute TTL)
- [ ] Add token budget validation
- [ ] Write integration tests for engine wrappers
- [ ] Write integration tests for AI SDK adapter
- [ ] Write integration tests for context caching

### Phase 3.3: Router Integration (Week 2)
- [ ] Replace runPlanV6 with WorkflowRuntime in workflow.ts
- [ ] Update start endpoint to create runtime
- [ ] Update stream endpoint to consume runtime generator
- [ ] Verify resume endpoint works unchanged
- [ ] Update workflow.router.test.ts for runtime
- [ ] Add integration tests with mock AI SDK
- [ ] Add end-to-end tests with real AI (recorded fixtures)
- [ ] Mark runPlanV6 deprecated with migration guide

### Phase 3.4: Performance Optimization (Week 2)
- [ ] Add context build time metrics
- [ ] Add phase execution time metrics
- [ ] Add AI SDK call duration metrics
- [ ] Add knowledge persistence time metrics
- [ ] Batch knowledge graph writes
- [ ] Batch learning ledger updates
- [ ] Use database transactions for atomicity
- [ ] Write performance test for context caching
- [ ] Write performance test for batch writes
- [ ] Verify context build time <5s (cached <50ms)
- [ ] Verify knowledge batch writes <1s

### Phase 3.5: Observability & Monitoring (Week 3)
- [ ] Add runtime_executions_total metric
- [ ] Add runtime_phase_duration_seconds metric
- [ ] Add runtime_context_build_duration_seconds metric
- [ ] Add runtime_ai_sdk_calls_total metric
- [ ] Add structured logging for phase transitions
- [ ] Add structured logging for context build results
- [ ] Add structured logging for AI SDK errors
- [ ] Add structured logging for knowledge persistence failures
- [ ] Add tracing for runtime execution
- [ ] Add tracing for domain package calls
- [ ] Add tracing for AI SDK calls
- [ ] Add tracing for database operations
- [ ] Update dashboards with runtime metrics

### Phase 3.6: Migration & Cleanup (Week 3)
- [ ] Deploy runtime to production behind feature flag
- [ ] Monitor metrics and error rates
- [ ] Validate event schema compatibility
- [ ] Remove feature flag (cutover)
- [ ] Monitor for regressions
- [ ] Update documentation
- [ ] Delete runPlanV6 function
- [ ] Delete runner.ts file
- [ ] Update imports across codebase

---

## Surprises & Discoveries

Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

- **Observation:** AI SDK v6 event properties differ from what was initially drafted
  **Evidence:** AI SDK v6 audit (docs/execplans/runtime-integration-ai-sdk-audit.md) revealed critical property name mismatches:
  - `text-delta` uses `delta` not `textDelta` (v4 legacy name)
  - `tool-call` uses `input` not `args`
  - `tool-result` uses `output` not `result` and includes `input` field
  - `text-delta` requires `id` field for tracking text blocks
  **Impact:** Original plan would have failed at runtime with undefined values
  **Resolution:** Updated AISDKAdapter.mapEvent() to use correct AI SDK v6 property names before implementation
  **Date:** 2025-11-16

---

## Decision Log

Record every decision made while working on the plan.

- **Decision:** Runtime as leaf package with dependency injection
  **Rationale:** Avoids circular dependencies, enables testability, keeps domain packages pure. Domain packages don't need to know about runtime existence.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Hybrid state management (memory + database)
  **Rationale:** Memory state is fast for execution, database state enables replay/debugging. No complex rehydration logic needed since resume is in-flight only.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Runtime owns event generation, router owns event delivery
  **Rationale:** Clear separation of concerns. Runtime is pure execution engine, router handles HTTP/tRPC concerns. AsyncGenerator provides composable, backpressure-friendly interface.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Build context once before execution, cache aggressively
  **Rationale:** Keeps context stable during execution, avoids mid-execution rebuilds. 5-minute TTL preserves existing behavior. Optional refresh for long-running workflows.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Let AI SDK manage tool execution automatically
  **Rationale:** Simpler and more reliable than manual orchestration. AI SDK handles tool call/result lifecycle. Tools manage their own timeouts for granularity.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Clean cutover (no parallel implementations)
  **Rationale:** Reduces maintenance burden. Identical events mean no consumer changes. Deprecation period gives time for validation before removal.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Domain packages provide pure functions, runtime calls them explicitly
  **Rationale:** No event buses or observers. Clear control flow. Testable via spies/mocks. Runtime explicitly orchestrates state transitions.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** Record outcomes after each phase, batch knowledge updates at completion
  **Rationale:** Incremental outcome recording prevents data loss on partial failure. Batch persistence for efficiency. Async/fire-and-forget doesn't block workflow completion.
  **Date/Author:** 2025-11-16 (Initial design)

- **Decision:** AI SDK v6 compliance verified and corrected via systematic audit
  **Rationale:** Pre-implementation audit of AI SDK v6 documentation prevented critical runtime failures. Found property name mismatches (`textDelta` → `delta`, `args` → `input`, `result` → `output`) that would have broken event mapping. Also identified missing event types (text lifecycle, reasoning, steps, abort) and recommended MockLanguageModelV1 for testing instead of mocking streamText directly.
  **Date/Author:** 2025-11-16 (AI SDK v6 audit)

---

## Outcomes & Retrospective

*(To be filled in at major milestones and completion)*

---

## Architecture & Boundaries

### Question 1: Package Boundaries & Circular Dependencies

**Decision:** Create `packages/runtime/` as a **leaf package** that depends on domain packages but is never depended upon by them.

**Dependency Graph:**
```
packages/runtime/
├─→ @alfred/cognitive (pure functions, no side effects)
├─→ @alfred/knowledge (pure queries, no mutations)
├─→ @alfred/learning (pure supervision, async updates)
├─→ @alfred/policy (pure evaluation)
├─→ @alfred/agent (tool registry)
├─→ @alfred/db (repositories for persistence)
└─→ @alfred/type (shared types)
```

**Key Files to Modify:**
- Create `packages/runtime/package.json` with dependencies
- Create `packages/runtime/tsconfig.json` extending base config
- Update `turbo.json` to include runtime in build pipeline

**Dependency Injection Pattern:**
```typescript
// packages/runtime/src/core.ts
export class WorkflowRuntime {
  constructor(
    private readonly options: {
      streamText: typeof streamText;  // Injected AI SDK function
      tools: ToolMap;                  // Injected from @alfred/agent/v6
      storage: WorkflowStorage;        // Injected database adapter
      cognitive: CognitiveEngine;      // Injected domain logic
      knowledge: KnowledgeEngine;      // Injected domain logic
      learning: LearningEngine;        // Injected domain logic
      policy: PolicyEngine;            // Injected domain logic
    }
  ) {}
}
```

**Why This Works:**
- No circular dependencies (runtime is a leaf)
- All dependencies are explicit and testable
- Domain packages remain pure (no knowledge of runtime)
- Follows `.ruler/02-architecture.md` rule: "Avoid circular dependencies"

---

### Question 2: Lifecycle Ownership

**Decision:** Router owns HTTP lifecycle, runtime owns execution lifecycle.

**Ownership Split:**

| Component | Owned By | Responsibilities |
|-----------|----------|------------------|
| HTTP lifecycle (start, subscribe, cancel) | Router (`workflow.ts`) | Authentication, authorization, tRPC wiring, SSE streaming |
| Execution lifecycle (initialize, run phases, suspend/resume) | Runtime (`core.ts`) | Phase orchestration, context building, AI streaming, tool execution |
| Persistence lifecycle (create run, append events) | Router (`workflow.ts`) | Database writes, audit logging, metrics emission |
| Coordination lifecycle (register, unregister, dispatch resume) | Run Registry (`run-registry.ts`) | Multi-instance coordination, resume routing |

**Key Files to Modify:**
- `packages/api/src/routers/workflow.ts` (lines 91-209): Replace `runPlanV6` with `WorkflowRuntime`
- `packages/runtime/src/core.ts`: New file, execution engine
- `packages/api/src/run-registry.ts`: No changes needed (already generic)

**Router Integration Pattern:**
```typescript
// packages/api/src/routers/workflow.ts
import { WorkflowRuntime } from '@alfred/runtime';

export const workflowRouter = router({
  start: authedProcedure.mutation(async ({ input, ctx }) => {
    const runtime = createRuntime({ user: ctx.session.user, input });
    
    await workflowRepo.createRun({ 
      id: runtime.runId, 
      userId: ctx.session.user.id,
      status: "running" 
    });
    
    await runRegistry.register(runtime.runId, {
      resume: async ({ resumeData }) => runtime.resume(resumeData),
      cancel: async () => runtime.cancel(),
      abortController: runtime.abortController,
    });
    
    return { runId: runtime.runId, summary: runtime.summary };
  }),
  
  stream: authedProcedure.subscription(({ input, ctx }) =>
    observable<WorkflowEvent>((emit) => {
      const runtime = createRuntime({ user: ctx.session.user, input });
      
      (async () => {
        try {
          for await (const event of runtime.execute()) {
            emit.next(event);
            await workflowRepo.appendEvent({ 
              runId: runtime.runId, 
              eventType: event.type,
              eventData: event 
            });
          }
          emit.complete();
        } catch (error) {
          emit.error(toTRPCError(error));
        }
      })();
      
      return () => runtime.cancel();
    })
  ),
});
```

**Why This Works:**
- Router handles HTTP concerns (auth, subscriptions, persistence)
- Runtime is a pure execution engine (testable, reusable)
- Clear separation of concerns
- Maintains existing tRPC observable pattern

---

### Question 3: State Management

**Decision:** Hybrid state management - transient in memory, durable in database.

**State Layers:**

| State Type | Storage | Lifecycle | Example |
|------------|---------|-----------|---------|
| Execution state | Memory (runtime instance) | Workflow execution | Current phase, context bundle, resume resolver |
| Durable state | Database (`workflow_runs`, `workflow_events`) | Persistent | Input data, events, final status |
| Coordination state | Run Registry (memory or Redis) | Distributed | Run ownership, resume routing |

**Key Files to Modify:**
- `packages/db/src/schema/workflow.ts`: No changes needed (already supports stateData JSONB)
- `packages/runtime/src/state.ts`: New file for runtime state types
- `packages/runtime/src/storage.ts`: New file for storage adapter interface

**Runtime State Structure:**
```typescript
// packages/runtime/src/state.ts
export type RuntimeState = {
  runId: string;
  phase: WorkflowPhase;  // 'scan' | 'plan' | 'act' | 'report'
  context: ExecutionContext | null;
  resumeWaiter: Promise<ResumePayload> | null;
  cancelled: boolean;
};

// Transient state (not persisted)
class WorkflowRuntime {
  private state: RuntimeState;
  
  async execute(): AsyncGenerator<WorkflowEvent> {
    // State evolves during execution
    for (const phase of phases) {
      this.state.phase = phase;
      yield* this.executePhase(phase);
    }
  }
}
```

**Suspend/Resume Reconstruction:**
```typescript
// Runtime does NOT reconstruct from database on resume
// Resume is in-flight, not cross-instance
// Multi-instance resume handled by run-registry

async resume(payload: ResumePayload) {
  if (this.state.resumeWaiter) {
    // Resolve in-flight promise
    this.resumeResolver(payload);
  } else {
    // Queue for next wait point
    this.resumeQueue.push(payload);
  }
}
```

**Why This Works:**
- Memory state is fast and type-safe
- Database state is durable for replay/debugging
- No complex state rehydration logic
- Follows `.ruler/04-database.md` rule: "Use database for durable state, memory for transient"

---

### Question 4: Event Stream Ownership

**Decision:** Runtime owns event generation, router owns event delivery.

**Event Flow:**
```
WorkflowRuntime.execute()
  ↓ (yields)
AsyncGenerator<WorkflowEvent>
  ↓ (consumed by)
Router tRPC subscription
  ↓ (emits to)
Observable<WorkflowEvent>
  ↓ (delivered via)
SSE (Server-Sent Events)
  ↓ (received by)
Client UI
```

**Key Files to Modify:**
- `packages/runtime/src/core.ts`: `async *execute(): AsyncGenerator<WorkflowEvent>`
- `packages/api/src/routers/workflow.ts` (lines 227-486): No changes to observable wrapper

**Runtime Event Generation:**
```typescript
// packages/runtime/src/core.ts
export class WorkflowRuntime {
  async *execute(): AsyncGenerator<WorkflowEvent> {
    yield { type: 'run', id: this.runId };
    
    // Context phase
    const context = await this.buildContext();
    yield { type: 'context', phase: 'scan', receipts: context.receipts };
    
    // Planning phase
    for await (const event of this.streamPlanning(context)) {
      yield event;  // Forward AI SDK events
    }
    
    // Acting phase
    for (const action of plan.actions) {
      yield { type: 'tool-call', id: action.id, toolName: action.name };
      const result = await this.executeTool(action);
      yield { type: 'tool-result', id: action.id, result };
    }
    
    // Completion
    yield { type: 'progress', pct: 100, message: 'completed' };
  }
}
```

**Why This Works:**
- AsyncGenerator is composable and backpressure-friendly
- Router simply wraps in observable (no business logic)
- Maintains backward compatibility with current consumers
- Follows `.ruler/15-ai-sdk-v6.md` streaming patterns

---

## Integration Patterns

### Question 5: Context Building Timing

**Decision:** Build context **once before execution**, cache aggressively, refresh only on explicit request.

**Key Files to Modify:**
- `packages/agent/src/orchestrator/flow/context.ts`: No changes needed (already has caching)
- `packages/runtime/src/context-builder.ts`: New file wrapping existing context functions

**Context Building Flow:**
```typescript
// packages/runtime/src/context-builder.ts
export class ContextBuilder {
  constructor(
    private cache: Map<string, { expires: number; context: ExecutionContext }>
  ) {}
  
  async build(input: ContextBuildInput): Promise<ExecutionContext> {
    const cacheKey = this.computeKey(input);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.context;
    }
    
    // Use existing context gathering functions
    const codeReceipt = await gatherCodeContext({ 
      requirement: input.requirement,
      cw: input.workspace,
      authz: input.authz,
    });
    
    const webReceipt = input.web ? await gatherWebContext({
      requirement: input.requirement,
      authz: input.authz,
    }) : null;
    
    const bundle = await buildContextBundle({
      cw: input.workspace,
      receipts: { ...codeReceipt, web: webReceipt?.web },
      maxTokens: input.maxTokens,
    });
    
    const context: ExecutionContext = {
      requirement: input.requirement,
      receipts: { ...codeReceipt, web: webReceipt?.web },
      bundle,
      knowledge: await this.queryKnowledge(input),
      cognitive: await this.buildCognitiveState(input),
    };
    
    this.cache.set(cacheKey, {
      context,
      expires: Date.now() + 5 * 60_000, // 5 minutes
    });
    
    return context;
  }
}
```

**Cache Key Computation:**
```typescript
private computeKey(input: ContextBuildInput): string {
  return createHash('sha256')
    .update(input.requirement)
    .update(input.workspace ?? '')
    .update((input.exts ?? []).join(','))
    .update((input.ignore ?? []).join(','))
    .update(String(input.topK ?? 25))
    .digest('hex');
}
```

**Why This Works:**
- Preserves existing caching behavior (5-minute TTL)
- No mid-execution rebuilds (keeps context stable)
- Optional refresh for long-running workflows via explicit flag
- Follows `.ruler/09-purity-and-performance.md`: "Cache aggressively, invalidate explicitly"

---

### Question 6: Tool Registry Integration

**Decision:** Runtime uses existing `buildTools()` from `@alfred/agent/v6`, no dynamic composition.

**Key Files to Modify:**
- `packages/runtime/src/core.ts`: Import `buildTools()` from `@alfred/agent/v6`
- `packages/agent/src/v6.ts`: No changes needed (already exports tool registry)

**Runtime Tool Integration:**
```typescript
// packages/runtime/src/core.ts
import { buildTools } from '@alfred/agent/v6';
import { streamText } from 'ai';

export class WorkflowRuntime {
  private readonly tools: ToolMap;
  
  constructor(options: RuntimeOptions) {
    this.tools = options.tools ?? buildTools();  // Use provided or default
  }
  
  async *streamPlanning(context: ExecutionContext): AsyncGenerator<WorkflowEvent> {
    const stream = streamText({
      model: this.model,
      messages: this.buildMessages(context),
      tools: this.tools,  // Pass static tool registry
      toolChoice: 'auto',
    });
    
    for await (const event of stream.fullStream) {
      yield* this.adaptAIEvent(event);
    }
  }
}
```

**Tool Authorization:**
```typescript
// Tools handle their own authorization (no runtime filtering)
// Example from packages/agent/src/orchestrator/tool/codex.ts
export const toolCodex = {
  async execute({ input, writer }) {
    // Tool checks permissions internally
    await enforcePolicy(input);
    
    // Tool execution logic
    // ...
  }
};
```

**Why This Works:**
- Reuses proven tool registry pattern
- Tools self-authorize via policy engine
- No runtime complexity for permission filtering
- Testable via dependency injection (pass mock tools)
- Follows `.ruler/02-architecture.md`: "Prefer composition over abstraction"

---

### Question 7: Domain Package Composition

**Decision:** Domain packages provide **pure functions**, runtime calls them explicitly and emits results as events.

**Key Files to Modify:**
- `packages/runtime/src/engines/cognitive-engine.ts`: New file wrapping cognitive functions
- `packages/runtime/src/engines/knowledge-engine.ts`: New file wrapping knowledge functions
- `packages/runtime/src/engines/learning-engine.ts`: New file wrapping learning functions
- `packages/runtime/src/engines/policy-engine.ts`: New file wrapping policy functions

**Cognitive Integration:**
```typescript
// packages/runtime/src/engines/cognitive-engine.ts
import { capturing, thinking, deciding, executing } from '@alfred/cognitive/state';

export class CognitiveEngine {
  // Wrap pure cognitive functions with context
  capture(input: string): CognitiveState {
    return capturing(input, 0.8);  // Pure function from @alfred/cognitive
  }
  
  think(about: string, traces: string[]): CognitiveState {
    return thinking(about, traces.length, traces);
  }
  
  decide(options: Decision[]): CognitiveState {
    return deciding(options);
  }
  
  execute(plan: Plan, autonomy: AutonomyGradient): CognitiveState {
    return executing(plan, autonomy);
  }
}
```

**Runtime Usage:**
```typescript
// packages/runtime/src/core.ts
async *execute(): AsyncGenerator<WorkflowEvent> {
  // Emit cognitive state transitions as events
  const captureState = this.cognitive.capture(this.input.requirement);
  yield { 
    type: 'cognitive-state', 
    state: captureState,
    phase: 'capture' 
  };
  
  // Continue with thinking phase
  const thinkState = this.cognitive.think(this.input.requirement, traces);
  yield { 
    type: 'cognitive-state', 
    state: thinkState,
    phase: 'think' 
  };
  
  // Domain packages are CALLED, not OBSERVED
}
```

**Why This Works:**
- Domain packages remain pure (no side effects, no observers)
- Runtime explicitly orchestrates state transitions
- Clear control flow (no magic event buses)
- Testable via simple spies/mocks
- Follows `.ruler/09-purity-and-performance.md`: "Prefer pure functions"

---

### Question 8: Learning Loop Integration

**Decision:** Record outcomes **after each phase completes**, batch knowledge updates at **workflow completion**.

**Key Files to Modify:**
- `packages/runtime/src/engines/learning-engine.ts`: New file wrapping learning functions
- `packages/runtime/src/core.ts`: Call learning engine after each phase

**Learning Integration:**
```typescript
// packages/runtime/src/engines/learning-engine.ts
import { supervise } from '@alfred/learning/self_supervision';
import { persistKnowledge } from '@alfred/agent/assistant/graphstore';

export class LearningEngine {
  private outcomes: SupervisionEvent[] = [];
  
  recordOutcome(outcome: PhaseOutcome): void {
    this.outcomes.push({
      input: outcome.input,
      output: outcome.output,
      expected: outcome.expected,
      error: outcome.error,
      context: outcome.context,
      ts: new Date().toISOString(),
    });
  }
  
  async commitLearning(resource: string): Promise<void> {
    // Batch process all outcomes
    const updates: KnowledgeUpdate[] = [];
    
    for (const outcome of this.outcomes) {
      const result = supervise(outcome);
      if (result) {
        updates.push(...result);
      }
    }
    
    if (updates.length === 0) return;
    
    // Persist asynchronously (fire-and-forget)
    persistKnowledge(resource, updates).catch(error => {
      logger.warn('learning_persistence_failed', { 
        resource, 
        count: updates.length,
        error: error.message 
      });
    });
  }
}
```

**Runtime Usage:**
```typescript
// packages/runtime/src/core.ts
async *executePhase(phase: PhaseConfig): AsyncGenerator<WorkflowEvent> {
  const startTime = Date.now();
  let outcome: PhaseOutcome;
  
  try {
    // Execute phase
    yield* this.runPhase(phase);
    
    outcome = {
      input: phase.input,
      output: phase.result,
      expected: phase.expected,
      error: 0,
      context: { phase: phase.name, duration: Date.now() - startTime },
    };
  } catch (error) {
    outcome = {
      input: phase.input,
      output: null,
      expected: phase.expected,
      error: 1,
      context: { phase: phase.name, error: error.message },
    };
  }
  
  // Record outcome immediately
  this.learning.recordOutcome(outcome);
}

async *execute(): AsyncGenerator<WorkflowEvent> {
  // Execute all phases
  for (const phase of this.phases) {
    yield* this.executePhase(phase);
  }
  
  // Batch commit at workflow completion
  await this.learning.commitLearning(this.input.workspace);
  
  yield { type: 'progress', pct: 100, message: 'completed' };
}
```

**Why This Works:**
- Incremental outcome recording (no data loss on partial failure)
- Batch persistence for efficiency
- Async/fire-and-forget (doesn't block workflow completion)
- Logged but not fatal (workflow succeeds even if learning fails)
- Follows `.ruler/09-purity-and-performance.md`: "Batch database writes"

---

## AI SDK Integration

### Question 9: Streaming Model

**Decision:** Runtime wraps `streamText()` in an internal adapter, maintains `AsyncGenerator<WorkflowEvent>` signature.

**Key Files to Modify:**
- `packages/runtime/src/adapters/ai-sdk-adapter.ts`: New file wrapping AI SDK
- `packages/runtime/src/core.ts`: Use adapter internally

**AI SDK Adapter:**
```typescript
// packages/runtime/src/adapters/ai-sdk-adapter.ts
import { streamText, type StreamTextResult } from 'ai';

export class AISDKAdapter {
  async *stream(options: StreamTextOptions): AsyncGenerator<WorkflowEvent> {
    const stream = await streamText(options);
    
    for await (const event of stream.fullStream) {
      const mapped = this.mapEvent(event);
      if (mapped) yield mapped;
    }
  }
  
  private mapEvent(sdkEvent: any): WorkflowEvent | null {
    switch (sdkEvent.type) {
      case 'text-delta':
        return {
          type: 'text-delta',
          id: sdkEvent.id,           // Required id field for tracking text blocks
          delta: sdkEvent.delta,     // FIXED: was sdkEvent.textDelta (v4 legacy)
        };
      
      case 'tool-call':
        return {
          type: 'tool-call',
          toolCallId: sdkEvent.toolCallId,  // Keep consistent property naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input,             // FIXED: was sdkEvent.args
        };
      
      case 'tool-result':
        return {
          type: 'tool-result',
          toolCallId: sdkEvent.toolCallId,  // Keep consistent property naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input,             // Include input that was passed
          output: sdkEvent.output,           // FIXED: was sdkEvent.result
        };
      
      case 'finish':
        return {
          type: 'finish',
          finishReason: sdkEvent.finishReason,
          usage: sdkEvent.usage,
        };
      
      case 'error':
        return {
          type: 'error',
          message: sdkEvent.error instanceof Error 
            ? sdkEvent.error.message 
            : String(sdkEvent.error),
        };
      
      // Additional event types (forward if WorkflowEvent supports them)
      case 'text-start':
      case 'text-end':
      case 'reasoning':
      case 'reasoning-start':
      case 'reasoning-delta':
      case 'reasoning-end':
      case 'start-step':
      case 'finish-step':
      case 'abort':
        // Forward these events - can be handled by UI incrementally
        return sdkEvent as WorkflowEvent;
      
      default:
        return null;  // Ignore unknown events
    }
  }
}
```

**Runtime Usage:**
```typescript
// packages/runtime/src/core.ts
export class WorkflowRuntime {
  private readonly aiAdapter: AISDKAdapter;
  
  constructor(options: RuntimeOptions) {
    this.aiAdapter = new AISDKAdapter(options.streamText);
  }
  
  async *execute(): AsyncGenerator<WorkflowEvent> {
    // Use adapter for AI streaming
    for await (const event of this.aiAdapter.stream({
      model: this.model,
      messages: this.messages,
      tools: this.tools,
    })) {
      yield event;  // Forward mapped events
    }
  }
}
```

**Why This Works:**
- Maintains AsyncGenerator signature for compatibility
- Adapter is testable (inject mock streamText function)
- Runtime doesn't know about AI SDK internals
- Easy to swap AI providers (just change adapter)
- Follows `.ruler/15-ai-sdk-v6.md`: "Use AI SDK v6 streaming APIs"

---

### Question 10: Event Normalization

**Decision:** Normalization happens **in the runtime adapter**, not in the router.

**Key Files to Modify:**
- `packages/runtime/src/adapters/ai-sdk-adapter.ts`: Map AI SDK events to WorkflowEvent
- `packages/api/src/ai/normalize.ts`: Keep for replay/persistence (not streaming)

**Event Mapping Strategy:**

| AI SDK Event | WorkflowEvent | Notes |
|--------------|---------------|-------|
| `text-delta` | `{ type: 'text-delta', id, delta }` | AI SDK v6: property is `delta` not `textDelta` |
| `tool-call` | `{ type: 'tool-call', toolCallId, toolName, input }` | AI SDK v6: property is `input` not `args` |
| `tool-result` | `{ type: 'tool-result', toolCallId, toolName, input, output }` | AI SDK v6: properties are `input` and `output` |
| `finish` | `{ type: 'finish', finishReason, usage }` | No changes from AI SDK v6 |
| `error` | `{ type: 'error', message }` | Extract and stringify error message |
| `reasoning` | `{ type: 'reasoning', text }` | For O1/O3 models |
| `text-start`, `text-end` | Forward as-is | Text block lifecycle events |
| `start-step`, `finish-step` | Forward as-is | Multi-step workflow events |
| `abort` | Forward as-is | Stream cancellation event |

**Adapter Implementation** (see Question 9 for full code)

**Router Pass-Through:**
```typescript
// packages/api/src/routers/workflow.ts
stream: authedProcedure.subscription(({ input, ctx }) =>
  observable<WorkflowEvent>((emit) => {
    const runtime = createRuntime({ user: ctx.session.user, input });
    
    (async () => {
      for await (const event of runtime.execute()) {
        emit.next(event);  // No normalization, just pass through
        await workflowRepo.appendEvent({ runId: runtime.runId, ...event });
      }
      emit.complete();
    })();
  })
),
```

**Why This Works:**
- Single responsibility: adapter handles mapping, runtime handles execution
- Router is thin (no business logic)
- Events are normalized at source (not multiple places)
- Follows `.ruler/02-architecture.md`: "Single Responsibility Principle"

---

### Question 11: Tool Execution

**Decision:** Let AI SDK manage tool execution automatically (simpler, more reliable).

**Key Files to Modify:**
- `packages/runtime/src/adapters/ai-sdk-adapter.ts`: Trust AI SDK for tool orchestration
- Tool implementations: No changes needed (already support async execution)

**Tool Execution Flow:**
```
1. Runtime calls aiAdapter.stream({ tools })
2. AI SDK invokes tool when model requests it
3. Tool executes (potentially long-running)
4. Tool emits progress via `writer` pattern
5. AI SDK gets tool result
6. Runtime receives tool-result event
7. Runtime forwards event to router
```

**Long-Running Tool Example:**
```typescript
// packages/agent/src/orchestrator/tool/codex.ts
export const toolCodex = {
  async execute({ input, writer }) {
    // Tool has its own timeout (e.g., 30 minutes)
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    
    // Emit progress periodically
    await writer?.write({ type: 'notice', message: 'codex_turn_started' });
    
    // Long-running operation
    const result = await runCodexWithTimeout(input, timeoutSec);
    
    await writer?.write({ type: 'notice', message: 'codex_turn_completed' });
    
    return result;
  }
};
```

**Runtime Configuration:**
```typescript
// AI SDK timeout is separate from tool timeout
const stream = streamText({
  model: this.model,
  messages: this.messages,
  tools: this.tools,
  maxSteps: 12,  // Limit tool call depth
  abortSignal: this.abortController.signal,  // For cancellation
  // No global timeout (tools manage their own)
});
```

**Why This Works:**
- AI SDK handles tool call/result orchestration (proven pattern)
- Tools manage their own timeouts (more granular)
- Writer pattern allows progress streaming (already implemented)
- Runtime stays simple (doesn't manage tool lifecycle)
- Follows `.ruler/15-ai-sdk-v6.md`: "Let AI SDK orchestrate tools"

---

### Question 12: Error Handling

**Decision:** Map AI SDK errors to `WorkflowEvent` error types, runtime emits errors but continues if recoverable.

**Key Files to Modify:**
- `packages/runtime/src/adapters/ai-sdk-adapter.ts`: Error mapping
- `packages/runtime/src/core.ts`: Error recovery logic

**Error Classification:**

| Error Type | Recoverable | Action |
|------------|-------------|--------|
| Model timeout | Yes | Emit error event, retry with shorter context |
| Rate limit | Yes | Emit error event, wait and retry |
| Invalid API key | No | Emit error event, abort workflow |
| Network error | Yes | Emit error event, retry up to 3 times |
| Tool execution error | Yes | Emit error event, continue workflow |

**Error Mapping:**
```typescript
// packages/runtime/src/adapters/ai-sdk-adapter.ts
private handleError(error: unknown): WorkflowEvent {
  if (error instanceof Error) {
    // AI SDK errors
    if (error.name === 'AI_APICallError') {
      const apiError = error as { statusCode?: number; message: string };
      
      if (apiError.statusCode === 401 || apiError.statusCode === 403) {
        return { 
          type: 'error', 
          message: 'authentication_failed',
          recoverable: false 
        };
      }
      
      if (apiError.statusCode === 429) {
        return { 
          type: 'error', 
          message: 'rate_limit_exceeded',
          recoverable: true,
          retryAfter: this.extractRetryAfter(apiError),
        };
      }
    }
    
    if (error.name === 'AbortError') {
      return { 
        type: 'error', 
        message: 'workflow_cancelled',
        recoverable: false 
      };
    }
  }
  
  return { 
    type: 'error', 
    message: error instanceof Error ? error.message : String(error),
    recoverable: true  // Default to recoverable
  };
}
```

**Runtime Error Recovery:**
```typescript
// packages/runtime/src/core.ts
async *executeWithRetry(): AsyncGenerator<WorkflowEvent> {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      for await (const event of this.aiAdapter.stream(options)) {
        if (event.type === 'error' && !event.recoverable) {
          yield event;
          throw new Error(event.message);  // Abort on fatal error
        }
        
        if (event.type === 'error' && event.recoverable) {
          yield event;  // Emit error but continue
          
          if (event.retryAfter) {
            await delay(event.retryAfter);
            attempts++;
            continue;  // Retry
          }
        }
        
        yield event;
      }
      
      return;  // Success
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        yield { type: 'error', message: 'max_retries_exceeded', recoverable: false };
        throw error;
      }
      
      yield { type: 'notice', message: `retry_attempt_${attempts}` };
      await delay(1000 * attempts);  // Exponential backoff
    }
  }
}
```

**Why This Works:**
- Clear error classification (recoverable vs fatal)
- Runtime handles retries transparently
- Router converts error events to tRPC errors
- Client sees progress even during retries
- Follows `.ruler/09-purity-and-performance.md`: "Fail fast, retry smart"

---

## Performance & Scalability

### Question 13: Context Caching

**Decision:** Keep existing cache strategy (Map with 5-minute TTL), cache key based on requirement hash.

**Key Files to Modify:**
- `packages/runtime/src/context-builder.ts`: Reuse caching from `context.ts`
- `packages/agent/src/orchestrator/flow/context.ts`: No changes needed

**Cache Implementation** (see Question 5 for full code)

**Cache Key:**
```typescript
private computeKey(input: ContextBuildInput): string {
  return createHash('sha256')
    .update(input.requirement)
    .update(input.workspace ?? '')
    .update((input.exts ?? []).join(','))
    .update((input.ignore ?? []).join(','))
    .update(String(input.topK ?? 25))
    .digest('hex');
}
```

**Cache Invalidation:**
- Time-based: 5-minute TTL (existing behavior)
- No event-based invalidation (too complex)
- User can force rebuild via `clearCache` flag in input

**Why This Works:**
- Preserves existing caching behavior (no regressions)
- Simple, predictable invalidation (time-based)
- No cache stampede (single-threaded builds)
- Follows `.ruler/09-purity-and-performance.md`: "Cache aggressively"

---

### Question 14: Parallel Execution

**Decision:** Multiple workflows CAN run concurrently for the same user, no runtime-level concurrency control.

**Key Files to Modify:**
- None (existing run registry already supports concurrent workflows)

**Concurrency Strategy:**

| Resource | Concurrency Control | Location |
|----------|---------------------|----------|
| Workflows (same user) | Allowed | None |
| File system (same repo) | Allowed (tools use locks) | Tool level (git, droid) |
| Database connections | Pooled | `packages/db/src/client.ts` |
| Knowledge graph writes | Queued | `packages/db/src/repo/graph.ts` |

**Tool-Level Locking:**
```typescript
// packages/agent/src/orchestrator/tool/git.ts
export const toolGit = {
  async execute({ input }) {
    // Git already handles file locking via .git/index.lock
    const result = await runGit({ args: ['commit', '-m', input.message] });
    return result;
  }
};
```

**Database Concurrency:**
```typescript
// packages/db/src/client.ts
export function createPgPool(options: PoolConfig = {}): Pool {
  return new Pool({
    min: options.min ?? 0,
    max: options.max ?? 10,  // 10 concurrent connections
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
  });
}
```

**Why This Works:**
- No artificial bottlenecks (workflows run in parallel)
- File contention handled by OS/tools (git locks)
- Database pooling prevents connection exhaustion
- Simple architecture (no distributed locking)
- Follows `.ruler/02-architecture.md`: "Keep it simple"

---

### Question 15: Memory Management

**Decision:** Runtime respects maxTokens from input, truncates context at build time, errors early if requirement + tools exceed model limit.

**Key Files to Modify:**
- `packages/runtime/src/context-builder.ts`: Add token budget validation
- `packages/agent/src/util/token.ts`: Reuse existing token estimator

**Token Budget Validation:**
```typescript
// packages/runtime/src/context-builder.ts
async build(input: ContextBuildInput): Promise<ExecutionContext> {
  const estimator = createTokenEstimator();
  
  // Calculate token budget
  const systemPromptTokens = estimator.estimate(SYSTEM_PROMPT);
  const toolSchemaTokens = estimator.estimate(JSON.stringify(this.tools));
  const requirementTokens = estimator.estimate(input.requirement);
  const overheadTokens = systemPromptTokens + toolSchemaTokens + requirementTokens;
  
  const contextBudget = input.maxTokens - overheadTokens;
  
  if (contextBudget < 2000) {
    throw new Error(
      `Insufficient token budget: requirement (${requirementTokens}) + ` +
      `tools (${toolSchemaTokens}) + system (${systemPromptTokens}) exceeds ` +
      `maxTokens (${input.maxTokens}). Need at least 2000 tokens for context.`
    );
  }
  
  // Build context with remaining budget
  const bundle = await buildContextBundle({
    cw: input.workspace,
    receipts: this.receipts,
    maxTokens: contextBudget,
  });
  
  // Verify final context fits
  const totalTokens = overheadTokens + bundle.estimatedTokens;
  if (totalTokens > input.maxTokens) {
    throw new Error(
      `Context bundle exceeded token budget: ${totalTokens} > ${input.maxTokens}`
    );
  }
  
  return { bundle, totalTokens };
}
```

**Runtime Token Tracking:**
```typescript
// packages/runtime/src/core.ts
async *execute(): AsyncGenerator<WorkflowEvent> {
  yield { 
    type: 'notice', 
    message: 'token_budget',
    tokens: {
      max: this.input.maxTokens,
      used: this.context.totalTokens,
      remaining: this.input.maxTokens - this.context.totalTokens,
    }
  };
  
  // Continue execution
}
```

**Why This Works:**
- Fails fast with clear error message
- Prevents OOM errors from oversized context
- Token estimation at build time (no surprises)
- Follows `.ruler/09-purity-and-performance.md`: "Set performance budgets"

---

### Question 16: Database Transactions

**Decision:** Use transactions for **atomic batch writes**, not for entire workflow. Best-effort for knowledge/learning updates.

**Key Files to Modify:**
- `packages/runtime/src/storage.ts`: New storage adapter with transaction support
- `packages/db/src/repo/workflow.ts`: Reuse existing transaction patterns

**Transaction Strategy:**

| Operation | Transactional | Rationale |
|-----------|---------------|-----------|
| Event batch writes (replay) | Yes | Must be atomic for replay consistency |
| Knowledge graph updates | No | Best-effort, async fire-and-forget |
| Learning ledger updates | No | Best-effort, async fire-and-forget |
| Run status updates | No | Single-row update, implicit transaction |

**Event Batch Persistence:**
```typescript
// packages/runtime/src/storage.ts
export class WorkflowStorage {
  async appendEventBatch(
    runId: string, 
    events: WorkflowEvent[]
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (const event of events) {
        await tx.insert(workflowEvents).values({
          runId,
          eventId: makeEventId({ runId, type: event.type, data: event }),
          eventType: event.type,
          eventData: redactEventData(event),
        });
      }
    });
  }
}
```

**Knowledge Updates (Best-Effort):**
```typescript
// packages/runtime/src/engines/knowledge-engine.ts
async persistUpdates(updates: KnowledgeUpdate[]): Promise<void> {
  // No transaction, fire-and-forget
  persistKnowledge(this.resource, updates).catch(error => {
    logger.warn('knowledge_persistence_failed', { 
      count: updates.length,
      error: error.message 
    });
  });
}
```

**Why This Works:**
- Atomic operations where it matters (event replay)
- Non-blocking for best-effort operations (knowledge, learning)
- Transaction duration is short (batch insert)
- Follows `.ruler/04-database.md`: "Use transactions for atomic operations"

---

## Migration & Compatibility

### Question 17: Backward Compatibility

**Decision:** Clean cutover (no parallel implementations), `WorkflowRuntime` emits identical `WorkflowEvent` types as `runPlanV6`.

**Key Files to Modify:**
- `packages/api/src/routers/workflow.ts`: Replace `runPlanV6` with `WorkflowRuntime`
- `packages/api/src/workflow/runner.ts`: Mark deprecated, add migration guide comment

**Migration Steps:**

| Step | Action | Files |
|------|--------|-------|
| 1. Implement runtime | Create runtime package | `packages/runtime/src/*` |
| 2. Add tests | Test runtime in isolation | `packages/runtime/test/*` |
| 3. Update router | Replace runner with runtime | `packages/api/src/routers/workflow.ts` |
| 4. Integration tests | Test end-to-end with real AI | `packages/api/test/workflow.router.test.ts` |
| 5. Deploy | Deploy to production | CI/CD |
| 6. Monitor | Watch metrics, error rates | Prometheus, Loki |
| 7. Deprecate | Mark runner as deprecated | `packages/api/src/workflow/runner.ts` |
| 8. Remove | Delete runner after 1 release | `packages/api/src/workflow/runner.ts` |

**Router Update:**
```typescript
// packages/api/src/routers/workflow.ts
-import { runPlanV6 } from '../workflow/runner';
+import { createRuntime } from '@alfred/runtime';

export const workflowRouter = router({
  stream: authedProcedure.subscription(({ input, ctx }) =>
    observable<WorkflowEvent>((emit) => {
-      const runner = runPlanV6(input, { signal: abortController.signal });
+      const runtime = createRuntime({ 
+        user: ctx.session.user, 
+        input,
+        signal: abortController.signal,
+      });
      
      (async () => {
-        for await (const event of runner.stream) {
+        for await (const event of runtime.execute()) {
          emit.next(event);
          await workflowRepo.appendEvent({ runId, ...event });
        }
      })();
    })
  ),
});
```

**Runner Deprecation:**
```typescript
// packages/api/src/workflow/runner.ts
/**
 * @deprecated Use WorkflowRuntime from @alfred/runtime instead.
 * This runner will be removed in v2.0.0.
 * 
 * Migration guide:
 * - Replace: runPlanV6(input, opts)
 * - With: createRuntime({ user, input, signal: opts.signal }).execute()
 */
export function runPlanV6(input: RunPlanInput, opts?: RunOptions): RunPlanV6 {
  // Keep implementation for backward compatibility during transition
}
```

**Why This Works:**
- Clean cutover reduces maintenance burden
- Identical events mean no consumer changes
- Deprecation period gives time for validation
- Follows `.ruler/02-architecture.md`: "Avoid maintaining parallel implementations"

---

### Question 18: Event Format Compatibility

**Decision:** `WorkflowRuntime` emits **identical** `WorkflowEvent` types that `runPlanV6` currently emits.

**Key Files to Modify:**
- `packages/type/src/plan.ts`: No changes needed (types stay the same)
- `packages/runtime/src/core.ts`: Import and use existing WorkflowEvent types

**Event Type Mapping:**

| Event Type | Current (`runPlanV6`) | Runtime | Changes |
|------------|----------------------|---------|---------|
| `run` | ✅ | ✅ | None |
| `progress` | ✅ | ✅ | None |
| `context` | ✅ | ✅ | None |
| `require-scope` | ✅ | ✅ | None |
| `notice` | ✅ | ✅ | None |
| `error` | ✅ | ✅ | None |
| `stdout` | ✅ | ✅ | None |
| `stderr` | ✅ | ✅ | None |
| `droid` | ✅ | ✅ | None |
| `data-cache-handoff` | ✅ | ✅ | None |
| `assistant` | ❌ | ✅ | **New** (from AI SDK) |
| `tool-call` | ❌ | ✅ | **New** (from AI SDK) |
| `tool-result` | ❌ | ✅ | **New** (from AI SDK) |

**Runtime Implementation:**
```typescript
// packages/runtime/src/core.ts
import type { WorkflowEvent } from '@alfred/type/plan';

export class WorkflowRuntime {
  async *execute(): AsyncGenerator<WorkflowEvent> {
    // Emit same events as runPlanV6
    yield { type: 'run', id: this.runId };
    yield { type: 'progress', pct: 10, message: 'initializing' };
    yield { type: 'context', phase: 'scan', receipts: context.receipts };
    
    // New AI SDK events (backward compatible, UI ignores unknown types)
    yield { type: 'assistant', text: 'Planning...' };
    yield { type: 'tool-call', id: 'tc-1', toolName: 'grep', args: {} };
    yield { type: 'tool-result', id: 'tc-1', toolName: 'grep', result: {} };
    
    yield { type: 'progress', pct: 100, message: 'completed' };
  }
}
```

**Consumer Compatibility:**
```typescript
// apps/web/src/routes/orchestrator/run.tsx
// UI already handles unknown event types gracefully
function handleEvent(event: WorkflowEvent) {
  switch (event.type) {
    case 'run':
      setRunId(event.id);
      break;
    case 'progress':
      setProgress(event.pct);
      break;
    // New events ignored by current UI (no changes needed)
    case 'assistant':
    case 'tool-call':
    case 'tool-result':
      // Future: render these in UI
      break;
    default:
      // Unknown events ignored
      break;
  }
}
```

**Why This Works:**
- Zero breaking changes for existing consumers
- New events are additive (backward compatible)
- UI can adopt new events incrementally
- Follows `.ruler/02-architecture.md`: "Maintain backward compatibility"

---

### Question 19: Resume Compatibility

**Decision:** `WorkflowRuntime` handles same resume payloads as `runPlanV6`, router does not translate.

**Key Files to Modify:**
- `packages/runtime/src/core.ts`: Implement resume logic identical to runner
- `packages/api/src/routers/workflow.ts`: No changes to resume endpoint

**Resume Flow:**
```
1. Client calls workflow.resume({ runId, event, authz })
2. Router calls runRegistry.dispatchResume(runId, payload)
3. Run registry routes to correct instance
4. Runtime's resume() method is called
5. Runtime resolves resumeWaiter promise
6. Generator continues execution
7. Event stream resumes
```

**Runtime Resume Implementation:**
```typescript
// packages/runtime/src/core.ts
export class WorkflowRuntime {
  private resumeResolver: ((payload: ResumePayload) => void) | null = null;
  private resumeQueue: ResumePayload[] = [];
  
  async resume(payload: ResumePayload): Promise<void> {
    if (this.resumeResolver) {
      // In-flight wait, resolve immediately
      this.resumeResolver(payload);
      this.resumeResolver = null;
    } else {
      // Not waiting yet, queue for next wait
      this.resumeQueue.push(payload);
    }
  }
  
  private async waitForResume(
    requiredEvent: ResumePayload['event']
  ): Promise<ResumePayload> {
    // Check queue first
    const queued = this.resumeQueue.find(p => p.event === requiredEvent);
    if (queued) {
      this.resumeQueue = this.resumeQueue.filter(p => p !== queued);
      return queued;
    }
    
    // Wait for new resume
    return new Promise<ResumePayload>((resolve) => {
      this.resumeResolver = resolve;
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.resumeResolver = null;
        resolve(null as any);  // Timeout, continue without authz
      }, 10_000);
    });
  }
  
  async *execute(): AsyncGenerator<WorkflowEvent> {
    // Request elevated scopes for medium/high autonomy
    if (this.input.auto === 'medium' || this.input.auto === 'high') {
      yield { type: 'require-scope', scopes: ['repo.write'], event: 'bio-authz' };
      
      const resume = await this.waitForResume('bio-authz');
      
      if (resume) {
        yield { type: 'notice', message: `Authorization '${resume.event}' acknowledged.` };
      }
    }
    
    // Continue execution
  }
}
```

**Router Pass-Through:**
```typescript
// packages/api/src/routers/workflow.ts
resume: authedProcedure
  .input(z.object({
    runId: z.string().min(1),
    event: z.enum(['deploy-authz', 'linear-authz', 'bio-authz']),
    authz: z.string().min(1),
  }))
  .mutation(async ({ input }) => {
    // Direct dispatch, no translation
    const delivered = await runRegistry.dispatchResume(input.runId, {
      event: input.event,
      authz: input.authz,
    });
    
    if (!delivered) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'run_not_found' });
    }
    
    return { ok: true };
  }),
```

**Why This Works:**
- Same resume payloads as current runner
- Router stays thin (no translation logic)
- Runtime owns resume semantics
- Follows `.ruler/02-architecture.md`: "Business logic in domain layer, not transport layer"

---

## Testing & Observability

### Question 20: Testability & Observability

**Decision:** Test runtime with mock AI SDK via dependency injection, verify domain packages called via spies.

**Key Files to Modify:**
- `packages/runtime/test/core.test.ts`: New test file for runtime
- `packages/runtime/test/utils/mock-ai-sdk.ts`: New mock AI SDK implementation
- `packages/api/test/workflow.router.test.ts`: Update to test with runtime

**Mock AI SDK:**
```typescript
// packages/runtime/test/utils/mock-ai-sdk.ts
import { MockLanguageModelV1 } from 'ai/test';
import { convertArrayToReadableStream } from 'ai';

export function createMockModel() {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        // Yield deterministic events with correct AI SDK v6 property names
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Planning...' },  // FIXED: was textDelta
        { type: 'text-end', id: 'text-1' },
        
        { 
        type: 'tool-call', 
        toolCallId: 'tc-1',
        toolName: 'grep',
          input: { pattern: 'test' },  // FIXED: was args
        },
      
        {
        type: 'tool-result',
        toolCallId: 'tc-1',
        toolName: 'grep',
          input: { pattern: 'test' },   // Include input
          output: { matches: ['test'] }, // FIXED: was result
        },
        
        { type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}
```

**Runtime Unit Test:**
```typescript
// packages/runtime/test/core.test.ts
import { describe, expect, it, vi } from 'bun:test';
import { WorkflowRuntime } from '../src/core';
import { createMockModel } from './utils/mock-ai-sdk';

describe('WorkflowRuntime', () => {
  it('executes workflow phases in order', async () => {
    const mockModel = createMockModel();  // Use MockLanguageModelV1
    const mockCognitive = {
      capture: vi.fn().mockReturnValue({ _: 'capturing' }),
      think: vi.fn().mockReturnValue({ _: 'thinking' }),
    };
    
    const runtime = new WorkflowRuntime({
      model: mockModel,          // Inject mock model instead of mocking streamText
      cognitive: mockCognitive,
      // ... other mocks
    });
    
    const events: WorkflowEvent[] = [];
    for await (const event of runtime.execute()) {
      events.push(event);
    }
    
    // Verify phase order (updated with text lifecycle events)
    expect(events.map(e => e.type)).toEqual([
      'run',
      'progress',
      'context',
      'text-start',      // Added: text block start
      'text-delta',
      'text-end',        // Added: text block end
      'tool-call',
      'tool-result',
      'progress',
    ]);
    
    // Verify domain packages called
    expect(mockCognitive.capture).toHaveBeenCalledWith('test requirement');
    expect(mockCognitive.think).toHaveBeenCalled();
  });
  
  it('handles AI SDK errors gracefully', async () => {
    const mockStreamText = createMockStreamText();
    mockStreamText.mockImplementation(async () => ({
      async *fullStream() {
        yield { type: 'error', error: { message: 'rate_limit_exceeded' } };
      },
    }));
    
    const runtime = new WorkflowRuntime({ streamText: mockStreamText });
    
    const events: WorkflowEvent[] = [];
    for await (const event of runtime.execute()) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === 'error')).toBe(true);
    expect(events.find(e => e.type === 'error')?.message).toContain('rate_limit');
  });
});
```

**Integration Test with Real AI:**
```typescript
// packages/api/test/workflow.router.integration.test.ts
describe('workflow router with real AI', () => {
  it('executes workflow end-to-end', async () => {
    // Uses real AI SDK (recorded fixtures for determinism)
    const caller = await createTestCaller({ scopes: ['workflow.plan'] });
    
    const subscription = caller.workflow.stream({
      requirement: 'create hello world app',
      auto: 'low',
    });
    
    const events: WorkflowEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: (event) => events.push(event),
        error: reject,
        complete: resolve,
      });
    });
    
    expect(events[0].type).toBe('run');
    expect(events[events.length - 1]).toMatchObject({
      type: 'progress',
      pct: 100,
    });
  });
});
```

**Observability Instrumentation:**
```typescript
// packages/runtime/src/core.ts
export class WorkflowRuntime {
  async *execute(): AsyncGenerator<WorkflowEvent> {
    const stopTimer = workflowExecutionDurationSeconds.startTimer({
      auto: this.input.auto,
    });
    
    workflowExecutionsTotal.inc({ auto: this.input.auto, status: 'started' });
    
    try {
      yield* this.runPhases();
      
      workflowExecutionsTotal.inc({ auto: this.input.auto, status: 'completed' });
      stopTimer({ status: 'completed' });
    } catch (error) {
      workflowExecutionsTotal.inc({ auto: this.input.auto, status: 'failed' });
      stopTimer({ status: 'failed' });
      
      logger.error('workflow_execution_failed', {
        runId: this.runId,
        auto: this.input.auto,
        error: error.message,
      });
      
      throw error;
    }
  }
}
```

**Why This Works:**
- Dependency injection makes testing easy
- Mock AI SDK provides deterministic tests
- Integration tests use real AI with fixtures
- Metrics and logging follow existing patterns
- Follows `.ruler/05-testing.md`: "Test units in isolation, integrate end-to-end"

---

## Implementation Plan

### Phase 3.1: Runtime Core (Week 1)

**Files to Create:**
```
packages/runtime/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Public API exports
│   ├── core.ts                     # WorkflowRuntime class
│   ├── types.ts                    # Runtime-specific types
│   └── state.ts                    # Runtime state management
└── test/
    ├── core.test.ts                # Unit tests for runtime
    └── utils/
        └── mock-ai-sdk.ts          # Mock AI SDK for testing
```

**Implementation Steps:**

1. **Create runtime package structure**
   - Add `packages/runtime/package.json` with dependencies
   - Add `packages/runtime/tsconfig.json` extending base
   - Update `turbo.json` to include runtime in build

2. **Implement core runtime**
   - Create `WorkflowRuntime` class with AsyncGenerator interface
   - Implement phase orchestration (scan, plan, act, report)
   - Add cancellation support via AbortController
   - Add resume support via promise queue

3. **Add unit tests**
   - Test phase execution order
   - Test cancellation
   - Test resume logic
   - Test error handling

**Acceptance Criteria:**
- [ ] Runtime executes phases in correct order
- [ ] Runtime emits `WorkflowEvent` types matching `runPlanV6`
- [ ] Runtime supports cancellation
- [ ] Runtime supports resume
- [ ] All unit tests pass

---

### Phase 3.2: Domain Package Integration (Week 1)

**Files to Create:**
```
packages/runtime/src/
├── engines/
│   ├── cognitive-engine.ts         # Cognitive state wrapper
│   ├── knowledge-engine.ts         # Knowledge graph wrapper
│   ├── learning-engine.ts          # Learning loop wrapper
│   └── policy-engine.ts            # Policy evaluation wrapper
├── adapters/
│   ├── ai-sdk-adapter.ts           # AI SDK v6 event mapper
│   └── storage-adapter.ts          # Database persistence adapter
└── context-builder.ts              # Context building logic
```

**Implementation Steps:**

1. **Create engine wrappers**
   - `CognitiveEngine`: Wrap cognitive state functions
   - `KnowledgeEngine`: Wrap knowledge graph queries
   - `LearningEngine`: Wrap learning/supervision functions
   - `PolicyEngine`: Wrap policy evaluation

2. **Create adapters**
   - `AISDKAdapter`: Map AI SDK events to WorkflowEvent
   - `StorageAdapter`: Abstract database operations

3. **Implement context builder**
   - Wrap existing context functions from `@alfred/agent`
   - Add caching with 5-minute TTL
   - Add token budget validation

4. **Add integration tests**
   - Test engine wrappers call domain functions
   - Test adapter maps events correctly
   - Test context builder caching

**Acceptance Criteria:**
- [ ] Runtime calls domain packages via engines
- [ ] AI SDK events map to WorkflowEvent types
- [ ] Context caching works with existing TTL
- [ ] Token budget validation rejects oversized context
- [ ] All integration tests pass

---

### Phase 3.3: Router Integration (Week 2)

**Files to Modify:**
```
packages/api/src/
├── routers/
│   └── workflow.ts                 # Replace runPlanV6 with runtime
└── workflow/
    └── runner.ts                   # Mark deprecated
```

**Implementation Steps:**

1. **Update workflow router**
   - Replace `runPlanV6` with `WorkflowRuntime`
   - Update `start` endpoint to create runtime
   - Update `stream` endpoint to consume runtime generator
   - Keep `resume` endpoint unchanged (runtime handles it)

2. **Update tests**
   - Update `workflow.router.test.ts` to use runtime
   - Add integration tests with mock AI SDK
   - Add end-to-end tests with real AI (recorded fixtures)

3. **Mark runner deprecated**
   - Add deprecation comment to `runPlanV6`
   - Add migration guide to doc comment

**Acceptance Criteria:**
- [ ] Router uses runtime instead of runner
- [ ] All existing tests pass
- [ ] Event schema unchanged (backward compatible)
- [ ] Resume functionality works

---

### Phase 3.4: Performance Optimization (Week 2)

**Files to Modify:**
```
packages/runtime/src/
├── context-builder.ts              # Add caching metrics
├── core.ts                         # Add execution metrics
└── engines/
    └── learning-engine.ts          # Batch knowledge updates
```

**Implementation Steps:**

1. **Add performance metrics**
   - Track context build time
   - Track phase execution time
   - Track AI SDK call duration
   - Track knowledge persistence time

2. **Optimize batch operations**
   - Batch knowledge graph writes
   - Batch learning ledger updates
   - Use database transactions for atomicity

3. **Add performance tests**
   - Test context caching reduces build time
   - Test batch writes faster than individual
   - Test token budget validation rejects early

**Acceptance Criteria:**
- [ ] Context build time < 5 seconds (cached < 50ms)
- [ ] Knowledge batch writes < 1 second
- [ ] All performance budgets met

---

### Phase 3.5: Observability & Monitoring (Week 3)

**Files to Create:**
```
packages/runtime/src/
└── metrics.ts                      # Runtime-specific metrics
```

**Implementation Steps:**

1. **Add runtime metrics**
   - `runtime_executions_total` (counter by auto, status)
   - `runtime_phase_duration_seconds` (histogram by phase)
   - `runtime_context_build_duration_seconds` (histogram)
   - `runtime_ai_sdk_calls_total` (counter by model)

2. **Add structured logging**
   - Log phase transitions
   - Log context build results
   - Log AI SDK errors
   - Log knowledge persistence failures

3. **Add tracing**
   - Trace runtime execution
   - Trace domain package calls
   - Trace AI SDK calls
   - Trace database operations

**Acceptance Criteria:**
- [ ] All metrics emitted correctly
- [ ] Logs are structured and searchable
- [ ] Traces show execution timeline
- [ ] Dashboards updated with runtime metrics

---

### Phase 3.6: Migration & Cleanup (Week 3)

**Files to Modify/Remove:**
```
packages/api/src/
└── workflow/
    └── runner.ts                   # Remove after migration
```

**Implementation Steps:**

1. **Deploy runtime to production**
   - Deploy behind feature flag
   - Monitor metrics and error rates
   - Validate event schema compatibility

2. **Cutover to runtime**
   - Remove feature flag
   - Monitor for regressions
   - Update documentation

3. **Remove deprecated runner**
   - Delete `runPlanV6` function
   - Delete `runner.ts` file
   - Update imports

**Acceptance Criteria:**
- [ ] Runtime deployed to production
- [ ] No regressions in metrics
- [ ] Event consumers unchanged
- [ ] Runner removed from codebase

---

## Risk Analysis

### High-Risk Areas

1. **AI SDK Event Mapping**
   - **Risk**: AI SDK events don't map cleanly to WorkflowEvent types
   - **Mitigation**: Extensive testing with mock AI SDK, fallback for unknown events
   - **Contingency**: Add adapter layer to normalize events

2. **Resume Logic**
   - **Risk**: Multi-instance resume fails due to race conditions
   - **Mitigation**: Use run registry for coordination, add timeout for resume
   - **Contingency**: Fall back to single-instance mode (no Redis)

3. **Token Budget**
   - **Risk**: Context exceeds token limit during execution
   - **Mitigation**: Validate budget at build time, truncate context if needed
   - **Contingency**: Fail early with clear error message

4. **Performance Regression**
   - **Risk**: Runtime slower than current runner
   - **Mitigation**: Performance tests, profiling, aggressive caching
   - **Contingency**: Optimize hot paths, consider parallel execution

### Medium-Risk Areas

1. **Domain Package Integration**
   - **Risk**: Domain packages change API, breaking runtime
   - **Mitigation**: Engine wrappers isolate runtime from domain changes
   - **Contingency**: Update engine wrappers, maintain backward compatibility

2. **Event Schema Evolution**
   - **Risk**: New event types break consumers
   - **Mitigation**: Additive-only changes, backward compatibility
   - **Contingency**: Version event schemas, support multiple versions

3. **Database Transactions**
   - **Risk**: Long transactions cause deadlocks
   - **Mitigation**: Short transactions, batch writes
   - **Contingency**: Reduce transaction scope, add retries

---

## Success Criteria

### Functional Requirements

- [ ] Runtime executes workflows end-to-end
- [ ] Runtime emits identical events to `runPlanV6`
- [ ] Runtime supports cancellation
- [ ] Runtime supports resume
- [ ] Runtime integrates with all domain packages (cognitive, knowledge, learning, policy)
- [ ] Runtime works with existing router (no breaking changes)

### Non-Functional Requirements

- [ ] Context build time < 5 seconds (cached < 50ms)
- [ ] Phase execution time < 30 minutes
- [ ] Memory usage < 1GB per workflow
- [ ] Token budget validation rejects oversized context
- [ ] All unit tests pass (>95% coverage)
- [ ] All integration tests pass
- [ ] All performance tests pass

### Observability Requirements

- [ ] All metrics emitted correctly
- [ ] Logs are structured and searchable
- [ ] Traces show execution timeline
- [ ] Dashboards updated with runtime metrics

---

## Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| 3.1: Runtime Core | Week 1 | Runtime executes phases |
| 3.2: Domain Integration | Week 1 | Runtime calls domain packages |
| 3.3: Router Integration | Week 2 | Router uses runtime |
| 3.4: Performance | Week 2 | Performance budgets met |
| 3.5: Observability | Week 3 | Metrics, logs, traces |
| 3.6: Migration | Week 3 | Runner removed |

**Total: 3 weeks**

---

## Conclusion

This implementation plan provides:
- **Clear architecture** with explicit boundaries and ownership
- **Testable design** via dependency injection
- **Backward compatibility** with existing event consumers
- **Performance optimization** via caching and batching
- **Observability** via metrics, logs, and traces
- **Clean migration path** from `runPlanV6` to `WorkflowRuntime`

The runtime layer will serve as a solid foundation for future enhancements while maintaining the stability and performance of the existing system.

---

## Revision History

**2025-11-16 (Initial)**: Added ExecPlan progress tracking sections (Progress, Surprises & Discoveries, Decision Log, Outcomes & Retrospective) to comply with `.agent/PLANS.md` requirements. This makes the document a proper living document that must be maintained as implementation proceeds. Broke down the 6 implementation phases into 75+ granular checkboxes for tracking progress. Captured all major architectural decisions from the original analysis in the Decision Log with rationales.

**2025-11-16 (AI SDK v6 Audit)**: Completed systematic audit of AI SDK v6 references against official documentation. Fixed critical property name mismatches in Question 9 (`AISDKAdapter.mapEvent()`): `textDelta` → `delta`, `args` → `input`, `result` → `output`. Added missing `id` field to `text-delta` events. Updated event mapping table in Question 10. Replaced mock streamText implementation in Question 20 with AI SDK's `MockLanguageModelV1` for better test reliability. Added handlers for additional event types (text lifecycle, reasoning, steps, abort). Full audit findings documented in `docs/execplans/runtime-integration-ai-sdk-audit.md`.