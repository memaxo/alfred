# Linear Agent Activities Integration - Detailed Implementation

**Status**: Phase 5.1 Complete ✅ (November 2025)

This document contains detailed implementation patterns archived from `.ruler/24-linear-integration.md` after Phase 5.1 completion.

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

## Performance Budgets

- Activity emission: < 1s (p99)
- Session initialization: < 2s (fire-and-forget)
- Webhook processing: < 500ms (p99)
- Retry delays: 1s → 2s → 4s (max 3 retries)

## Metrics Instrumentation

- Activity emissions: `linearActivityEmissionsTotal`, `linearActivityDurationSeconds`
- Session operations: `linearSessionOperationsTotal`
- Webhook events: `linearWebhookEventsTotal`, `linearWebhookWorkflowStartsTotal`, `linearWebhookWorkflowCancelsTotal`

