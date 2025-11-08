# ALFRED Codebase Standards Audit & Rule Enhancement

**Date:** 2025-01-27  
**Scope:** Complete review of `.ruler/` standards and codebase patterns  
**Objective:** Identify gaps, propose new rules, document violations, and enhance existing standards

---

## Executive Summary

This audit reviewed 19 existing rule files and examined key implementation patterns across the ALFRED monorepo. The codebase demonstrates strong adherence to Carmack-Karpathy principles of computational austerity, but several critical areas lack explicit standards:

**Key Findings:**
- ✅ **Strong coverage:** Naming, architecture, security, database, testing, AI SDK v6
- ⚠️ **Missing standards:** Error handling, logging/observability, async resource cleanup, workflow patterns, Drizzle query patterns, TanStack Start conventions
- 🔴 **Violations found:** 5 `console.*` calls in production code, 13 `@ts-expect-error` suppressions (mostly test mocks), inconsistent error handling patterns
- 📊 **Quality metrics:** No explicit thresholds defined for function length, file size, test coverage

**Priority Recommendations:**
1. **High:** Create error handling standards (`16-error-handling.md`)
2. **High:** Create workflow patterns (`17-workflow-patterns.md`)
3. **Medium:** Create observability standards (`18-observability.md`)
4. **Medium:** Enhance Drizzle patterns in `04-database.md`
5. **Low:** Add quality metrics to `09-purity-and-performance.md`

---

## 1. Gap Analysis

### 1.1 Error Handling (CRITICAL GAP)

**Current State:**
- `packages/api/src/utils/error.ts` provides `toTRPCError()` helper
- tRPC middleware catches errors and records metrics
- No standardized patterns for:
  - Error classification (transient vs. permanent)
  - Retry strategies
  - Error context propagation
  - Client-facing error messages
  - Error logging structure

**Patterns Found:**
```typescript
// ✅ Good: Using toTRPCError helper
catch (error) {
  throw toTRPCError(error, "workflow_error");
}

// ❌ Inconsistent: Silent catch blocks
catch {
  // persistence should not break streaming to client
}

// ❌ Missing: Error context
catch (error) {
  throw toTRPCError(error); // No context about what failed
}
```

**Gap:** No rules for:
- When to use `toTRPCError` vs. throwing `TRPCError` directly
- How to structure error messages (user-facing vs. internal)
- Error classification and retry logic
- Error boundaries in React components
- TanStack Start error handling patterns

### 1.2 Workflow Patterns (CRITICAL GAP)

**Current State:**
- Durable execution via `workflow_runs` and `workflow_events` tables
- `runPlanV6()` generates workflow runners
- `runRegistry` manages active runs
- No standards for:
  - Workflow state management
  - Event persistence patterns
  - Resume/suspend logic
  - Error recovery
  - Timeout handling

**Patterns Found:**
```typescript
// ✅ Good: Durable run creation before execution
await workflowRepo.createRun({ id: runner.runId, ... });
for await (const event of runner.stream) {
  await workflowRepo.appendEvent({ runId, eventData: event });
}

// ❌ Missing: Standardized error recovery
catch (error) {
  // No standardized way to mark workflow as failed
  // No retry logic
  // No partial state preservation
}
```

**Gap:** No rules for:
- Workflow state transitions
- Event replay patterns
- Suspension/resumption flows
- Partial failure handling
- Workflow timeout enforcement

### 1.3 Observability & Logging (HIGH GAP)

**Current State:**
- Prometheus metrics via `packages/api/src/metrics.ts`
- Centralized registry pattern
- 5 `console.*` calls found in production code:
  - `packages/api/src/run-registry.ts` (2)
  - `packages/api/src/routers/droids.ts` (2)
  - `packages/api/src/ai/generate.ts` (1)

**Patterns Found:**
```typescript
// ❌ Direct console usage
console.warn(`Run ${runId} not found in local registry`);
console.error(`Failed to dispatch resume: ${error}`);

// ✅ Good: Metrics instrumentation
workflowStreamEventsTotal.inc({ event });
```

**Gap:** No rules for:
- When to use metrics vs. logs
- Structured logging format
- Log levels (debug/info/warn/error)
- Log redaction (PII, secrets)
- Observability in TanStack Start routes
- Error tracking integration

### 1.4 Async Resource Cleanup (MEDIUM GAP)

**Current State:**
- `AbortController` used for cancellation
- `runRegistry` manages cleanup
- No standards for:
  - Signal propagation
  - Resource cleanup patterns
  - Timeout handling
  - Graceful shutdown

**Patterns Found:**
```typescript
// ✅ Good: AbortController usage
const abortController = new AbortController();
const runner = runPlanV6(input, { signal: abortController.signal });

// ❌ Missing: Standardized cleanup
return () => {
  cancelled = true;
  abortController.abort();
  // No standardized cleanup pattern
};
```

**Gap:** No rules for:
- AbortSignal propagation through async chains
- Resource cleanup in finally blocks
- Timeout patterns
- Graceful degradation

### 1.5 Drizzle Query Patterns (MEDIUM GAP)

**Current State:**
- Repos use Drizzle ORM
- No transaction usage found (`grep` returned no matches)
- No batch operations
- Inconsistent error handling

**Patterns Found:**
```typescript
// ✅ Good: Type-safe queries
const [row] = await db.insert(workflowRuns).values({...}).returning();

// ❌ Missing: Transaction patterns
// No examples of db.transaction() usage
// No batch operations
// No savepoint patterns
```

**Gap:** No rules for:
- When to use transactions
- Batch query patterns
- Query performance budgets
- Index usage verification
- Connection pooling considerations

### 1.6 TanStack Start Conventions (LOW GAP)

**Current State:**
- Basic patterns in `apps/web/.ruler/tanstack-patterns.md`
- Routes use `createFileRoute`
- Loaders return data
- No standards for:
  - Error boundaries
  - Loading states
  - Route-level error handling
  - SSR data fetching patterns

**Patterns Found:**
```typescript
// ✅ Good: Loader pattern
loader: async () => {
  return { initialMessages: [] };
}

// ❌ Missing: Error handling in loaders
// No error boundaries defined
// No standardized loading states
```

**Gap:** No rules for:
- Route-level error boundaries
- Loader error handling
- SSR vs. client-side data fetching
- Route preloading patterns

---

## 2. Violation Inventory

### 2.1 Type Suppressions

**Location:** `packages/agent/src/**/*.test.ts`  
**Count:** 13 instances  
**Pattern:** `@ts-expect-error override in tests`  
**Severity:** LOW (test files only)  
**Recommendation:** Acceptable for test mocks, but document in testing rules

### 2.2 Console Usage

**Location:** `packages/api/src/run-registry.ts:393,408`  
**Pattern:** `console.warn`, `console.error`  
**Severity:** MEDIUM  
**Recommendation:** Replace with structured logging or metrics

**Location:** `packages/api/src/routers/droids.ts:25,27`  
**Pattern:** `console.log` (code generation)  
**Severity:** LOW (generated code)  
**Recommendation:** Acceptable for code generation

**Location:** `packages/api/src/ai/generate.ts:36`  
**Pattern:** `console.error`  
**Severity:** MEDIUM  
**Recommendation:** Replace with structured logging

### 2.3 Silent Error Handling

**Location:** `packages/api/src/routers/workflow.ts:216-218, 228-230, 244-246`  
**Pattern:** Empty catch blocks  
**Severity:** MEDIUM  
**Recommendation:** Log errors even if non-fatal

```typescript
// Current (silent)
catch {
  // persistence should not break streaming to client
}

// Recommended
catch (error) {
  // Log but don't throw
  metrics.increment('workflow_persistence_errors');
  // Optionally: structured log
}
```

### 2.4 Type Assertions

**Location:** `packages/db/src/repo/workflow.ts:29,54,57,60,63,66,86`  
**Pattern:** `as any` for JSONB fields  
**Severity:** LOW (Drizzle limitation)  
**Recommendation:** Document as acceptable pattern for JSONB

---

## 3. Proposed New Rules

### 3.1 Error Handling Standards (`16-error-handling.md`)

**Priority:** HIGH  
**Status:** Draft ready

See section 4.1 for full content.

### 3.2 Workflow Patterns (`17-workflow-patterns.md`)

**Priority:** HIGH  
**Status:** Draft ready

See section 4.2 for full content.

### 3.3 Observability Standards (`18-observability.md`)

**Priority:** MEDIUM  
**Status:** Draft ready

See section 4.3 for full content.

---

## 4. Proposed Rule Files

### 4.1 Error Handling Standards

**File:** `.ruler/16-error-handling.md`

```markdown
# Error Handling Standards

## Core Principle

Errors are data. Handle them explicitly, classify them correctly, and surface them appropriately. Never swallow errors silently; never expose internals to clients.

## Rules

1. **Error classification.** Categorize errors as:
   - `transient` - Retryable (network, timeouts, rate limits)
   - `permanent` - Non-retryable (validation, auth, not found)
   - `system` - Infrastructure failures (DB, Redis)

2. **tRPC error handling.** Always use `toTRPCError()` for unknown errors. Throw `TRPCError` directly only when you control the error shape:
   ```typescript
   // ✅ Unknown error → toTRPCError
   catch (error) {
     throw toTRPCError(error, "workflow_error");
   }
   
   // ✅ Known error → TRPCError directly
   if (!session) {
     throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
   }
   ```

3. **Error context.** Always include context about what failed:
   ```typescript
   // ❌ Missing context
   catch (error) {
     throw toTRPCError(error);
   }
   
   // ✅ With context
   catch (error) {
     throw toTRPCError(error, `failed_to_create_run_${runId}`);
   }
   ```

4. **Non-fatal errors.** Log errors even if they don't break the flow:
   ```typescript
   // ❌ Silent catch
   catch {
     // persistence should not break streaming
   }
   
   // ✅ Logged but non-fatal
   catch (error) {
     metrics.increment('workflow_persistence_errors');
     // Continue without throwing
   }
   ```

5. **Error messages.** Structure messages for clients:
   - User-facing: `"session_required"` (no internals)
   - Internal: Include IDs, context in `cause` field
   - Never expose stack traces, file paths, or internal state

6. **Retry logic.** Only retry transient errors:
   ```typescript
   const MAX_RETRIES = 3;
   for (let i = 0; i < MAX_RETRIES; i++) {
     try {
       return await operation();
     } catch (error) {
       if (!isTransient(error) || i === MAX_RETRIES - 1) throw error;
       await delay(100 * (i + 1));
     }
   }
   ```

7. **TanStack Start errors.** Use route-level error boundaries:
   ```typescript
   export const Route = createFileRoute("/path")({
     component: Component,
     errorComponent: ({ error, reset }) => (
       <div>Error: {error.message} <button onClick={reset}>Retry</button></div>
     ),
   });
   ```

8. **Error boundaries.** Wrap streaming components in error boundaries. Surface retry affordances.

## Error Codes

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Invalid input
- `PRECONDITION_FAILED` - Precondition not met (e.g., biometric_required)
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- `TIMEOUT` - Operation timed out
- `CONFLICT` - Resource conflict

## Examples

```typescript
// ✅ Proper error handling with context
export async function createWorkflow(input: WorkflowInput) {
  try {
    const run = await workflowRepo.createRun(input);
    return run;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw toTRPCError(error, `failed_to_create_workflow_${input.workflowId}`);
  }
}

// ✅ Non-fatal error logging
for await (const event of stream) {
  try {
    await persistEvent(event);
  } catch (error) {
    metrics.increment('event_persistence_errors');
    // Continue streaming to client
  }
}
```
```

### 4.2 Workflow Patterns

**File:** `.ruler/17-workflow-patterns.md`

```markdown
# Workflow Patterns

## Core Principle

Workflows are durable, resumable, and observable. Every workflow run persists state before execution, records events during execution, and handles failures gracefully.

## Rules

1. **Durable run creation.** Create the run row before starting execution:
   ```typescript
   // ✅ Create run first
   const runner = runPlanV6(input, { signal });
   await workflowRepo.createRun({
     id: runner.runId,
     userId: session.user.id,
     workflowId: "plan",
     status: "running",
     inputData: input,
   });
   ```

2. **Event persistence.** Persist every event immediately:
   ```typescript
   for await (const event of runner.stream) {
     await workflowRepo.appendEvent({
       runId,
       eventType: event.type ?? "event",
       eventData: event,
     });
     emit.next(event); // Then push to client
   }
   ```

3. **State transitions.** Update run status explicitly:
   ```typescript
   // On completion
   await workflowRepo.updateRun(runId, {
     status: "completed",
     completedAt: new Date(),
   });
   
   // On failure
   await workflowRepo.updateRun(runId, {
     status: "failed",
     errorMessage: error.message,
   });
   ```

4. **Resume patterns.** Register run handles before execution:
   ```typescript
   await runRegistry.register(runId, {
     resume: async ({ resumeData }) => {
       await runner.resume(resumeData);
     },
     cancel: async () => {
       abortController.abort();
     },
     abortController,
   });
   ```

5. **Cancellation.** Always support cancellation via AbortSignal:
   ```typescript
   const abortController = new AbortController();
   const runner = runPlanV6(input, { signal: abortController.signal });
   
   return () => {
     abortController.abort();
     runRegistry.unregister(runId);
   };
   ```

6. **Error recovery.** Mark workflows as failed on error:
   ```typescript
   try {
     await executeWorkflow();
     await workflowRepo.updateRun(runId, { status: "completed" });
   } catch (error) {
     await workflowRepo.updateRun(runId, {
       status: "failed",
       errorMessage: error.message,
     });
     throw error;
   }
   ```

7. **Timeout enforcement.** Enforce timeouts at workflow level:
   ```typescript
   const timeout = setTimeout(() => {
     abortController.abort();
     workflowRepo.updateRun(runId, { status: "failed", errorMessage: "timeout" });
   }, WORKFLOW_TIMEOUT_MS);
   ```

8. **Event replay.** Events must be replayable. Store full event data, not summaries.

## Workflow Status Lifecycle

```
running → completed
running → failed
running → suspended → resumed → completed
running → cancelled
```

## Performance Budgets

- Run creation: <10ms
- Event persistence: <5ms per event
- Status update: <5ms
- Resume dispatch: <50ms

## Examples

```typescript
// ✅ Complete workflow pattern
export async function startWorkflow(input: WorkflowInput) {
  const abortController = new AbortController();
  const runner = runPlanV6(input, { signal: abortController.signal });
  
  // Create durable run
  await workflowRepo.createRun({
    id: runner.runId,
    userId: session.user.id,
    workflowId: "plan",
    status: "running",
    inputData: input,
  });
  
  // Register for resume
  await runRegistry.register(runId, {
    resume: async ({ resumeData }) => await runner.resume(resumeData),
    cancel: async () => abortController.abort(),
    abortController,
  });
  
  // Execute and persist events
  try {
    for await (const event of runner.stream) {
      await workflowRepo.appendEvent({ runId, eventData: event });
      emit.next(event);
    }
    await workflowRepo.updateRun(runId, { status: "completed" });
  } catch (error) {
    await workflowRepo.updateRun(runId, {
      status: "failed",
      errorMessage: error.message,
    });
    throw error;
  } finally {
    await runRegistry.unregister(runId);
  }
}
```
```

### 4.3 Observability Standards

**File:** `.ruler/18-observability.md`

```markdown
# Observability Standards

## Core Principle

Measure everything, log selectively, expose metrics consistently. Observability enables debugging, performance optimization, and reliability improvements.

## Rules

1. **Metrics over logs.** Use Prometheus metrics for:
   - Request counts and durations
   - Error rates
   - Business events (workflow starts, tool calls)
   - Resource usage

2. **Structured logging.** Use structured logs (JSON) for:
   - Errors requiring investigation
   - Security events
   - Performance anomalies
   - Debug information (dev only)

3. **No console.* in production.** Replace `console.log/error/warn` with:
   - Metrics for events
   - Structured logging for errors
   - Remove debug console calls

4. **Log levels.** Use appropriate levels:
   - `error` - Failures requiring attention
   - `warn` - Recoverable issues
   - `info` - Important state changes (sparse)
   - `debug` - Development only

5. **Log redaction.** Never log:
   - Passwords, tokens, API keys
   - PII (emails, addresses) without consent
   - Full request/response bodies (log summaries)

6. **Metrics registration.** Register all metrics in `packages/api/src/metrics.ts`:
   ```typescript
   export const myMetric = new client.Counter({
     name: "my_metric_total",
     help: "Description",
     labelNames: ["label1", "label2"] as const,
     registers: [metricsRegistry],
   });
   ```

7. **Error tracking.** Integrate error tracking (e.g., Sentry) for:
   - Unhandled exceptions
   - tRPC errors (via middleware)
   - React error boundaries

8. **Performance budgets.** Instrument hot paths:
   ```typescript
   const stopTimer = operationDuration.startTimer();
   try {
     await operation();
   } finally {
     stopTimer({ status: "ok" });
   }
   ```

## Logging Format

```typescript
// ✅ Structured logging
logger.error("workflow_failed", {
  runId,
  workflowId,
  error: error.message,
  duration: durationMs,
});

// ❌ Unstructured
console.error(`Workflow ${runId} failed: ${error.message}`);
```

## Metrics Naming

- Counters: `*_total` suffix
- Histograms: `*_duration_seconds` or `*_bytes`
- Gauges: `*_current` or `*_active`
- Labels: snake_case, lowercase

## Examples

```typescript
// ✅ Metrics for events
workflowStreamEventsTotal.inc({ event: "run" });

// ✅ Structured error logging
catch (error) {
  logger.error("workflow_persistence_failed", {
    runId,
    error: error.message,
  });
  // Continue without throwing
}

// ❌ Console in production
console.error(`Failed: ${error}`);
```
```

---

## 5. Enhancement Suggestions

### 5.1 Enhance `04-database.md`

**Add:**
- Transaction usage patterns
- Batch query guidelines
- Query performance budgets
- Index verification requirements

### 5.2 Enhance `09-purity-and-performance.md`

**Add:**
- Quality metrics (function length, file size, test coverage thresholds)
- Performance budget enforcement
- Allocation tracking

### 5.3 Enhance `13-streaming-patterns.md`

**Add:**
- AbortSignal propagation patterns
- Resource cleanup in streams
- Timeout handling

### 5.4 Enhance `12-component-development.md`

**Add:**
- Error boundary patterns
- Loading state standards
- Route-level error handling

---

## 6. Priority Recommendations

### Immediate (This Sprint)

1. ✅ Create `16-error-handling.md`
2. ✅ Create `17-workflow-patterns.md`
3. ✅ Replace `console.*` calls with structured logging
4. ✅ Add error context to silent catch blocks

### Short-term (Next Sprint)

1. Create `18-observability.md`
2. Enhance `04-database.md` with transaction patterns
3. Add quality metrics to `09-purity-and-performance.md`
4. Document AbortSignal patterns in streaming rules

### Long-term (Backlog)

1. Add TanStack Start error boundary examples
2. Create Drizzle query pattern guide
3. Add performance budget enforcement tooling
4. Create observability dashboard standards

---

## 7. Quality Metrics (Proposed)

### Code Quality Thresholds

- **Function length:** Max 50 lines (hot paths: 30 lines)
- **File size:** Max 500 lines
- **Test coverage:** Min 80% for repos, 60% for routers
- **Type coverage:** 100% (no `any` except JSONB `as any`)

### Performance Budgets

- **tRPC procedures:** <100ms (p99)
- **Database queries:** <10ms (p99)
- **Workflow event persistence:** <5ms
- **Component render:** <16ms (60fps)

---

## 8. Conclusion

The ALFRED codebase demonstrates strong adherence to computational austerity principles. The proposed rules fill critical gaps in error handling, workflow patterns, and observability while maintaining the existing high standards.

**Next Steps:**
1. Review and approve proposed rules
2. Create new rule files
3. Fix identified violations
4. Update CI to enforce new standards
5. Document migration path for existing code

---

**Audit completed by:** AI Assistant  
**Review status:** Pending approval
