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
     logger.warn("workflow_event_persistence_failed", {
       runId,
       eventType: event.type,
       error: error instanceof Error ? error.message : String(error),
     });
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
    logger.warn("event_persistence_failed", {
      runId,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue streaming to client
  }
}
```

