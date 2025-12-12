# Common Patterns Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide documents common code patterns used throughout ALFRED. These patterns solve recurring problems and should be followed consistently.

## Patterns

### 1. Variable-Based Dynamic Imports (SSR Hardening)

**Problem:** Vite statically analyzes string literals in dynamic imports, causing server-only packages to leak into client bundles.

**Solution:** Use variable-based dynamic imports in API routes.

**Pattern:**
```typescript
// ✅ CORRECT
const dbPkg = "@alfred/db";
const { db } = await import(dbPkg);

// ❌ INCORRECT (Vite will bundle this)
const { db } = await import("@alfred/db");
```

**Examples:**
- `apps/web/src/routes/api/assistant/$.ts` - Uses `agentPkg` variable
- `apps/web/src/routes/api/orchestrator/$.ts` - Uses `agentPkg` variable
- `apps/web/src/routes/api/linear/webhook.ts` - Uses variable-based imports

**Exception:** Local server-only files can use static strings:
```typescript
// ✅ OK for local files
const { helper } = await import("./helper");
```

### 2. Bulk Update Optimization

**Problem:** `Promise.all` loops for bulk updates create many DB roundtrips.

**Solution:** Use single SQL `UPDATE ... FROM (VALUES ...)` statement.

**Pattern:**
```typescript
// ✅ CORRECT: Single SQL statement
await db.update(table)
  .set({
    properties: sql`
      CASE
        WHEN table.properties IS NULL THEN jsonb_build_object('confidence', v.confidence)
        ELSE jsonb_set(table.properties, '{confidence}', to_jsonb(v.confidence))
      END
    `,
    updated: sql`NOW()`,
  })
  .from(sql`(VALUES ${sql.join(
    updates.map(u => sql`(${u.id}::uuid, ${u.confidence})`),
    sql`, `
  )}) AS v(id, confidence)`)
  .where(sql`table.id = v.id`);

// ❌ INCORRECT: Promise.all loop (many roundtrips)
await Promise.all(
  updates.map(u => updateNodeConfidence(u.id, u.confidence))
);
```

**Current Status:** Implemented. `updateNodeConfidenceBatch` uses a set-based bulk update (`UPDATE ... FROM (VALUES ...)`) in `packages/db/src/repo/graph/write.ts`.

**Reference:** `.ruler/19-drizzle-patterns.md` rule 10

### 3. Metrics Lazy Loading

**Problem:** Circular dependencies when importing metrics from agent package.

**Solution:** Lazy load metrics with try/catch guards.

**Pattern:**
```typescript
// Mock metrics for tests/circular dep avoidance
const mockHistogram = { startTimer: () => () => {} };
const mockCounter = { inc: () => {} };

let metrics = {
  myMetric: mockHistogram,
};

// Lazy load real metrics
const loadMetrics = async () => {
  try {
    const apiMetrics = await import("@alfred/api/metrics");
    if (apiMetrics.myMetric) {
      metrics = apiMetrics;
    }
  } catch {
    // Keep mocks (tests, local scripts)
  }
};
void loadMetrics();
```

**Examples:**
- `packages/agent/src/orchestrator/learning-worker.ts` - Lazy loads memory metrics
- `packages/agent/src/orchestrator/linear.ts` - Uses `getLinearMetrics()` adapter

**Reference:** `.ruler/18-observability.md` rule 6

### 4. Fire-and-Forget Operations

**Problem:** Non-critical operations (like Linear activities) shouldn't block workflow execution.

**Solution:** Fire-and-forget with error logging.

**Pattern:**
```typescript
// ✅ CORRECT: Fire-and-forget
emitLinearActivity("thought", params)
  .catch((error) => {
    logger.warn("linear_activity_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

// ❌ INCORRECT: Blocking await
await emitLinearActivity("thought", params); // Blocks workflow
```

**Examples:**
- `packages/api/src/routers/workflow.ts` - Linear activity emissions
- `packages/agent/src/orchestrator/linear.ts` - All helper functions are fire-and-forget

**When to Use:**
- Non-critical side effects (logging, metrics, notifications)
- Operations that shouldn't block main flow
- External API calls that may fail

**When NOT to Use:**
- Critical operations (DB writes, auth checks)
- Operations that affect workflow outcome
- Operations that must complete before continuing

### 5. Pure Function Boundaries

**Problem:** Mixing pure logic with side effects makes code hard to test and reason about.

**Solution:** Keep pure functions separate from I/O boundaries.

**Pattern:**
```typescript
// ✅ CORRECT: Pure function
export function applyTransition(
  state: CognitiveState,
  autonomy: AutonomyGradient,
  event: Event
): TransitionResult {
  // Pure logic only - no DB, no HTTP, no side effects
  return { state: newState, autonomy: newAutonomy };
}

// ✅ CORRECT: Boundary handles I/O
export async function runCognitiveLoop(
  ctx: RuntimeContext,
  streamId: string,
  event: Event
) {
  // Load from DB (I/O)
  const events = await cognitiveRepo.getAllEvents(streamId);
  
  // Apply pure transition
  const result = applyTransition(state, autonomy, event);
  
  // Persist to DB (I/O)
  await cognitiveRepo.appendEvent(streamId, event._, event);
  
  return result;
}
```

**Layer Map:**
- **Pure:** `packages/cognitive/`, `packages/knowledge/src/graph/`, flow functions
- **Boundary:** `packages/api/src/routers/`, `packages/db/src/repos/`, schedulers

**Reference:** `.ruler/09-purity-and-performance.md` rule 1

### 6. Error Handling with Context

**Problem:** Generic errors don't provide enough context for debugging.

**Solution:** Always include context in error messages.

**Pattern:**
```typescript
// ✅ CORRECT: Context included
logger.error("workflow_failed", {
  runId,
  workflowId,
  error: error.message,
  duration: durationMs,
});

// Use toTRPCError for unknown errors
throw toTRPCError(error, "failed_to_create_run");

// ❌ INCORRECT: Generic error
throw new Error("Failed");
```

**Reference:** `.ruler/16-error-handling.md`

### 7. Performance Budget Instrumentation

**Problem:** Hot paths exceed budgets without measurement.

**Solution:** Instrument before optimizing.

**Pattern:**
```typescript
// ✅ CORRECT: Instrument first
const start = performance.now();
const result = applyTransition(state, autonomy, event);
const duration = performance.now() - start;

if (duration > 100) { // Budget: <100µs
  logger.warn("cognitive_budget_exceeded", {
    duration,
    budget: 100,
  });
}

// Then optimize if needed
```

**Reference:** `.ruler/09-purity-and-performance.md` rule 7

### 8. AbortSignal Propagation

**Problem:** Long-running operations don't respect cancellation.

**Solution:** Always propagate AbortSignal through async chains.

**Pattern:**
```typescript
// ✅ CORRECT: Propagate signal
async function processWorkflow(
  runId: string,
  signal: AbortSignal
) {
  const result = await fetchData(signal); // Pass signal
  await processResult(result, signal); // Pass signal
}

// Check cancellation
if (signal.aborted) {
  throw new Error("Cancelled");
}
```

**Reference:** `.ruler/13-streaming-patterns.md` rule 10

### 9. Stable References for React

**Problem:** Inline functions cause unnecessary re-renders.

**Solution:** Use `useCallback` and `useMemo` for stable references.

**Pattern:**
```typescript
// ✅ CORRECT: Stable callback
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);

// ✅ CORRECT: Memoized value
const filteredItems = useMemo(
  () => items.filter(predicate),
  [items, predicate]
);

// ❌ INCORRECT: Inline function
<Button onClick={() => doSomething()} />
```

**Reference:** `.ruler/12-component-development.md` rule 3

### 10. Type-Safe Database Queries

**Problem:** Raw SQL loses type safety and is error-prone.

**Solution:** Always use Drizzle query builder.

**Pattern:**
```typescript
// ✅ CORRECT: Type-safe query
const [row] = await db
  .select()
  .from(memoryNodes)
  .where(eq(memoryNodes.id, nodeId))
  .limit(1);

// ❌ INCORRECT: Raw SQL
await db.execute(sql`SELECT * FROM memory_nodes WHERE id = ${nodeId}`);
```

**Reference:** `.ruler/19-drizzle-patterns.md` rule 1

## Anti-Patterns to Avoid

### 1. Premature Abstraction

❌ **Don't:** Create abstractions before understanding the domain  
✅ **Do:** Extract when duplication exceeds 80% threshold

### 2. Dependency Injection Containers

❌ **Don't:** Use DI containers or `{ db, logger, cache }` parameter objects  
✅ **Do:** Use direct imports or function parameters

### 3. Type Suppressions

❌ **Don't:** Use `@ts-expect-error` to bypass type errors  
✅ **Do:** Fix the root cause or use proper type assertions after validation

### 4. Mocking Real Systems

❌ **Don't:** Mock `@alfred/voice` or `@alfred/runtime` in tests  
✅ **Do:** Use fixtures from `@alfred/test-kit` that run real systems

## Related Documentation

- [Purity and Performance Rules](../../.ruler/09-purity-and-performance.md)
- [Drizzle Patterns](../../.ruler/19-drizzle-patterns.md)
- [TanStack Start Rules](../../.ruler/21-tanstack-start.md)
- [Component Development Rules](../../.ruler/12-component-development.md)

