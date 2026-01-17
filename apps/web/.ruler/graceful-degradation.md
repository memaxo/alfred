# Graceful Degradation Patterns

## Core Principle

The application must gracefully handle missing external dependencies (database, UV, etc.) without crashing. Services should degrade gracefully, logging warnings instead of throwing errors.

## Patterns

### 1. Database Availability Checks

**Pattern**: Check database availability before starting DB-dependent services. Use `isDbAvailable()` from `@alfred/api/utils/service-availability`. If unavailable, log warning and skip service initialization. Handle errors in catch block.

**When to use**:
- Background workers (codex cleanup, plan resume, workflow rehydration)
- Non-critical initialization code
- Services that can operate without DB

**When NOT to use**:
- Critical user-facing features (use try-catch in handlers instead)
- Real-time request handling (handle errors per-request)

### 2. External Service Availability Checks

**Pattern**: Check for external tools before initializing services. Use `isUvAvailable()` or similar availability checks. If unavailable, log warning and skip initialization. Wrap service initialization in try-catch to handle failures gracefully.

**When to use**:
- Optional features (voice pools, local models)
- Development-only features
- Features with clear fallbacks

### 3. Error Classification

**Pattern**: Use type guards (`isDbConnectionError`, `isTransientError`) to classify errors and handle appropriately. Return graceful fallbacks for connection errors, retry transient errors, re-throw permanent errors.

**Error Types**:
- **Database connection errors**: ECONNREFUSED, password auth failed, connection refused
- **Transient errors**: Timeouts, temporary failures (retryable)
- **Permanent errors**: Validation errors, authorization failures (non-retryable)

### 4. SSR-Safe Error Handling

**Pattern**: Wrap handlers with try-catch for SSR. Use `isDbConnectionError()` to detect DB failures and return graceful responses (e.g., `Response.json({ session: null, user: null }, { status: 200 })`) instead of crashing SSR.

**When to use**:
- Route handlers in TanStack Start
- Server functions that might be called during SSR
- API endpoints that depend on external services

## Anti-Patterns

### ❌ Module-Level DB Access

Never access DB at module level (top-level await). This crashes during SSR if DB is unavailable. Always check availability or wrap in functions.

### ❌ Unhandled Promise Rejections

Never call async functions without error handling. Unhandled rejections crash the process. Always wrap in try-catch or use `.catch()`.

### ✅ Lazy Initialization

Check availability before use. Use `isDbAvailable()` or similar checks inside async functions before performing DB operations.

## Quiet-by-Default Policy

1. **Optional deps are WARN/INFO.** Missing DB/UV must not emit `ERROR` logs in the default dev path; errors are reserved for explicitly enabled subsystems that still fail.
2. **SSR-safe imports.** If the graceful path requires importing server-only packages, use variable-based dynamic imports with `/* @vite-ignore */`.
3. **Guard with tests.** Any change that touches SSR entrypoints, API routes, or optional subsystem init must keep `apps/web/src/tests/dev/noise.test.ts` passing.

## Testing

### Unit Tests

Test graceful degradation scenarios. Reset availability state, initialize services, verify services are skipped (not crashed) when dependencies unavailable.

### Integration Tests

Test app startup without dependencies. Start server without DB, verify SSR completes successfully, verify optional features are skipped with warnings.

## Related Rules

- `.ruler/16-error-handling.md` - General error handling patterns
- `.ruler/21-tanstack-start.md` - SSR-specific patterns
- `.ruler/09-purity-and-performance.md` - Performance considerations
