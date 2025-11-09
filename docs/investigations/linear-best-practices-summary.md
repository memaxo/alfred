# Linear Agent Activities Integration - Updated Plan with Best Practices

## Key Findings from Linear Documentation

### Critical Requirements

1. **10-Second Acknowledgment (CRITICAL)**
   - First activity (`thought`) MUST be sent within 10 seconds of session creation
   - Linear marks agent as unresponsive if no activity within 10s
   - Use `Promise.race` with timeout to ensure deadline even if API is slow

2. **30-Minute Session Expiration**
   - Sessions expire after 30 minutes of inactivity
   - Emit activities regularly (at least every 30 minutes) to keep session alive
   - Use `ephemeral: true` for intermediate activities to reduce UI clutter

3. **Rate Limiting**
   - Linear API rate limits: ~60 requests per minute (verify exact limits)
   - Implement exponential backoff for 429 errors
   - Max retries: 3, initial delay: 1s, max delay: 10s
   - Log rate limit hits for capacity planning

4. **Activity Best Practices**
   - Use `ephemeral: true` for intermediate steps (file edits, command runs)
   - Use `ephemeral: false` for final results (completion, errors)
   - Include meaningful titles and descriptions for better UX
   - Throttle activities to avoid overwhelming Linear UI (max 1 per 30 seconds)

5. **Session Management**
   - Set external URL immediately after session creation
   - When delegated an issue not in `started`, `completed`, or `canceled`, move to first `started` state
   - This signals to users that the agent is actively working

6. **Webhook Security**
   - Webhook signature verification already implemented (HMAC SHA256)
   - Verify timestamp to prevent replay attacks (5-minute window)
   - Validate payload structure before processing

## Updated Implementation Tasks

### Phase 2 Enhancements

**Task 2.2 (Enhanced)**: Implement Activity Emission with Retry Logic
- Add `p-retry` dependency for exponential backoff
- Implement `callLinearWithRetry` helper function
- Handle 429 (rate limit) and 5xx (transient) errors with retries
- Abort retries for 4xx (permanent) errors

**Task 2.6 (New)**: Implement Session External URL Function
- Create `setLinearSessionExternalUrl` function
- Set external URL pointing to workflow run viewer
- Enables click-through navigation from Linear to ALFRED

### Phase 4 Enhancements

**Task 4.3 (Enhanced)**: Emit Thought Activity with Timeout Protection
- Use `Promise.race` with 9-second timeout
- Ensure acknowledgment within 10 seconds even if API is slow
- Fire-and-forget after timeout to not block workflow

**Task 4.4 (New)**: Set External URL After Thought Activity
- Call `setLinearSessionExternalUrl` immediately after thought activity
- URL format: `${VITE_APP_URL}/orchestrator/run/${runId}`

**Task 4.5 (Enhanced)**: Action Activities with Ephemeral Guidance
- Document `ephemeral: true` for intermediate tool calls
- Document `ephemeral: false` for significant milestones
- Include parameter and result for tool calls

**Task 4.7 (Enhanced)**: Router Event Loop with Throttling
- Add throttling (max 1 activity per 30 seconds)
- Only emit for significant events (errors, completion)
- Track last emission time per runId

## Additional Considerations

### Rate Limiting Strategy

```typescript
// Implement in linear.ts
import pRetry from "p-retry";

async function callLinearWithRetry<T>(
  fn: () => Promise<T>,
  context: { operation: string; sessionId?: string }
): Promise<T> {
  return pRetry(
    async () => {
      try {
        return await fn();
      } catch (error: any) {
        // Retry on rate limit (429) or server errors (5xx)
        if (error?.statusCode === 429 || error?.statusCode >= 500) {
          logger.warn("linear_api_rate_limit", {
            operation: context.operation,
            statusCode: error.statusCode,
          });
          throw error; // Retry
        }
        throw pRetry.AbortError(error); // Don't retry permanent errors
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 10000,
      factor: 2,
      onFailedAttempt: (error) => {
        logger.warn("linear_api_retry", {
          attempt: error.attemptNumber,
          operation: context.operation,
          error: error.message,
        });
      },
    }
  );
}
```

### 10-Second Acknowledgment Pattern

```typescript
// In runner generator
if (input.linear) {
  const thoughtActivityPromise = emitLinearActivity("thought", {
    sessionId: input.linear.sessionId,
    space: input.linear.space,
    authz: input.linear.authz,
    body: `Starting workflow: ${input.requirement}`,
  }).catch((error) => {
    logger.warn("linear_thought_activity_failed", { runId, error });
    return { ok: false };
  });

  // Ensure acknowledgment within 10 seconds (fire-and-forget after timeout)
  Promise.race([
    thoughtActivityPromise,
    delay(9000).then(() => {
      logger.warn("linear_thought_activity_timeout", { runId });
      return { ok: false };
    }),
  ]).catch(() => {
    // Ignore errors, already logged
  });
}
```

### Activity Throttling Pattern

```typescript
// In workflow router event loop
const lastActivityEmission = new Map<string, number>();
const ACTIVITY_THROTTLE_MS = 30_000; // 30 seconds

if (input.linear?.sessionId && input.authzLinear) {
  const now = Date.now();
  const lastTime = lastActivityEmission.get(runId) ?? 0;
  
  if (event.type === "error" && now - lastTime > ACTIVITY_THROTTLE_MS) {
    lastActivityEmission.set(runId, now);
    emitLinearActivity("error", {...}).catch((error) => {
      logger.warn("linear_activity_emission_failed", { runId, error });
    });
  }
}
```

## Updated Task Count

**Original Tasks**: 43
**New Tasks Added**: 2 (External URL, Throttling)
**Enhanced Tasks**: 4 (Retry logic, Timeout protection, Ephemeral guidance, Throttling)

**Total Tasks**: 45

## Dependencies to Add

- `p-retry` package for exponential backoff retry logic
- Verify Linear API rate limit exact values
- Document ephemeral activity usage patterns

## Testing Updates

- Add test for 10-second acknowledgment deadline
- Add test for rate limit retry logic
- Add test for activity throttling
- Add test for external URL setting
- Verify ephemeral flag usage in activities

