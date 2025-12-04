# Graceful Degradation Patterns

## Core Principle

The application must gracefully handle missing external dependencies (database, UV, etc.) without crashing. Services should degrade gracefully, logging warnings instead of throwing errors.

## Patterns

### 1. Database Availability Checks

**Pattern**: Check database availability before starting DB-dependent services.

```typescript
import { isDbAvailable } from "@alfred/api/utils/service-availability";

// Check before starting DB-dependent workers
isDbAvailable()
  .then((dbOk) => {
    if (!dbOk) {
      logger.warn("db_unavailable_skipping_services", {
        message: "Database unavailable - skipping DB-dependent services",
      });
      return;
    }
    // Start DB-dependent services
  })
  .catch((error) => {
    logger.warn("db_availability_check_error", { error });
  });
```

**When to use**:
- Background workers (codex cleanup, plan resume, workflow rehydration)
- Non-critical initialization code
- Services that can operate without DB

**When NOT to use**:
- Critical user-facing features (use try-catch in handlers instead)
- Real-time request handling (handle errors per-request)

### 2. External Service Availability Checks

**Pattern**: Check for external tools before initializing services.

```typescript
import { isUvAvailable } from "@alfred/api/utils/service-availability";

if (isUvAvailable()) {
  initializeVoicePools()
    .then(() => {
      startVoiceStreamingPrototype();
    })
    .catch((error) => {
      logger.error("voice_pools_init_failed", { error });
    });
} else {
  logger.warn("voice_pools_skipped_uv_missing", {
    message: "UV not found - skipping voice pool initialization",
  });
}
```

**When to use**:
- Optional features (voice pools, local models)
- Development-only features
- Features with clear fallbacks

### 3. Error Classification

**Pattern**: Use type guards to classify errors and handle appropriately.

```typescript
import { isDbConnectionError, isTransientError } from "@alfred/api/utils/service-availability";

try {
  await dbOperation();
} catch (error) {
  if (isDbConnectionError(error)) {
    // Return graceful fallback
    return { session: null, user: null };
  }
  if (isTransientError(error)) {
    // Retry logic
    return retry();
  }
  // Re-throw permanent errors
  throw error;
}
```

**Error Types**:
- **Database connection errors**: ECONNREFUSED, password auth failed, connection refused
- **Transient errors**: Timeouts, temporary failures (retryable)
- **Permanent errors**: Validation errors, authorization failures (non-retryable)

### 4. SSR-Safe Error Handling

**Pattern**: Wrap handlers with error boundaries for SSR.

```typescript
async function safeHandler(request: Request): Promise<Response> {
  try {
    return await handler(request);
  } catch (error) {
    if (isDbConnectionError(error)) {
      // Return graceful response instead of crashing SSR
      return Response.json({ session: null, user: null }, { status: 200 });
    }
    throw error;
  }
}
```

**When to use**:
- Route handlers in TanStack Start
- Server functions that might be called during SSR
- API endpoints that depend on external services

## Anti-Patterns

### ❌ Module-Level DB Access

```typescript
// BAD: DB access at module level crashes during SSR
import { db } from "@alfred/db";
const result = await db.select().from(users); // Crashes if DB unavailable
```

### ❌ Unhandled Promise Rejections

```typescript
// BAD: Unhandled rejection crashes the process
resumeInterruptedPlans(tools); // No error handling
```

### ✅ Lazy Initialization

```typescript
// GOOD: Check availability before use
async function getData() {
  if (!(await isDbAvailable())) {
    return null;
  }
  return await db.select().from(users);
}
```

## Testing

### Unit Tests

Test graceful degradation scenarios:

```typescript
it("should skip DB-dependent services when DB unavailable", async () => {
  resetDbAvailability();
  initApiServices();
  // Verify services are skipped, not crashed
});
```

### Integration Tests

Test app startup without dependencies:

```typescript
it("should render home page without DB", async () => {
  // Start server without DB
  // Verify SSR completes successfully
});
```

## Related Rules

- `.ruler/16-error-handling.md` - General error handling patterns
- `.ruler/21-tanstack-start.md` - SSR-specific patterns
- `.ruler/09-purity-and-performance.md` - Performance considerations
