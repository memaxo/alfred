# Orchestrator Fragmentation Retrospective

**Date:** January 2026  
**Scope:** `packages/runtime/src/workflow/`, `packages/runtime/src/orchestrator/`, `packages/runtime/src/phases/`

## The Numbers

```
orchestrator/     19 files    7,870 lines
workflow/         12 files    2,500+ lines
phases/            4 files    1,200+ lines
─────────────────────────────────────────
Total             35+ files   11,500+ lines
```

## What Went Wrong

### 1. Feature Accretion Without Boundaries

**Pattern:** Each new capability was bolted onto the existing structure rather than designed into a coherent whole.

```
Initial:     orchestrate() → execute()
+Linear:     orchestrate() → ensureTicket() → execute() → syncLinear()
+Review:     orchestrate() → ensureTicket() → execute() → review() → syncLinear()
+Learning:   orchestrate() → ensureTicket() → execute() → review() → learn() → syncLinear()
+Resume:     orchestrate() → loadHistory() → hydrate() → ensureTicket() → execute() → ...
```

Each feature added 50-200 lines to the orchestrator. Nobody stepped back to ask: _"Should this be a separate concern?"_

### 2. Premature Extraction

**Pattern:** Small functions extracted into separate files before the abstraction was clear.

```
orchestrator/
├── agents.ts        38 lines   ← Too small to be a file
├── convert.ts       43 lines   ← Could be inline
├── flatten.ts       27 lines   ← 1 function
├── handoff.ts       49 lines   ← 2 functions
├── hydrate.ts       51 lines   ← Could merge with resume.ts
├── resume.ts        45 lines   ← Could merge with hydrate.ts
├── suspend.ts       33 lines   ← 1 function
└── summary.ts       47 lines   ← 1 function
```

These files don't represent coherent modules—they're just functions that got big enough to move out of the main file. The extraction reduced line count per file but increased cognitive load (35+ files to navigate).

### 3. Overlapping Directories

**Pattern:** Three directories doing related things with unclear boundaries.

```
workflow/        Entry point, lifecycle, persistence, Linear sync
orchestrator/    Waves, agents, review, merge, events
phases/          Scan, plan, act, report
```

**The confusion:**

- Is `workflow/linear.ts` or `orchestrator/` responsible for Linear?
- Is `phases/act.ts` or `orchestrator/waves.ts` responsible for execution?
- Where does review live? (`workflow/review-gate.ts`? `orchestrator/review.ts`?)

**Root cause:** We didn't define clear responsibility boundaries upfront.

### 4. The Callback God Object

**Pattern:** `OrchestratorCallbacks` became a dumping ground for every cross-cutting concern.

```typescript
export type OrchestratorCallbacks = {
  triggerPreferenceRefresh: (userId: string, payload: { reason: string }) => void;
  ensureObligations?: (ctx: unknown) => void;
  context?: unknown;  // ← What is this? Everything.
  emitError: (error: unknown) => void;
  emitNext: (event: WorkflowEvent) => void;
  emitComplete: () => void;
  emitUiMessages?: (...) => void;
};
```

Every new feature that needed to "communicate out" got a new callback. This inverted dependencies incorrectly—the orchestrator shouldn't know about UI messages, preference refresh, or obligations.

### 5. Generator Misuse

**Pattern:** Generators used for side effects, not iteration.

```typescript
// phases/act.ts
export async function* executeActPhase(...): AsyncGenerator<WorkflowEvent, ActResult, void> {
  yield { _: "progress", message: "starting" };
  // ... 400 lines of execution ...
  yield { _: "agent-complete", ... };
  // ... more execution ...
  return result;
}
```

Generators are great for lazy iteration. We used them to emit events during execution—mixing control flow with side effects. This made the code harder to test (must consume generator to completion) and reason about (events scattered throughout).

### 6. State Management via Closures

**Pattern:** State spread across 20+ local variables in a 549-line function.

```typescript
export async function orchestrateWorkflowStream(...) {
  let runId: string | null = null;
  let executorRunId: string | null = null;
  let outerRunId: string | null = null;
  let workflowConversationId: string | null = null;
  let linearIssueUrlFromCreation: string | null = null;
  let linearFailureNotified = false;
  let cancelled = false;
  let suspended = false;
  const persistedMessageKeys = new Set<string>();
  const reasonTraces: ReasonTrace[] = [];
  const handoffs: Array<{ summary: string }> = [];
  const reviewGate = new ReviewGate();
  // ... 500 more lines using these variables
}
```

This is implicit state management. You can't understand what state is available without reading the entire function. Testing requires mocking everything.

## The Core Mistake

**We treated the orchestrator as a place to put code, not as an architecture.**

Good architecture asks: _"What are the responsibilities? What are the boundaries? How do they communicate?"_

We asked: _"Where should this new feature go?"_ and answered: _"In the orchestrator, I guess."_

## What the Pipeline Got Right

| Orchestrator Anti-Pattern | Pipeline Solution                                   |
| ------------------------- | --------------------------------------------------- |
| Feature accretion         | Explicit stages with typed boundaries               |
| Premature extraction      | Stages are the unit of extraction                   |
| Overlapping directories   | Single `packages/pipeline/` package                 |
| Callback god object       | Observer pattern (add observers, don't modify core) |
| Generator misuse          | Stages return values; events via `ctx.emit()`       |
| Closure state             | Explicit `PipelineContext.get/set()`                |

## Lessons Learned

### 1. Define Boundaries Before Writing Code

Before implementing a feature, ask:

- What is this feature's single responsibility?
- What does it need as input? What does it produce?
- How does it communicate with other concerns?

### 2. Resist Premature Extraction

Don't create a file for every function. A file should represent a **coherent module** with:

- Clear responsibility
- Stable interface
- Internal cohesion

**Rule of thumb:** If a file has < 100 lines and exports only 1-2 functions, it probably shouldn't be a file.

### 3. Prefer Composition Over Callbacks

Instead of:

```typescript
function orchestrate(input, callbacks: { onProgress, onComplete, onError, ... })
```

Use:

```typescript
const runner = new Runner();
runner.addObserver(new ProgressObserver());
runner.addObserver(new ErrorObserver());
runner.run(input);
```

### 4. Make State Explicit

Instead of:

```typescript
function bigFunction() {
  let state1, state2, state3, ...;
  // 500 lines using state
}
```

Use:

```typescript
interface Context {
  get<T>(key: string): T;
  set(key: string, value: unknown): void;
}
```

### 5. Separate Data Flow from Side Effects

Instead of:

```typescript
function* process() {
  yield sideEffect1(); // Mixed!
  const data = transform(input);
  yield sideEffect2(); // Mixed!
  return data;
}
```

Use:

```typescript
function process(input, ctx) {
  ctx.emit(event1); // Side effects via context
  const data = transform(input); // Pure transformation
  ctx.emit(event2);
  return data; // Return value is the result
}
```

## Summary

The orchestrator fragmented because we added features incrementally without architectural discipline. Each addition was locally reasonable but globally incoherent.

**The fix isn't "better code organization"—it's "better architecture upfront."**

The pipeline succeeds not because it has fewer files, but because it has **clear responsibilities, explicit boundaries, and a composition model** that doesn't require modifying the core to add features.

## Action Items

1. ✅ Complete pipeline implementation
2. ⏳ Migrate to pipeline (in progress)
3. ⏳ Delete orchestrator code after migration
4. ⏳ Apply these lessons to other complex systems (cognitive, knowledge)
