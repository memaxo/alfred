# Linear Agent Activities Integration

## Core Principle

Linear Agent Activities enable ALFRED to function as a first-class Linear agent by automatically emitting progress updates during workflow execution. Activities provide real-time visibility into workflow state, tool execution, and outcomes directly in Linear's UI.

## Rules

1. **Activity emission is non-blocking.** All Linear activity emissions must be fire-and-forget operations wrapped in try-catch blocks. Activity failures must never break workflow execution. Log errors but continue processing.

2. **10-second acknowledgment requirement.** The first `thought` activity MUST be emitted within 10 seconds of workflow start. Use `Promise.race` with a 9-second timeout to ensure deadline compliance even if the Linear API is slow. This prevents Linear from marking the agent as unresponsive.

3. **Session initialization.** When a workflow starts with Linear context (`linear.sessionId` and `authzLinear`), automatically:
   - Set delegate (assignee) to Alfred's app user
   - Move issue to "started" state (or first "progress" state)
   - Set external URL pointing to workflow run viewer
   - All operations are fire-and-forget with error logging

4. **Activity types.** Use appropriate activity types:
   - `thought` - Initial acknowledgment and thinking steps
   - `action` - Tool execution (use `ephemeral: true` for intermediate steps)
   - `response` - Final results and completion
   - `error` - Failures and timeouts

5. **Retry logic.** All Linear API calls must use exponential backoff retry logic via `p-retry`. Retry on:
   - Rate limit errors (429)
   - Server errors (5xx)
   - Do NOT retry permanent errors (4xx except 429)

6. **Rate limiting.** Linear API has rate limits (~60 requests/minute). Implement throttling for activity emission:
   - Max 1 activity per 30 seconds per workflow run
   - Use ephemeral activities for intermediate steps to reduce UI clutter
   - Batch activities when possible

7. **Session mapping persistence.** Always persist `linearSessionId` and `linearSpace` in `workflow_runs` table when Linear context is provided. This enables:
   - Webhook handlers to find workflows by Linear session
   - Bidirectional synchronization between ALFRED and Linear
   - Workflow cancellation when Linear issue state changes

8. **Webhook event handling.** Linear webhooks must handle:
   - Issue assignment → Start workflow if assigned to Alfred
   - Comment creation → Log for future context addition
   - Issue state change → Cancel workflow if completed/canceled
   - All webhook operations must be non-blocking

9. **Metrics instrumentation.** Instrument all Linear operations:
   - Activity emissions: `linearActivityEmissionsTotal`, `linearActivityDurationSeconds`
   - Session operations: `linearSessionOperationsTotal`
   - Webhook events: `linearWebhookEventsTotal`, `linearWebhookWorkflowStartsTotal`, `linearWebhookWorkflowCancelsTotal`

10. **Error handling.** Linear API errors must be:
    - Logged with structured logging (`logger.warn` or `logger.error`)
    - Non-fatal (don't throw, return `{ ok: false }`)
    - Tracked via metrics
    - Never expose internal details to Linear UI

## Implementation Patterns

### Activity Emission

```typescript
// ✅ Non-blocking with timeout protection
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

// ❌ Blocking activity emission
if (input.linear) {
  await emitLinearActivity("thought", {...}); // Blocks workflow
}
```

### Session Initialization

```typescript
// ✅ Fire-and-forget session setup
if (input.linear?.sessionId && input.authzLinear) {
  const issueId = extractIssueIdFromSession(input.linear.sessionId);
  if (issueId) {
    setLinearDelegate({
      space: input.linear.space,
      issueId,
      authz: input.authzLinear,
    }).catch((error) => {
      logger.warn("linear_delegate_setup_failed", { runId, error });
    });

    setLinearStarted({
      space: input.linear.space,
      issueId,
      authz: input.authzLinear,
    }).catch((error) => {
      logger.warn("linear_started_setup_failed", { runId, error });
    });
  }
}

// ❌ Blocking session setup
if (input.linear?.sessionId && input.authzLinear) {
  await setLinearDelegate({...}); // Blocks workflow creation
  await setLinearStarted({...});
}
```

### Webhook Event Handling

```typescript
// ✅ Non-blocking webhook processing
if (eventType === "Issue" && action === "update" && isIssueStateCompletedOrCanceled(payload)) {
  const issueId = extractIssueId(payload);
  if (issueId) {
    const workflow = await workflowRepo.findRunByLinearSession(issueId);
    if (workflow && workflow.status === "running") {
      try {
        await runRegistry.dispatchCancel(workflow.id);
        await workflowRepo.updateRun(workflow.id, { status: "cancelled" });
        linearWebhookWorkflowCancelsTotal.inc();
      } catch (error) {
        logger.warn("linear_webhook_workflow_cancel_failed", { runId, error });
      }
    }
  }
}

// ❌ Blocking webhook processing
if (eventType === "Issue" && action === "update") {
  await cancelWorkflow(issueId); // Blocks webhook response
}
```

### Retry Logic

```typescript
// ✅ Exponential backoff with p-retry
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
        if (error?.statusCode === 429 || (error?.statusCode >= 500 && error?.statusCode < 600)) {
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
    }
  );
}

// ❌ No retry logic
const response = await client.createAgentActivity(payload);
```

## File Locations

- **Linear helper module**: `packages/agent/src/orchestrator/linear.ts`
- **Workflow runner**: `packages/api/src/workflow/runner.ts`
- **Workflow router**: `packages/api/src/routers/workflow.ts`
- **Webhook handler**: `apps/web/src/routes/api/linear/webhook.ts`
- **Database schema**: `packages/db/src/schema/workflow.ts`
- **Repository**: `packages/db/src/repo/workflow.ts`
- **Metrics**: `packages/api/src/metrics.ts`

## Database Schema

```sql
-- Migration 0022: Linear workflow session mapping
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS linear_session_id TEXT,
  ADD COLUMN IF NOT EXISTS linear_space TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_linear_session
  ON workflow_runs(linear_session_id)
  WHERE linear_session_id IS NOT NULL;
```

## Activity Emission Lifecycle

1. **Workflow Start** (< 10s):
   - Emit `thought` activity with workflow requirement
   - Set external URL for session navigation
   - Initialize session (delegate, state)

2. **Workflow Execution**:
   - Emit `action` activities for tool calls (ephemeral)
   - Emit `error` activities on failures
   - Throttle to max 1 per 30 seconds

3. **Workflow Completion**:
   - Emit `response` activity with results
   - Update workflow status to "completed"

4. **Workflow Failure**:
   - Emit `error` activity with error message
   - Update workflow status to "failed"

## Webhook Event Flow

1. **Issue Assignment**:
   - Verify assignment to Alfred's app user
   - Check for existing running workflow
   - Start new workflow with Linear context
   - Extract requirement from issue description/title

2. **Comment Creation**:
   - Find workflow by Linear session ID
   - Log comment for future context addition
   - (Future: Add comment as workflow context)

3. **Issue State Change**:
   - Detect completed/canceled state
   - Find running workflow by Linear session ID
   - Cancel workflow via run registry
   - Update workflow status to "cancelled"

## Testing Requirements

- Unit tests for Linear helper module (mocked Linear client)
- Unit tests for workflow repository Linear functions
- Integration tests for workflow router Linear integration
- Integration tests for webhook handler event processing
- Manual testing checklist for end-to-end verification

## Performance Budgets

- Activity emission: < 1s (p99)
- Session initialization: < 2s (fire-and-forget)
- Webhook processing: < 500ms (p99)
- Retry delays: 1s → 2s → 4s (max 3 retries)

## Related Rules

- `.ruler/17-workflow-patterns.md` - Workflow execution patterns
- `.ruler/18-observability.md` - Metrics and logging
- `.ruler/16-error-handling.md` - Error handling standards
- `.ruler/09-purity-and-performance.md` - Performance budgets

