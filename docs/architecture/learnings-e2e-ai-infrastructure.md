# Learnings: E2E Test Infrastructure for AI Agents

## What Patterns Emerged?

### 1. AI-First Design Pattern

**Pattern:** Design test infrastructure with AI agent consumption as the primary use case, human debugging as secondary.

**Implementation:**

- Default to compact, structured output
- Truncate errors at token-efficient boundaries (500 chars)
- Include direct paths to artifacts (screenshots, traces)
- Use parseable markers for section boundaries
- Emit metrics for observability

**Why:** AI agents benefit from structured, compact output. Verbose human-readable output can be enabled via opt-out flags.

### 2. Structured Error Context Pattern

**Pattern:** Every error must include complete operational context for root cause analysis without additional queries.

**Implementation:**

```typescript
class TimeoutError extends Error {
  constructor(
    public readonly context: {
      operation: string;
      selector?: string;
      timeout: number;
      elapsed: number;
      pageUrl: string;
      lastActivity?: string;
    }
  ) {
    /* ... */
  }
}
```

**Why:** AI agents can't interactively debug. One error message must contain all context.

### 3. Package Boundary Separation Pattern

**Pattern:** Core utilities in `packages/test-kit`, app-specific integration in `apps/*`.

**Implementation:**

- Test-kit exports generic utilities (timeout, crash detection)
- Test-kit uses generic interfaces for cross-boundary types
- App test helpers import from test-kit, not vice versa
- Harness lives in app code where it can import both

**Why:** Prevents circular dependencies and maintains clean package boundaries per ALFRED architecture rules.

### 4. Fixture Handle Pattern

**Pattern:** Test utilities return handle objects with cleanup methods, following workflow/voice fixture patterns.

**Implementation:**

```typescript
export type CrashMonitorHandle = {
  getCrashes: () => CrashReport[];
  hasCrashed: () => boolean;
  attachReport: () => Promise<void>;
  getReport: () => string;
};
```

**Why:** Consistent API across test-kit modules. Explicit cleanup prevents resource leaks.

### 5. Fail-Fast for Iteration Speed

**Pattern:** Default to single worker, stop on first failure for fastest feedback.

**Implementation:**

- `maxFailures: 1` stops immediately
- `workers: 1` ensures deterministic output
- `fullyParallel: false` disables concurrent tests
- Opt-out via `PLAYWRIGHT_FAIL_FAST=0` for full runs

**Why:** AI agents benefit from immediate failure feedback. Full suite runs are secondary.

## What Was Non-Obvious?

### 1. Package Boundary TypeScript Errors

**Issue:** Initially imported `ScreenshotManager` directly from `apps/web` into `packages/test-kit`, causing TypeScript errors about files outside `rootDir`.

**Solution:** Use generic interfaces in test-kit, concrete implementations in app code.

**Lesson:** TypeScript project boundaries are strict. Use interfaces for cross-boundary types.

### 2. Return Type Inference for `async` Functions

**Issue:** `captureAndThrow()` has return type `Promise<never>` but TypeScript doesn't understand catch blocks always throw.

**Solution:** Add unreachable `throw new Error("unreachable")` after the call.

**Lesson:** TypeScript control flow analysis doesn't track `never` returns through async boundaries.

### 3. Metrics Registry Import Side Effects

**Issue:** Importing metrics registry at module level can cause side effects (default metrics collection).

**Solution:** Use lazy initialization and `safeRegister*` functions.

**Lesson:** Follow existing ALFRED patterns in `@alfred/metrics` for safe registration.

### 4. Default Environment Variable Semantics

**Issue:** Should AI mode be opt-in (`=1` to enable) or opt-out (`=0` to disable)?

**Solution:** Opt-out semantics (`!== "0"`) make AI mode default while allowing explicit disable.

**Lesson:** For AI-first features, default to enabled with opt-out rather than opt-in.

## What Should Be Repeatable?

### Canonical Patterns (Document in `.ruler/`)

1. **AI-optimized test infrastructure** - All E2E test runners should default to compact, structured output
2. **Structured error context** - Custom error classes must include full operational context
3. **Package boundaries** - Test-kit utilities must use generic interfaces for cross-boundary types
4. **Metrics integration** - Test reporters should emit to global Prometheus registry
5. **Fail-fast defaults** - E2E tests should default to immediate failure feedback

### Architecture Decisions (Document in `docs/architecture/`)

1. **E2E test infrastructure design** - AI-first with human debugging opt-out
2. **Component placement** - Core in test-kit, harness in app
3. **Performance budgets** - E2E operations have explicit time budgets
4. **Integration points** - Metrics, protocol events, test-kit patterns

### Implementation Guidance (Examples)

1. **AI harness example** - `apps/web/.tests/ai-harness-example.e2e.spec.ts`
2. **Timeout handling** - `withTimeout()`, `waitForWithHangDetection()`
3. **Crash monitoring** - `createCrashMonitor()` with fixture handle pattern
4. **Reporter structure** - AI-compact reporter with metrics integration

## Mistakes to Avoid

1. **Don't import app code from packages** - Use generic interfaces for cross-boundary types
2. **Don't make AI mode opt-in** - Default to AI-optimized, allow opt-out for human debugging
3. **Don't skip metrics integration** - All test infrastructure should emit observability data
4. **Don't use verbose defaults** - Token efficiency matters for AI agents
5. **Don't omit operational context** - Every error needs complete context for one-shot debugging
6. **Don't ignore package boundary errors** - TypeScript `rootDir` violations indicate architectural issues

## Future Applications

### Where This Pattern Applies

1. **Integration test reporters** - Same compact output for non-E2E tests
2. **Performance test output** - Structured timing data with budget violations
3. **CI/CD output** - Compact summaries for all automated test runs
4. **Monitoring alerts** - Structured context for production errors

### Where This Pattern Doesn't Apply

1. **Interactive debugging** - Humans need verbose output (hence opt-out flags)
2. **Visual regression baselines** - Full screenshots needed, not summaries
3. **Test authoring** - Developers writing tests need traditional output

## Documentation Created

### Rules (`.ruler/`)

- `apps/web/.ruler/e2e-testing.md` - 12 rules for E2E test patterns

### Architecture (`docs/architecture/`)

- `e2e-test-infrastructure.md` - Complete architecture documentation

### Implementation Guide

- `apps/web/.tests/AI-INFRASTRUCTURE.md` - Usage guide with examples
- `apps/web/.tests/ai-harness-example.e2e.spec.ts` - Reference implementation

### Applied Changes

- Ran `bun run ruler:apply` to regenerate `AGENTS.md` files

## Key Learnings

1. **AI agents need structure over verbosity** - Compact, parseable output beats human-readable prose
2. **Context is king for debugging** - One error message must contain everything needed for root cause analysis
3. **Default to AI-optimized** - Human debugging is the exception, not the rule
4. **Package boundaries are real** - TypeScript enforces architectural discipline via `rootDir` constraints
5. **Fail-fast enables iteration** - Immediate feedback beats comprehensive reports for active development
6. **Observability is non-negotiable** - All test infrastructure must emit metrics for monitoring

## Metrics

- **Files Created:** 8
- **Files Modified:** 4
- **Lines of Documentation:** ~600
- **Rules Codified:** 12
- **Architecture Patterns:** 5
- **Time Saved:** Future E2E infrastructure changes will follow established patterns
