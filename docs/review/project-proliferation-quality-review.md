# Quality Review: Project Proliferation

**Date:** 2026-01-09  
**Scope:** Project proliferation implementation (routers, schedulers, schemas)

## Files Reviewed

- `packages/api/src/routers/project.ts`
- `packages/api/src/scheduler/project-lifecycle.ts`
- `packages/api/src/scheduler/pattern-lifecycle.ts`
- `packages/db/src/schema/project.ts`

## Type Safety

### ✅ Critical Issues: None

All files pass type checking:

- No `any` types (except documented JSONB `as any` patterns)
- No `@ts-ignore` or `@ts-expect-error` suppressions
- Explicit return types on public functions
- Proper Zod schema validation in tRPC routers

### ✅ Warnings: None

- Type guards used appropriately (`error instanceof Error`)
- Union types handled exhaustively
- Generic constraints are meaningful

## Code Quality

### ✅ Structure

**Functions:**

- `project-lifecycle.ts`: `tick()` = 32 lines, `startProjectLifecycleScheduler()` = 38 lines ✓
- `pattern-lifecycle.ts`: `tick()` = 18 lines, `startPatternLifecycleScheduler()` = 36 lines ✓
- Router procedures: All under 50 lines ✓

**Files:**

- All files under 500 lines ✓
- Single responsibility per function ✓
- Nesting depth ≤ 3 levels ✓

### ✅ Naming

- Single-word file names (`project.ts`, `project-lifecycle.ts`) ✓
- Descriptive variable names (`staleIds`, `archiveAfterDays`) ✓
- Consistent with codebase patterns ✓

### ✅ Error Handling

**Error Codes:**

- `project_not_found`, `project_access_denied`, `linear_not_connected` ✓
- Format: `<domain>_<reason>` ✓

**Error Propagation:**

- Async errors caught and wrapped appropriately ✓
- No swallowed errors (empty catch blocks) ✓
- User-facing errors don't expose internals ✓

**Example from `project.ts`:**

```typescript
try {
  const { linkLinearProject } = await import("@alfred/plan");
  return await linkLinearProject(input.projectId, input.linearProjectId, {
    linearSpaceId,
  });
} catch (error) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "linear_link_failed",
  });
}
```

## ALFRED Conventions

### ✅ Pure Functions

- Schedulers are boundary layers (side effects at boundaries) ✓
- Router procedures handle I/O appropriately ✓
- No mixing of pure logic with side effects ✓

### ✅ Imports

- No circular dependencies ✓
- Server-only modules (`@alfred/db/repo/project`) not in client bundles ✓
- Type imports use `import type` where appropriate ✓

### ✅ Policy & Logging

- Structured logging with context objects ✓
- Error messages use domain codes ✓
- Scheduler gating via env flags (`SCHED_PROJECT_LIFECYCLE=1`) ✓

## Suggestions

### 1. Scheduler Error Recovery

**File:** `packages/api/src/scheduler/project-lifecycle.ts:82-87`

The scheduler continues scheduling even after errors, which is good. Consider adding exponential backoff for repeated failures:

```typescript
// Current: Always schedules next run
void run().then(scheduleNext, (error) => {
  logger.error?.("project_lifecycle_scheduler_start_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  scheduleNext(); // Immediate retry
});

// Suggestion: Add backoff for repeated failures
let consecutiveFailures = 0;
void run().then(
  () => {
    consecutiveFailures = 0;
    scheduleNext();
  },
  (error) => {
    consecutiveFailures++;
    const backoffMs = Math.min(consecutiveFailures * 1000, 60000);
    logger.error?.("project_lifecycle_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
      consecutiveFailures,
    });
    setTimeout(scheduleNext, backoffMs);
  }
);
```

**Priority:** Low (current behavior is acceptable)

### 2. Type Narrowing in Router

**File:** `packages/api/src/routers/project.ts:64`

The `linearSpaceId` check could use a type guard:

```typescript
// Current
const linearSpaceId = installation?.space?.trim();
if (!linearSpaceId) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "linear_not_connected",
  });
}

// Suggestion: Extract to helper
function assertLinearSpaceId(space: string | null | undefined): string {
  const trimmed = space?.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_not_connected",
    });
  }
  return trimmed;
}
```

**Priority:** Low (current code is clear)

## Summary

**Overall Quality: Excellent**

- ✅ All critical type safety checks pass
- ✅ Code structure follows ALFRED conventions
- ✅ Error handling is comprehensive
- ✅ No blocking issues

**Recommendations:**

- Consider adding exponential backoff to scheduler error recovery (low priority)
- Extract type guards for repeated validation patterns (low priority)
