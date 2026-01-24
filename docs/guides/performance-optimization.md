# Performance Optimization Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide explains ALFRED's performance budgets, how to identify hot paths, when to optimize, and optimization patterns.

## Performance Budgets

ALFRED enforces strict performance budgets for hot paths:

| Path                        | Budget | Measurement          |
| --------------------------- | ------ | -------------------- |
| Cognitive state transitions | <100µs | `performance.now()`  |
| Knowledge graph lookups     | <1ms   | Prometheus histogram |
| RAG retrieval               | <10ms  | Prometheus histogram |
| Fact extraction             | <10ms  | Prometheus histogram |
| Context building            | <100ms | Prometheus histogram |
| Plan generation             | <100ms | Prometheus histogram |
| UI render cycles            | <16ms  | Browser DevTools     |
| DB queries (p99)            | <10ms  | Prometheus histogram |

**Budget breaches are defects.** CI should fail on functions exceeding declared budgets.

## Identifying Hot Paths

### 1. Profile Before Optimizing

Always measure before optimizing:

```typescript
import { performance } from "node:perf_hooks";

const start = performance.now();
const result = expensiveOperation();
const duration = performance.now() - start;

if (duration > BUDGET) {
  logger.warn("budget_exceeded", {
    operation: "expensiveOperation",
    duration,
    budget: BUDGET,
  });
}
```

### 2. Use Prometheus Metrics

Instrument hot paths with Prometheus histograms:

```typescript
import { cognitiveTransitionDuration } from "@alfred/api/metrics";

const stopTimer = cognitiveTransitionDuration.startTimer();
try {
  const result = applyTransition(state, autonomy, event);
  return result;
} finally {
  stopTimer();
}
```

### 3. Profile with Bun

Use Bun's built-in profiler:

```bash
# Profile specific test
bun --profile test packages/cognitive/test/transition.test.ts

# Profile application
bun --profile run dev
```

### 4. Identify Hot Paths

Hot paths are:

- Called frequently (every request, every event)
- On critical path (blocks user interaction)
- Performance-sensitive (affects user experience)

**Examples:**

- State transitions (every cognitive event)
- Graph queries (every context build)
- RAG retrieval (every assistant query)
- Message rendering (every stream chunk)

## Optimization Patterns

### 1. Zero Allocations in Hot Loops

**Problem:** Allocations in hot loops cause GC pressure

**Solution:** Reuse buffers, avoid spreading arrays

```typescript
// ❌ BAD: Allocates new array every iteration
const results = items.map((item) => process(item));

// ✅ GOOD: Pre-allocate or reuse buffer
const results = new Array(items.length);
for (let i = 0; i < items.length; i++) {
  results[i] = process(items[i]);
}
```

### 2. Batch Operations

**Problem:** Many individual DB queries

**Solution:** Use batch operations or single SQL statement

```typescript
// ❌ BAD: Many roundtrips
await Promise.all(updates.map((u) => updateNodeConfidence(u.id, u.confidence)));

// ✅ GOOD: Single SQL statement
await db
  .update(table)
  .set({ confidence: sql`excluded.confidence` })
  .from(
    sql`(VALUES ${sql.join(
      updates.map((u) => sql`(${u.id}, ${u.confidence})`),
      sql`, `
    )}) AS excluded(id, confidence)`
  )
  .where(sql`table.id = excluded.id`);
```

### 3. Pure Functions

**Problem:** Side effects prevent optimization

**Solution:** Keep hot paths pure (no I/O, no mutations)

```typescript
// ✅ GOOD: Pure function (optimizable)
export function applyTransition(
  state: CognitiveState,
  autonomy: AutonomyGradient,
  event: Event
): TransitionResult {
  // Pure logic only - no DB, no HTTP
  return { state: newState, autonomy: newAutonomy };
}

// ❌ BAD: Side effects (not optimizable)
export function applyTransition(...) {
  await db.save(state); // I/O in hot path!
  return result;
}
```

### 4. Memoization

**Problem:** Repeated expensive computations

**Solution:** Cache results for stable inputs

```typescript
// ✅ GOOD: Memoize expensive computation
const memoized = useMemo(() => expensiveComputation(input), [input]);
```

**When to Use:**

- Expensive computations
- Stable inputs
- Frequently called

**When NOT to Use:**

- Simple operations (overhead > benefit)
- Frequently changing inputs
- Memory-constrained environments

### 5. Index Optimization

**Problem:** Slow queries due to missing indexes

**Solution:** Add indexes matching query predicates

```sql
-- ✅ GOOD: Index matches query
CREATE INDEX idx_memory_nodes_updated_at
ON memory_nodes(updated_at)
WHERE confidence > 0.01;

-- Query uses index
SELECT * FROM memory_nodes
WHERE updated_at < NOW() - INTERVAL '24 hours'
AND confidence > 0.01;
```

**Check Query Plans:**

```sql
EXPLAIN ANALYZE SELECT ...;
```

### 6. Lazy Loading

**Problem:** Loading unnecessary data upfront

**Solution:** Load on demand

```typescript
// ✅ GOOD: Lazy load metrics
const loadMetrics = async () => {
  try {
    const apiMetrics = await import("@alfred/api/metrics");
    metrics = apiMetrics;
  } catch {
    // Keep mocks
  }
};
```

## When to Optimize

### ✅ Optimize When:

1. **Measurements show budget violations**
   - Profile shows function exceeds budget
   - Prometheus metrics show p99 > budget

2. **User-perceivable latency**
   - UI feels sluggish
   - Workflows timeout
   - Voice responses delayed

3. **Resource exhaustion risks**
   - Memory leaks
   - Connection pool exhaustion
   - CPU saturation

### ❌ Don't Optimize When:

1. **Before measuring**
   - No profiling data
   - Assumed performance issues
   - Micro-benchmarks only

2. **At expense of clarity**
   - Premature optimization
   - Obscures intent
   - Harder to maintain

3. **For hypothetical needs**
   - Future scalability concerns
   - Not currently a problem
   - Over-engineering

## Optimization Checklist

Before optimizing:

- [ ] Profile the code path
- [ ] Identify the bottleneck (CPU, memory, I/O)
- [ ] Verify budget violation (measurement > budget)
- [ ] Check if optimization is user-perceivable
- [ ] Consider maintainability impact
- [ ] Add tests for optimized path
- [ ] Measure improvement (before/after)

## Common Anti-Patterns

### 1. Premature Optimization

❌ **Don't:** Optimize before profiling  
✅ **Do:** Measure first, optimize second

### 2. Micro-Optimizations

❌ **Don't:** Optimize 1% improvements  
✅ **Do:** Focus on 10x improvements

### 3. Optimizing Cold Paths

❌ **Don't:** Optimize rarely-called code  
✅ **Do:** Optimize hot paths only

### 4. Breaking Purity for Performance

❌ **Don't:** Add side effects for speed  
✅ **Do:** Keep hot paths pure, optimize algorithms

## Performance Testing

### Budget Tests

Every hot path should have a budget test:

### CI Budget Enforcement

ALFRED enforces performance budgets in CI using two steps:

- `bun run check:budgets`: Validates that required budget categories have deterministic perf-test coverage. Tests declare coverage with a marker comment:
  - `// budget: state-transition`
  - `// budget: graph-lookup`
  - `// budget: fact-extraction`
  - `// budget: plan-generation`
- `bun run test:perf`: Runs the focused perf suite. These tests are the source of truth for measurement and should fail on regressions.

```typescript
test("transition meets budget", async () => {
  const state = idle(Date.now());
  const autonomy = initialAutonomy(Date.now());
  const event = { _: "input", content: "test", ts: Date.now() };

  // Warmup
  for (let i = 0; i < 10; i++) {
    applyTransition(state, autonomy, event);
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    applyTransition(state, autonomy, event);
  }
  const avgDuration = (performance.now() - start) / 1000;

  expect(avgDuration).toBeLessThan(0.1); // <100µs
});
```

### Load Testing

For API endpoints:

```bash
# Load test concurrent workflows (dev)
# (Run the web server with TEST_MODE=1 to use the test-session header bypass.)
bun scripts/load-workflow.ts --base-url http://localhost:3000 --concurrency 25 --requests 200

# Load test workflow streaming (dev)
bun scripts/load-workflow-stream.ts --base-url http://localhost:3000 --concurrency 10 --requests 25
```

## Related Documentation

- [Purity and Performance Rules](../../.ruler/09-purity-and-performance.md) - Core performance principles
- [Drizzle Patterns](../../.ruler/19-drizzle-patterns.md) - DB query optimization
- [Common Patterns](./common-patterns.md) - Code patterns including performance
