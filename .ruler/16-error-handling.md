# Error Handling Standards

## Core Principle

Errors are data. Handle them explicitly, classify them correctly, and surface them appropriately. Never swallow errors silently; never expose internals to clients.

## Rules

1. **Error classification.** Categorize errors as:
   - `transient` - Retryable (network, timeouts, rate limits)
   - `permanent` - Non-retryable (validation, auth, not found)
   - `system` - Infrastructure failures (DB, Redis)

2. **tRPC error handling.** Always use `toTRPCError()` for unknown errors. Throw `TRPCError` directly only when you control the error shape.

3. **Error context.** Always include context about what failed (e.g., `toTRPCError(error, "failed_to_create_run")`).

4. **Non-fatal errors.** Log errors even if they don't break the flow. Use structured logging with context (runId, eventType, error message).

5. **Error messages.** Structure messages for clients:
   - User-facing: `"session_required"` (no internals)
   - Internal: Include IDs, context in `cause` field
   - Never expose stack traces, file paths, or internal state

6. **Retry logic.** Only retry transient errors. Use exponential backoff (max 3 retries).

7. **TanStack Start errors.** Use route-level error boundaries with `errorComponent`. Call `reset()` to retry rendering.

8. **Error boundaries.** Wrap streaming components in error boundaries. Surface retry affordances.

9. **SSR error handling.** Server-side rendering must handle missing dependencies gracefully:
   - Database unavailable: Return empty/null data instead of crashing
   - External services down: Skip optional features, log warnings
   - Use `isDbConnectionError()` type guard to classify DB errors
   - Wrap route handlers with try-catch for graceful degradation
   - Never throw unhandled errors during SSR (crashes entire page render)

10. **Graceful degradation.** When external dependencies are unavailable:
    - Check availability before initializing services (`isDbAvailable()`, `isUvAvailable()`)
    - Skip non-critical services with warnings instead of errors
    - Return sensible defaults (null session, empty arrays, empty state)
    - Log warnings for observability but don't crash the app

## Error Codes

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Invalid input
- `PRECONDITION_FAILED` - Precondition not met (e.g., biometric_required)
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- `TIMEOUT` - Operation timed out
- `CONFLICT` - Resource conflict

## SSR-Specific Error Handling

### Database Unavailable During SSR

Wrap handlers with try-catch and use `isDbConnectionError()` to return graceful fallbacks (e.g., `{ session: null, user: null }`) instead of crashing SSR. Never throw unhandled errors during SSR.

### Service Initialization

Check availability before starting services using `isDbAvailable()` or `isUvAvailable()`. Skip non-critical services with warnings instead of crashing on startup.

See `.ruler/graceful-degradation.md` for detailed patterns.


