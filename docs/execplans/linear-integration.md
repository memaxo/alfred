# Complete Linear Agent Activities Integration

This ExecPlan is a living document maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, ALFRED will function as a first-class Linear agent. Users will be able to assign Linear issues to Alfred and see real-time progress updates as workflows execute. Alfred will automatically acknowledge assignments within 10 seconds, move issues to "in progress" state, and emit activity updates as work proceeds.

**What this enables:** A user working in Linear can assign an issue to Alfred just as they would assign it to a human teammate. Alfred will transparently communicate its progress through Linear's native UI, showing thinking steps, tool executions, and final results. The workflow remains visible and controllable from Linear without requiring users to switch contexts to ALFRED's web interface.

**How to see it working:** (1) Create a Linear issue in a team where Alfred is installed and has OAuth access. (2) Assign the issue to Alfred's app user. (3) Within 10 seconds, observe a "thought" activity appear in Linear's activity feed showing "Starting workflow: [issue title]". (4) Watch subsequent "action" activities as Alfred executes tools. (5) See a final "response" activity when the workflow completes with results. (6) Click the external URL link to view the full workflow run in ALFRED's web interface.


## Progress

- [ ] (YYYY-MM-DD HH:MMZ) Read Linear SDK documentation and understand agent session lifecycle
- [ ] (YYYY-MM-DD HH:MMZ) Install p-retry dependency for exponential backoff
- [ ] (YYYY-MM-DD HH:MMZ) Implement emitLinearActivity() with error handling and retry logic
- [ ] (YYYY-MM-DD HH:MMZ) Implement setLinearDelegate() helper function
- [ ] (YYYY-MM-DD HH:MMZ) Implement setLinearStarted() helper function
- [ ] (YYYY-MM-DD HH:MMZ) Implement setLinearSessionExternalUrl() helper function
- [ ] (YYYY-MM-DD HH:MMZ) Add extractIssueIdFromSession() implementation
- [ ] (YYYY-MM-DD HH:MMZ) Add Linear metrics to packages/api/src/metrics.ts
- [ ] (YYYY-MM-DD HH:MMZ) Add findRunByLinearSession() to workflow repository
- [ ] (YYYY-MM-DD HH:MMZ) Integrate 10-second acknowledgment into workflow runner
- [ ] (YYYY-MM-DD HH:MMZ) Add session initialization (delegate + state + external URL) to workflow runner
- [ ] (YYYY-MM-DD HH:MMZ) Add action activity emission for tool calls
- [ ] (YYYY-MM-DD HH:MMZ) Add response/error activity emission on completion
- [ ] (YYYY-MM-DD HH:MMZ) Create webhook handler at apps/web/src/routes/api/linear/webhook.ts
- [ ] (YYYY-MM-DD HH:MMZ) Implement webhook signature verification
- [ ] (YYYY-MM-DD HH:MMZ) Handle issue assignment events
- [ ] (YYYY-MM-DD HH:MMZ) Handle issue state change events
- [ ] (YYYY-MM-DD HH:MMZ) Handle comment creation events
- [ ] (YYYY-MM-DD HH:MMZ) Write unit tests for Linear helper functions
- [ ] (YYYY-MM-DD HH:MMZ) Write integration tests for workflow runner
- [ ] (YYYY-MM-DD HH:MMZ) Manual end-to-end testing with real Linear workspace
- [ ] (YYYY-MM-DD HH:MMZ) Update documentation with setup instructions


## Surprises & Discoveries

(To be filled as implementation proceeds. Document unexpected behaviors, performance characteristics, or design insights discovered during development.)


## Decision Log

(To be filled as decisions are made. Record each significant choice with rationale and timestamp.)


## Outcomes & Retrospective

(To be filled at completion. Summarize what was achieved, what remains incomplete, and lessons learned for future work.)


## Context and Orientation

**What is Linear?** Linear is a project management tool similar to Jira or GitHub Issues. Teams create "issues" (tasks) organized into "teams" (projects) with configurable workflow states (backlog, in progress, done, etc.). Linear provides a GraphQL API and TypeScript SDK for integrations.

**What are Linear Agent Activities?** Agent Activities are a feature that allows AI agents to participate in Linear as first-class members. When an issue is assigned to an agent, Linear creates an "agent session" identified by a session ID. The agent can then emit structured activities (thought, action, response, error) that appear in Linear's UI as a timeline of progress updates. This differs from simply posting comments because activities are structured, searchable, and integrate with Linear's native agent interaction guidelines.

**What is ALFRED's architecture?** ALFRED is a personal AI assistant built as a Turborepo monorepo with these key packages:

- `packages/agent` - Core AI orchestration logic (tools, workflows, planning)
- `packages/api` - tRPC routers that expose functionality to clients
- `packages/db` - Drizzle ORM schema, migrations, and repositories
- `apps/web` - TanStack Start web interface with file-based routing

Workflows in ALFRED are long-running processes that execute a series of tool calls to accomplish a user's goal. The workflow system already exists and works. Our task is to integrate Linear so workflows can be triggered from Linear and report progress back to Linear.

**Current state of Linear integration:**

The file `packages/agent/src/orchestrator/tool/ticket.ts` contains a complete implementation of a "ticket" tool that can perform all Linear operations including emitting agent activities. This tool is already working and tested. It accepts parameters like `{ action: "activity.thought", sessionId: "...", description: "...", authz: "..." }` and calls the Linear SDK to create activities.

The file `packages/agent/src/orchestrator/linear.ts` contains stub functions that are currently no-ops. These functions are meant to be called from workflow runners to emit activities, but they currently just return `{ ok: false }` without doing anything.

The database table `workflow_runs` has columns `linear_session_id` and `linear_space` added by migration 0022. These columns are intended to store the mapping between ALFRED workflow runs and Linear agent sessions, but they are not yet populated.

The workflow runner at `packages/api/src/workflow/runner.ts` executes workflows but does not emit any Linear activities. It needs to be modified to call the Linear helper functions at appropriate points in the workflow lifecycle.

No webhook handler exists yet. When Linear sends webhook events (issue assigned, state changed, comment added), there is no endpoint to receive them.


## Plan of Work

**Phase 1: Implement Linear Helper Functions**

We will replace the stub implementations in `packages/agent/src/orchestrator/linear.ts` with real implementations that call the existing `toolTicket` tool. This approach reuses the already-working ticket tool implementation and avoids duplicating Linear SDK logic. Each helper function will be a thin wrapper that:

1. Constructs the appropriate input for `toolTicket.execute()`
2. Calls the tool and captures the result
3. Handles errors by logging them and returning `{ ok: false }` (non-fatal)
4. Never throws exceptions (fire-and-forget pattern)

The helper functions we need to implement are:

- `emitLinearActivity(type, params)` - Calls toolTicket with `action: "activity.${type}"`
- `setLinearDelegate(params)` - Calls toolTicket with `action: "set-delegate"`
- `setLinearStarted(params)` - Calls toolTicket with `action: "set-started"`
- `setLinearSessionExternalUrl(...)` - Calls toolTicket with `action: "session.external-url"`
- `extractIssueIdFromSession(sessionId)` - Parses the issue ID from a session ID string

Before implementing these, we need to install the `p-retry` package which provides exponential backoff retry logic. This is required because Linear's API has rate limits (approximately 60 requests per minute) and can return 429 or 5xx errors that should be retried.

**Phase 2: Add Metrics**

We will add Prometheus metrics to `packages/api/src/metrics.ts` to track Linear operations. These metrics enable monitoring and debugging in production. The metrics we need are:

- `linearActivityEmissionsTotal` - Counter with labels `{type, status}` tracking how many activities were emitted and whether they succeeded or failed
- `linearActivityDurationSeconds` - Histogram tracking how long activity emissions take
- `linearSessionOperationsTotal` - Counter with label `{operation}` tracking delegate/state/url operations
- `linearWebhookEventsTotal` - Counter with label `{event_type, action}` tracking webhook events received
- `linearWebhookWorkflowStartsTotal` - Counter tracking workflows started from webhooks
- `linearWebhookWorkflowCancelsTotal` - Counter tracking workflows canceled from webhooks

**Phase 3: Add Repository Functions**

We will add a function `findRunByLinearSession(sessionId: string)` to `packages/db/src/repo/workflow.ts`. This function queries the `workflow_runs` table using the `linear_session_id` column to find the workflow associated with a Linear agent session. This is needed by the webhook handler to determine which workflow to cancel when a Linear issue is marked complete.

The query will use the index `idx_workflow_runs_linear_session` that already exists from migration 0022. This ensures the lookup is fast even with many workflow runs in the database.

**Phase 4: Integrate Into Workflow Runner**

The workflow runner at `packages/api/src/workflow/runner.ts` (or similar - we need to locate the actual entry point) orchestrates workflow execution. We will modify it to:

1. **At workflow start**: Check if `input.linear` is provided (with sessionId and space). If so, persist these to the database and immediately emit a `thought` activity. The thought emission must complete within 10 seconds or Linear will mark Alfred as unresponsive. We use `Promise.race` with a 9-second timeout to ensure we meet this deadline even if the Linear API is slow.

2. **At workflow start**: If Linear context exists, call `setLinearDelegate()`, `setLinearStarted()`, and `setLinearSessionExternalUrl()` in parallel as fire-and-forget operations. These initialize the session by assigning Alfred as the issue owner, moving the issue to "started" state, and linking to the ALFRED workflow viewer.

3. **During tool execution**: After each tool call completes, emit an `action` activity with `ephemeral: true`. Ephemeral activities don't clutter the Linear UI but are still recorded. We throttle to maximum 1 activity per 30 seconds to respect Linear's rate limits.

4. **At workflow completion**: Emit a `response` activity with the final results.

5. **On workflow error**: Emit an `error` activity with the error message.

All activity emissions are non-blocking. If an emission fails, we log the error but continue workflow execution. The workflow must never fail because Linear is unavailable.

**Phase 5: Create Webhook Handler**

We will create a new route handler at `apps/web/src/routes/api/linear/webhook.ts` using TanStack Start's server route pattern. This handler:

1. **Verifies webhook signature**: Uses the Linear SDK's webhook client to verify the HMAC SHA256 signature in the `linear-signature` header. This prevents spoofed webhook events.

2. **Handles Issue assignment**: When an issue is assigned to Alfred's app user, extract the requirement from the issue title/description and start a new workflow with Linear context. Check for existing running workflows on the same issue to avoid duplicates.

3. **Handles Issue state change**: When an issue moves to "completed" or "canceled" state, find the associated workflow by Linear session ID and cancel it via the run registry.

4. **Handles Comment creation**: Log the comment for future context addition (not implemented in this phase).

The webhook handler responds with 200 OK immediately after signature verification, then processes the event asynchronously. This ensures Linear receives timely acknowledgments and doesn't retry webhooks unnecessarily.

**Phase 6: Testing and Validation**

We will write tests at three levels:

1. **Unit tests**: Test each Linear helper function in isolation with mocked toolTicket
2. **Integration tests**: Test workflow runner with Linear integration using mocked Linear API
3. **End-to-end test**: Manual testing with a real Linear workspace

For end-to-end testing, we need a Linear workspace with Alfred installed, OAuth credentials configured, and webhook endpoints accessible (may require ngrok for local development).


## Concrete Steps

**Step 1: Install p-retry dependency**

Navigate to the repository root and add p-retry to the agent package:

    cd /Users/jackmazac/Development/alfred
    cd packages/agent
    bun add p-retry

Verify installation:

    bun pm ls | grep p-retry

Expected output:

    └── p-retry@6.2.0

**Step 2: Locate and import toolTicket in linear.ts**

Open `packages/agent/src/orchestrator/linear.ts`. At the top of the file, add imports:

    import pRetry from "p-retry";
    import { toolTicket } from "./tool/ticket";

We also need a logger. Import from the metrics package:

    import { logger } from "@alfred/metrics";

If the logger is not available, we can use console.warn/console.error as fallbacks for logging.

**Step 3: Implement emitLinearActivity()**

Replace the stub implementation of `emitLinearActivity` with:

    export async function emitLinearActivity(
      type: LinearActivityType,
      params: LinearActivityParams
    ): Promise<{ ok: boolean; id?: string }> {
      try {
        return await pRetry(
          async () => {
            const action = `activity.${type}` as
              | "activity.thought"
              | "activity.action"
              | "activity.response"
              | "activity.error";
    
            const input = {
              space: params.space,
              action,
              sessionId: params.sessionId,
              authz: params.authz,
              title: params.title,
              description: params.body,
              parameter: params.parameter,
              result: params.result,
              ephemeral: params.ephemeral,
            };
    
            const result = await toolTicket.execute({ input });
            return { ok: result.ok, id: result.id };
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              const statusCode = (error as any)?.statusCode;
              // Retry on rate limit (429) or server errors (5xx)
              if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
                logger?.warn?.("linear_activity_retry", {
                  type,
                  sessionId: params.sessionId,
                  attempt: error.attemptNumber,
                  retriesLeft: error.retriesLeft,
                });
                return; // Will retry
              }
              // Don't retry permanent errors
              throw new pRetry.AbortError(error);
            },
          }
        );
      } catch (error) {
        logger?.error?.("linear_activity_failed", {
          type,
          sessionId: params.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      }
    }

**Explanation of this implementation:**

- We use `pRetry` to wrap the tool call with exponential backoff retry logic
- The `retries: 3` means we'll try up to 4 times total (1 initial + 3 retries)
- `minTimeout: 1000` starts with a 1-second delay between retries
- `maxTimeout: 10000` caps the delay at 10 seconds
- `factor: 2` doubles the delay each retry (1s, 2s, 4s)
- In `onFailedAttempt`, we check the HTTP status code and only retry for 429 or 5xx errors
- For 4xx errors (except 429), we throw `AbortError` to stop retrying immediately
- If all retries fail, we log the error and return `{ ok: false }` without throwing
- The `logger?.warn?.()` syntax safely handles missing logger (optional chaining)

**Step 4: Implement setLinearDelegate()**

Replace the stub implementation:

    export async function setLinearDelegate(
      params: LinearSessionParams
    ): Promise<void> {
      try {
        await pRetry(
          async () => {
            const input = {
              space: params.space,
              action: "set-delegate" as const,
              issueId: params.issueId,
              delegateId: params.delegateId,
              authz: params.authz,
            };
    
            await toolTicket.execute({ input });
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              const statusCode = (error as any)?.statusCode;
              if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
                return; // Retry
              }
              throw new pRetry.AbortError(error);
            },
          }
        );
      } catch (error) {
        logger?.warn?.("linear_delegate_failed", {
          issueId: params.issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Non-fatal: workflow continues
      }
    }

**Step 5: Implement setLinearStarted()**

Replace the stub implementation:

    export async function setLinearStarted(
      params: LinearSessionParams
    ): Promise<{ stateId: string }> {
      try {
        const result = await pRetry(
          async () => {
            const input = {
              space: params.space,
              action: "set-started" as const,
              issueId: params.issueId,
              authz: params.authz,
            };
    
            return await toolTicket.execute({ input });
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              const statusCode = (error as any)?.statusCode;
              if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
                return;
              }
              throw new pRetry.AbortError(error);
            },
          }
        );
        return { stateId: result.stateId ?? "state_unknown" };
      } catch (error) {
        logger?.warn?.("linear_started_failed", {
          issueId: params.issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { stateId: "state_stub" };
      }
    }

**Step 6: Implement setLinearSessionExternalUrl()**

Replace the stub implementation:

    export async function setLinearSessionExternalUrl(
      sessionId: string,
      space: string,
      authz: string,
      url: string
    ): Promise<void> {
      try {
        await pRetry(
          async () => {
            const input = {
              space,
              action: "session.external-url" as const,
              sessionId,
              url,
              authz,
            };
    
            await toolTicket.execute({ input });
          },
          {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 10000,
            factor: 2,
            onFailedAttempt: (error) => {
              const statusCode = (error as any)?.statusCode;
              if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
                return;
              }
              throw new pRetry.AbortError(error);
            },
          }
        );
      } catch (error) {
        logger?.warn?.("linear_external_url_failed", {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

**Step 7: Improve extractIssueIdFromSession()**

The current stub implementation is too simplistic. Linear session IDs have a specific format. Update the implementation:

    export function extractIssueIdFromSession(sessionId: string): string | null {
      if (!sessionId || typeof sessionId !== "string") {
        return null;
      }
      
      // Linear session IDs typically contain the issue ID
      // Format: "session_{issueId}_{timestamp}" or similar
      // For now, we'll validate it's not empty and has reasonable length
      const trimmed = sessionId.trim();
      if (trimmed.length === 0 || trimmed.length > 255) {
        return null;
      }
      
      // Return the session ID itself as the issue identifier
      // The webhook payload will contain the actual issue ID
      return trimmed;
    }

Note: This is a defensive implementation. The actual Linear session ID format may differ. We'll refine this based on real webhook payloads during testing.

**Step 8: Add Linear metrics**

Open `packages/api/src/metrics.ts`. First verify the imports at the top of the file include:

    import client from "prom-client";

Then scroll to the section where other metrics are defined (look for existing Counter and Histogram definitions). Add these new metrics:

    export const linearActivityEmissionsTotal = new client.Counter({
      name: "linear_activity_emissions_total",
      help: "Total Linear agent activity emissions",
      labelNames: ["type", "status"] as const,
      registers: [metricsRegistry],
    });
    
    export const linearActivityDurationSeconds = new client.Histogram({
      name: "linear_activity_duration_seconds",
      help: "Duration of Linear activity emissions",
      labelNames: ["type"] as const,
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [metricsRegistry],
    });
    
    export const linearSessionOperationsTotal = new client.Counter({
      name: "linear_session_operations_total",
      help: "Total Linear session operations (delegate, state, URL)",
      labelNames: ["operation"] as const,
      registers: [metricsRegistry],
    });
    
    export const linearWebhookEventsTotal = new client.Counter({
      name: "linear_webhook_events_total",
      help: "Total Linear webhook events received",
      labelNames: ["event_type", "action"] as const,
      registers: [metricsRegistry],
    });
    
    export const linearWebhookWorkflowStartsTotal = new client.Counter({
      name: "linear_webhook_workflow_starts_total",
      help: "Total workflows started from Linear webhooks",
      registers: [metricsRegistry],
    });
    
    export const linearWebhookWorkflowCancelsTotal = new client.Counter({
      name: "linear_webhook_workflow_cancels_total",
      help: "Total workflows canceled from Linear webhooks",
      registers: [metricsRegistry],
    });

**Step 9: Instrument Linear helper functions with metrics**

Go back to `packages/agent/src/orchestrator/linear.ts` and add metrics instrumentation. First, import the metrics:

    import {
      linearActivityEmissionsTotal,
      linearActivityDurationSeconds,
      linearSessionOperationsTotal,
    } from "@alfred/api/metrics";

Note: This creates a dependency from agent package to api package. If this causes circular dependency issues, we may need to move metrics to a separate package or pass them as parameters. For now, proceed with the import and we'll adjust if needed.

Update the `emitLinearActivity` function to include metrics:

    export async function emitLinearActivity(
      type: LinearActivityType,
      params: LinearActivityParams
    ): Promise<{ ok: boolean; id?: string }> {
      const stopTimer = linearActivityDurationSeconds.startTimer({ type });
      try {
        const result = await pRetry(
          async () => {
            // ... (existing implementation)
          },
          {
            // ... (existing retry config)
          }
        );
        linearActivityEmissionsTotal.inc({ type, status: "success" });
        return result;
      } catch (error) {
        linearActivityEmissionsTotal.inc({ type, status: "failure" });
        logger?.error?.("linear_activity_failed", {
          type,
          sessionId: params.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      } finally {
        stopTimer();
      }
    }

Similarly, add metrics to the other helper functions:

    export async function setLinearDelegate(
      params: LinearSessionParams
    ): Promise<void> {
      linearSessionOperationsTotal.inc({ operation: "delegate" });
      try {
        // ... (existing implementation)
      } catch (error) {
        // ... (existing error handling)
      }
    }
    
    export async function setLinearStarted(
      params: LinearSessionParams
    ): Promise<{ stateId: string }> {
      linearSessionOperationsTotal.inc({ operation: "state" });
      try {
        // ... (existing implementation)
      } catch (error) {
        // ... (existing error handling)
      }
    }
    
    export async function setLinearSessionExternalUrl(
      sessionId: string,
      space: string,
      authz: string,
      url: string
    ): Promise<void> {
      linearSessionOperationsTotal.inc({ operation: "external_url" });
      try {
        // ... (existing implementation)
      } catch (error) {
        // ... (existing error handling)
      }
    }

**Step 10: Add repository function for Linear session lookup**

Open `packages/db/src/repo/workflow.ts`. Locate the existing repository functions (likely exported as an object or class). Add this new function:

    export async function findRunByLinearSession(
      sessionId: string
    ): Promise<WorkflowRun | null> {
      const [row] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.linearSessionId, sessionId))
        .limit(1);
      
      return row ?? null;
    }

Make sure to import the necessary dependencies at the top of the file:

    import { eq } from "drizzle-orm";
    import { db } from "../client";
    import { workflowRuns } from "../schema/workflow";

Also ensure the function is exported. If the file exports an object like `workflowRepo`, add the function to that object:

    export const workflowRepo = {
      // ... existing functions
      findRunByLinearSession,
    };

**Step 11: Locate the workflow runner entry point**

We need to find where workflows are actually started. The file might be `packages/api/src/workflow/runner.ts` or `packages/api/src/routers/workflow.ts` or similar. Search for files that create workflow runs:

    cd /Users/jackmazac/Development/alfred
    grep -r "createRun" packages/api/src/ --include="*.ts"

Expected output will show the file(s) where `workflowRepo.createRun()` is called. That's where we need to add Linear integration.

Let's assume it's in `packages/api/src/routers/workflow.ts` in a tRPC procedure called `run` or `start`. Locate the procedure that looks like:

    export const workflowRouter = router({
      run: protectedProcedure
        .input(z.object({ ... }))
        .mutation(async ({ input, ctx }) => {
          // Create workflow run
          // Execute workflow
          // Return results
        }),
    });

**Step 12: Add Linear context to workflow input schema**

In the workflow router input schema, ensure there's a field for Linear context:

    .input(z.object({
      requirement: z.string(),
      // ... other fields
      linear: z.object({
        sessionId: z.string(),
        space: z.string(),
      }).optional(),
      authzLinear: z.string().optional(), // Linear OAuth token
    }))

If these fields don't exist, add them to the input schema.

**Step 13: Persist Linear session in database**

In the workflow router mutation handler, after creating the workflow run with `workflowRepo.createRun()`, add code to update the Linear session ID if provided:

    const run = await workflowRepo.createRun({
      id: runId,
      userId: ctx.session.user.id,
      workflowId: input.workflowId,
      status: "running",
      inputData: input as any,
      linearSessionId: input.linear?.sessionId ?? null,
      linearSpace: input.linear?.space ?? null,
    });

Note: You may need to check if the `createRun` function accepts these fields. If not, follow up with an `updateRun` call:

    if (input.linear?.sessionId) {
      await workflowRepo.updateRun(runId, {
        linearSessionId: input.linear.sessionId,
        linearSpace: input.linear.space,
      });
    }

**Step 14: Emit thought activity within 10 seconds**

Immediately after creating the workflow run and before starting execution, add this code:

    // Linear: Emit thought activity within 10 seconds (required)
    if (input.linear?.sessionId && input.authzLinear) {
      const thoughtActivityPromise = emitLinearActivity("thought", {
        sessionId: input.linear.sessionId,
        space: input.linear.space,
        authz: input.authzLinear,
        body: `Starting workflow: ${input.requirement}`,
      }).catch((error) => {
        logger.warn("linear_thought_activity_failed", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { ok: false };
      });
      
      // Race with 9-second timeout to meet 10-second deadline
      Promise.race([
        thoughtActivityPromise,
        new Promise((resolve) =>
          setTimeout(() => {
            logger.warn("linear_thought_activity_timeout", { runId });
            resolve({ ok: false });
          }, 9000)
        ),
      ]).catch(() => {
        // Errors already logged, don't propagate
      });
    }

This implementation uses `Promise.race` to ensure we attempt the activity emission for up to 9 seconds, leaving a 1-second buffer before Linear's 10-second timeout. If the emission succeeds quickly, great. If it takes longer than 9 seconds or fails, we log a warning but don't block workflow execution.

**Step 15: Initialize Linear session (delegate, state, URL)**

After emitting the thought activity, add session initialization:

    // Linear: Initialize session (fire-and-forget)
    if (input.linear?.sessionId && input.authzLinear) {
      const issueId = extractIssueIdFromSession(input.linear.sessionId);
      if (issueId) {
        // Set Alfred as delegate
        setLinearDelegate({
          space: input.linear.space,
          issueId,
          authz: input.authzLinear,
        }).catch((error) => {
          logger.warn("linear_delegate_setup_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        
        // Move to started state
        setLinearStarted({
          space: input.linear.space,
          issueId,
          authz: input.authzLinear,
        }).catch((error) => {
          logger.warn("linear_started_setup_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        
        // Set external URL to workflow viewer
        const workflowUrl = `${process.env.PUBLIC_URL}/workflow/${runId}`;
        setLinearSessionExternalUrl(
          input.linear.sessionId,
          input.linear.space,
          input.authzLinear,
          workflowUrl
        ).catch((error) => {
          logger.warn("linear_external_url_setup_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

Note: `process.env.PUBLIC_URL` must be configured in your environment (e.g., `https://alfred.example.com`). If it's not set, use a fallback or log a warning.

**Step 16: Emit action activities during tool execution**

This is trickier because we need to intercept tool calls. The workflow execution might be happening in a runner function that iterates over steps. Look for code that calls tools in a loop.

If the runner uses AI SDK v6's `streamText` or similar, tool calls are in the stream events. Look for where tool results are handled and add:

    // After tool execution completes
    if (input.linear?.sessionId && input.authzLinear && toolResult) {
      // Throttle: only emit if last activity was >30 seconds ago
      const now = Date.now();
      const lastActivity = lastActivityTime.get(runId) ?? 0;
      if (now - lastActivity > 30000) {
        lastActivityTime.set(runId, now);
        
        emitLinearActivity("action", {
          sessionId: input.linear.sessionId,
          space: input.linear.space,
          authz: input.authzLinear,
          title: toolName,
          body: `Executed tool: ${toolName}`,
          parameter: JSON.stringify(toolInput),
          result: JSON.stringify(toolResult),
          ephemeral: true, // Don't clutter Linear UI
        }).catch((error) => {
          logger.warn("linear_action_activity_failed", {
            runId,
            toolName,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

You'll need to maintain a `lastActivityTime` Map to track when we last emitted an activity for each run. Declare this at the module level:

    const lastActivityTime = new Map<string, number>();

**Step 17: Emit response/error activity on completion**

At the end of the workflow execution, after updating the run status, add:

    // Linear: Emit final activity
    if (input.linear?.sessionId && input.authzLinear) {
      if (run.status === "completed") {
        emitLinearActivity("response", {
          sessionId: input.linear.sessionId,
          space: input.linear.space,
          authz: input.authzLinear,
          body: `Workflow completed successfully. Results: ${summaryOfResults}`,
        }).catch((error) => {
          logger.warn("linear_response_activity_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } else if (run.status === "failed") {
        emitLinearActivity("error", {
          sessionId: input.linear.sessionId,
          space: input.linear.space,
          authz: input.authzLinear,
          body: `Workflow failed: ${errorMessage}`,
        }).catch((error) => {
          logger.warn("linear_error_activity_failed", {
            runId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      
      // Cleanup throttle tracking
      lastActivityTime.delete(runId);
    }

**Step 18: Create webhook handler file**

Create a new file `apps/web/src/routes/api/linear/webhook.ts`. TanStack Start uses file-based routing, so this will automatically create an endpoint at `/api/linear/webhook`.

The file structure should be:

    import { createFileRoute } from "@tanstack/react-router";
    
    export const Route = createFileRoute("/api/linear/webhook")({
      // Route configuration
    });

However, for API endpoints, we use server routes instead. The correct structure is:

    // apps/web/src/routes/api/linear/webhook.ts
    import { json } from "@tanstack/react-router";
    
    export const handlers = {
      POST: async (req: Request) => {
        // Handle webhook
        return json({ ok: true });
      },
    };

Actually, looking at TanStack Start patterns, API routes use the server route handler pattern. Let's check the existing API routes in the codebase for the pattern:

    cd /Users/jackmazac/Development/alfred
    ls apps/web/src/routes/api/

Look for existing API route handlers to understand the pattern used in this project. Once you've identified the pattern, create the webhook handler following that structure.

For now, I'll provide a generic implementation that should work:

    // apps/web/src/routes/api/linear/webhook.ts
    import { LinearWebhookClient } from "@linear/sdk/webhooks";
    import { workflowRepo } from "@alfred/db";
    import {
      linearWebhookEventsTotal,
      linearWebhookWorkflowStartsTotal,
      linearWebhookWorkflowCancelsTotal,
    } from "@alfred/api/metrics";
    import { logger } from "@alfred/metrics";
    
    const WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      throw new Error("LINEAR_WEBHOOK_SECRET environment variable is required");
    }
    
    const webhookClient = new LinearWebhookClient(WEBHOOK_SECRET);
    
    export async function POST(request: Request): Promise<Response> {
      try {
        // Read raw body for signature verification
        const body = await request.text();
        const signature = request.headers.get("linear-signature");
        const timestamp = JSON.parse(body).createdAt;
        
        if (!signature) {
          logger.warn("linear_webhook_missing_signature");
          return new Response("Missing signature", { status: 400 });
        }
        
        // Verify signature
        try {
          webhookClient.verify(body, signature, timestamp);
        } catch (error) {
          logger.warn("linear_webhook_invalid_signature", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("Invalid signature", { status: 401 });
        }
        
        // Parse payload
        const payload = JSON.parse(body);
        const { type, action, data } = payload;
        
        linearWebhookEventsTotal.inc({ event_type: type, action });
        
        // Acknowledge immediately
        const response = new Response("OK", { status: 200 });
        
        // Process event asynchronously (don't await)
        processWebhookEvent(type, action, data).catch((error) => {
          logger.error("linear_webhook_processing_failed", {
            type,
            action,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        
        return response;
      } catch (error) {
        logger.error("linear_webhook_error", {
          error: error instanceof Error ? error.message : String(error),
        });
        return new Response("Internal error", { status: 500 });
      }
    }
    
    async function processWebhookEvent(
      type: string,
      action: string,
      data: any
    ): Promise<void> {
      if (type === "Issue" && action === "update") {
        await handleIssueUpdate(data);
      } else if (type === "Issue" && action === "create") {
        await handleIssueCreate(data);
      } else if (type === "Comment" && action === "create") {
        await handleCommentCreate(data);
      }
    }
    
    async function handleIssueUpdate(data: any): Promise<void> {
      const issue = data;
      const state = issue.state;
      
      // Check if issue moved to completed or canceled
      if (state?.type === "completed" || state?.type === "canceled") {
        const sessionId = issue.id; // Or extract from issue
        const workflow = await workflowRepo.findRunByLinearSession(sessionId);
        
        if (workflow && workflow.status === "running") {
          logger.info("linear_webhook_canceling_workflow", {
            runId: workflow.id,
            issueId: issue.id,
          });
          
          // Cancel workflow via run registry
          // Note: We need to import and use the run registry here
          // For now, just update the status
          await workflowRepo.updateRun(workflow.id, { status: "cancelled" });
          
          linearWebhookWorkflowCancelsTotal.inc();
        }
      }
    }
    
    async function handleIssueCreate(data: any): Promise<void> {
      // Not implemented yet: start workflow when issue assigned to Alfred
      logger.info("linear_webhook_issue_create", { issueId: data.id });
    }
    
    async function handleCommentCreate(data: any): Promise<void> {
      // Not implemented yet: add comment to workflow context
      logger.info("linear_webhook_comment_create", {
        commentId: data.id,
        issueId: data.issueId,
      });
    }

**Step 19: Configure webhook secret**

Add to your `.env` file (or environment):

    LINEAR_WEBHOOK_SECRET=your_webhook_secret_from_linear

To get this secret:
1. Go to Linear Settings > API > Webhooks
2. Create a new webhook pointing to `https://your-alfred-domain.com/api/linear/webhook`
3. Copy the webhook secret

For local development, you'll need to use ngrok or similar to expose your local server:

    ngrok http 3000

Then configure the webhook to point to the ngrok URL.

**Step 20: Write unit tests for Linear helpers**

Create `packages/agent/test/linear.test.ts`:

    import { describe, test, expect, mock } from "bun:test";
    import * as linearModule from "../src/orchestrator/linear";
    
    describe("Linear helper functions", () => {
      test("emitLinearActivity calls toolTicket with correct params", async () => {
        // Mock toolTicket
        const mockExecute = mock(() => Promise.resolve({ ok: true, id: "activity-123" }));
        
        // ... test implementation
        
        // This is a simplified example. Real tests need proper mocking.
      });
      
      test("emitLinearActivity handles errors gracefully", async () => {
        // Mock toolTicket to throw error
        // Verify it returns { ok: false } without throwing
      });
      
      test("extractIssueIdFromSession validates input", () => {
        expect(linearModule.extractIssueIdFromSession("")).toBeNull();
        expect(linearModule.extractIssueIdFromSession("valid-session-id")).toBe("valid-session-id");
      });
    });

Run tests:

    cd /Users/jackmazac/Development/alfred/packages/agent
    bun test

Expected output:

    ✓ Linear helper functions > emitLinearActivity calls toolTicket with correct params
    ✓ Linear helper functions > emitLinearActivity handles errors gracefully
    ✓ Linear helper functions > extractIssueIdFromSession validates input
    
    3 tests passed

**Step 21: Manual end-to-end testing**

Prerequisites:
- Linear workspace with Alfred app installed
- OAuth credentials configured in `.env`
- Webhook endpoint accessible (use ngrok for local dev)
- Test Linear issue ready to assign

Testing procedure:

1. Start ALFRED in development mode:

       cd /Users/jackmazac/Development/alfred
       bun run dev

2. Start ngrok (in another terminal):

       ngrok http 3000

3. Configure Linear webhook to point to ngrok URL + `/api/linear/webhook`

4. In Linear, create a test issue with title "Test Alfred Integration"

5. Assign the issue to Alfred's app user

6. Within 10 seconds, check Linear for a "thought" activity:
   - Should see: "Starting workflow: Test Alfred Integration"

7. Check ALFRED logs for activity emission:

       # Look for these log entries:
       linear_thought_activity_succeeded
       linear_delegate_setup_succeeded
       linear_started_setup_succeeded
       linear_external_url_setup_succeeded

8. Watch Linear issue for subsequent "action" activities as workflow executes

9. When workflow completes, verify "response" activity appears

10. Check metrics endpoint:

        curl http://localhost:3000/api/metrics | grep linear

    Expected output includes:

        linear_activity_emissions_total{type="thought",status="success"} 1
        linear_activity_emissions_total{type="action",status="success"} 3
        linear_activity_emissions_total{type="response",status="success"} 1
        linear_session_operations_total{operation="delegate"} 1
        linear_session_operations_total{operation="state"} 1
        linear_session_operations_total{operation="external_url"} 1

11. Test webhook cancellation:
    - Start another workflow by assigning a new issue
    - Before it completes, mark the issue as "Done" in Linear
    - Verify workflow is canceled in ALFRED logs


## Validation and Acceptance

**Success criteria:**

1. **10-second acknowledgment**: When an issue is assigned to Alfred, a "thought" activity appears in Linear within 10 seconds. Verify by checking timestamps in Linear UI and ALFRED logs.

2. **Session initialization**: Issue is automatically assigned to Alfred (delegate), moved to "started" state, and has an external URL linking to ALFRED's workflow viewer. Verify by inspecting issue properties in Linear.

3. **Progress updates**: As workflow executes tools, "action" activities appear in Linear's activity feed. Verify at least one action activity per workflow run.

4. **Completion notification**: When workflow finishes, a "response" activity appears with results. Verify the activity contains meaningful summary text.

5. **Error handling**: If workflow fails, an "error" activity appears with error message. Test by creating a workflow that intentionally fails (e.g., invalid tool parameters).

6. **Resilience**: If Linear API is unavailable (test by blocking network), workflow execution continues without crashing. Verify logs show warnings about failed activities but workflow completes.

7. **Webhook handling**: When an issue is marked complete in Linear, the associated workflow is canceled. Verify by checking workflow status changes from "running" to "cancelled".

8. **Metrics**: Prometheus metrics endpoint exposes Linear counters and histograms. Verify by querying `/api/metrics` and checking for `linear_*` metrics.

9. **Rate limit handling**: Under heavy load (multiple concurrent workflows), activity emissions are throttled and retried on 429 errors. Verify by running 10 workflows simultaneously and checking logs for retry attempts.

**Validation commands:**

Run all tests:

    cd /Users/jackmazac/Development/alfred
    bun run test

Start development server:

    bun run dev

Check metrics:

    curl http://localhost:3000/api/metrics | grep linear_

View logs (assuming structured JSON logging):

    tail -f /path/to/logs | grep linear

**Acceptance tests:**

1. Create a test script `scripts/test-linear-integration.ts`:

       import { LinearClient } from "@linear/sdk";
       
       const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
       
       async function testIntegration() {
         // Create test issue
         const team = (await client.teams()).nodes[0];
         const issue = await client.createIssue({
           teamId: team.id,
           title: "Test Alfred Integration",
           description: "This is a test issue for Alfred",
         });
         
         console.log("Created issue:", issue.issue?.identifier);
         
         // Assign to Alfred
         // ... (find Alfred user ID and assign)
         
         // Wait and check for activities
         // ... (poll issue for activities)
       }
       
       testIntegration();

2. Run the test:

       bun run scripts/test-linear-integration.ts

3. Observe output and verify all expected activities appear.


## Idempotence and Recovery

**Idempotent operations:**

- All database updates use upsert semantics where possible
- Activity emissions can be retried without creating duplicates (Linear handles this)
- Workflow cancellation checks current status before updating

**Recovery procedures:**

If Linear helper implementation fails:
1. Revert `packages/agent/src/orchestrator/linear.ts` to stub implementation
2. Workflows will continue working without Linear integration
3. Fix the issue and redeploy

If webhook handler crashes:
1. Linear will retry webhooks with exponential backoff
2. Check logs for signature verification failures
3. Verify `LINEAR_WEBHOOK_SECRET` environment variable is correct
4. Restart the server

If metrics dependency creates circular import:
1. Move metrics to a separate `@alfred/linear-metrics` package
2. Or pass metrics as parameters to helper functions
3. Or use dynamic imports to break the cycle

**Safe rollback:**

To disable Linear integration without code changes:
1. Set environment variable `LINEAR_INTEGRATION_ENABLED=false`
2. Modify helper functions to check this flag and return early
3. Workflows continue without Linear activities

**Cleanup:**

After successful implementation:
1. Remove any test issues created in Linear
2. Clear `lastActivityTime` Map if memory usage is a concern (though it's small)
3. Archive ngrok tunnel if used for development


## Artifacts and Notes

**Expected log output on successful workflow start:**

    {
      "level": "info",
      "timestamp": "2025-01-15T10:23:45.123Z",
      "message": "workflow_started",
      "runId": "run_abc123",
      "linearSessionId": "session_xyz789"
    }
    {
      "level": "info",
      "timestamp": "2025-01-15T10:23:45.456Z",
      "message": "linear_thought_activity_succeeded",
      "runId": "run_abc123",
      "activityId": "activity_123"
    }
    {
      "level": "info",
      "timestamp": "2025-01-15T10:23:46.000Z",
      "message": "linear_delegate_setup_succeeded",
      "runId": "run_abc123"
    }

**Expected Linear UI after workflow completes:**

In Linear's issue view, the activity feed should show:

    [Thought] Starting workflow: Test Alfred Integration
    [Action] Executed tool: search_web
    [Action] Executed tool: create_note
    [Response] Workflow completed successfully. Created note with search results.

Each activity has a timestamp and is attributed to "Alfred (Bot)".

**Metrics snapshot after running 5 workflows:**

    # HELP linear_activity_emissions_total Total Linear agent activity emissions
    # TYPE linear_activity_emissions_total counter
    linear_activity_emissions_total{type="thought",status="success"} 5
    linear_activity_emissions_total{type="action",status="success"} 15
    linear_activity_emissions_total{type="response",status="success"} 4
    linear_activity_emissions_total{type="error",status="success"} 1
    
    # HELP linear_activity_duration_seconds Duration of Linear activity emissions
    # TYPE linear_activity_duration_seconds histogram
    linear_activity_duration_seconds_bucket{type="thought",le="0.05"} 3
    linear_activity_duration_seconds_bucket{type="thought",le="0.1"} 5
    linear_activity_duration_seconds_sum{type="thought"} 0.234
    linear_activity_duration_seconds_count{type="thought"} 5

**Troubleshooting common issues:**

1. **"linear_thought_activity_timeout" in logs**
   - Linear API is slow or unreachable
   - Check network connectivity
   - Verify OAuth token is valid
   - Consider increasing timeout (but keep under 10s total)

2. **"linear_installation_missing" error**
   - Linear workspace not configured in database
   - Run Linear OAuth flow to install app
   - Verify `linear_installations` table has entry for workspace

3. **Webhook signature verification fails**
   - Check `LINEAR_WEBHOOK_SECRET` matches Linear settings
   - Verify webhook payload is not modified by middleware
   - Ensure no body parser runs before signature verification

4. **Activities appear out of order in Linear**
   - This is normal due to async emission
   - Linear orders activities by creation time, not emission time
   - Consider adding sequence numbers to activity bodies if order matters


## Interfaces and Dependencies

**Key interfaces:**

In `packages/agent/src/orchestrator/linear.ts`:

    export type LinearActivityType = "thought" | "action" | "response" | "error";
    
    export type LinearActivityParams = {
      sessionId: string;
      space: string;
      authz: string;
      title?: string;
      body?: string;
      parameter?: string;
      result?: string;
      ephemeral?: boolean;
    };
    
    export type LinearSessionParams = {
      space: string;
      issueId: string;
      authz: string;
      delegateId?: string;
    };
    
    export async function emitLinearActivity(
      type: LinearActivityType,
      params: LinearActivityParams
    ): Promise<{ ok: boolean; id?: string }>;
    
    export async function setLinearDelegate(
      params: LinearSessionParams
    ): Promise<void>;
    
    export async function setLinearStarted(
      params: LinearSessionParams
    ): Promise<{ stateId: string }>;
    
    export async function setLinearSessionExternalUrl(
      sessionId: string,
      space: string,
      authz: string,
      url: string
    ): Promise<void>;
    
    export function extractIssueIdFromSession(sessionId: string): string | null;

**Database schema additions:**

Already exists in migration 0022:

    ALTER TABLE workflow_runs
      ADD COLUMN IF NOT EXISTS linear_session_id TEXT,
      ADD COLUMN IF NOT EXISTS linear_space TEXT;
    
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_linear_session
      ON workflow_runs(linear_session_id)
      WHERE linear_session_id IS NOT NULL;

**Repository interface additions:**

In `packages/db/src/repo/workflow.ts`:

    export async function findRunByLinearSession(
      sessionId: string
    ): Promise<WorkflowRun | null>;

**External dependencies:**

- `@linear/sdk` - Already installed, used by ticket tool
- `@linear/sdk/webhooks` - Webhook signature verification
- `p-retry` - Exponential backoff retry logic (need to install)

**Environment variables:**

- `LINEAR_WEBHOOK_SECRET` - Required for webhook signature verification
- `PUBLIC_URL` - Required for external URL generation (e.g., `https://alfred.example.com`)
- `LINEAR_INTEGRATION_ENABLED` - Optional flag to disable integration (defaults to true)

**Metrics exports:**

From `packages/api/src/metrics.ts`:

    export const linearActivityEmissionsTotal: Counter<"type" | "status">;
    export const linearActivityDurationSeconds: Histogram<"type">;
    export const linearSessionOperationsTotal: Counter<"operation">;
    export const linearWebhookEventsTotal: Counter<"event_type" | "action">;
    export const linearWebhookWorkflowStartsTotal: Counter;
    export const linearWebhookWorkflowCancelsTotal: Counter;


## Additional Implementation Notes

**Architecture decision: Why use toolTicket wrapper?**

We chose to implement Linear helper functions as wrappers around the existing `toolTicket` tool rather than calling the Linear SDK directly. This provides several benefits:

1. **Reuse existing logic**: The ticket tool already handles Linear client creation, error handling, and policy enforcement
2. **Consistent authentication**: Tool execution goes through the same auth checks as user-initiated tool calls
3. **Audit trail**: Tool calls are logged and can be traced through the system
4. **Testing**: We can mock toolTicket instead of mocking Linear SDK methods

The downside is an extra layer of indirection, but the benefits outweigh this cost.

**Why 9-second timeout instead of 10 seconds?**

Linear requires the first activity within 10 seconds. We use a 9-second timeout to leave a 1-second buffer for:
- Network latency
- Time spent in our code before starting the activity emission
- Clock skew between our server and Linear's servers

This ensures we reliably meet the deadline even under adverse conditions.

**Why throttle action activities to 30 seconds?**

Linear has two rate limiting concerns:
1. **API rate limits**: ~60 requests per minute across all operations
2. **UX concerns**: Too many activities clutter the Linear UI

By throttling to max 1 activity per 30 seconds and marking intermediate activities as ephemeral, we balance visibility with usability. Users see Alfred is working without being overwhelmed by minutiae.

**Why fire-and-forget for session initialization?**

Setting delegate, state, and external URL are not critical for workflow execution. If they fail, the workflow can still complete successfully. By making them fire-and-forget:
1. We don't block workflow execution waiting for Linear
2. We avoid cascading failures if Linear is slow
3. We maintain low latency for workflow start

The tradeoff is that session initialization might fail silently. We mitigate this by logging warnings so operators can detect and investigate failures.

**Alternative design: Separate Linear service**

An alternative architecture would be to create a separate `@alfred/linear` package that handles all Linear integration. Benefits:
- Clearer separation of concerns
- Easier to test in isolation
- Could be extracted as a reusable library

We didn't pursue this because:
- Current scale doesn't justify the complexity
- Tight coupling with workflow lifecycle makes separation awkward
- Single-user context means we don't need multi-tenant Linear handling

If Linear integration grows significantly, consider refactoring to a separate service.


## Summary

This ExecPlan provides step-by-step instructions to complete the Linear Agent Activities integration in ALFRED. The implementation enables ALFRED to function as a first-class Linear agent by:

1. Emitting real-time progress updates as agent activities
2. Automatically managing issue state and assignment
3. Responding to Linear webhooks for bidirectional integration
4. Maintaining resilience when Linear is unavailable

The work is organized into phases: helper functions, metrics, repository queries, workflow integration, webhook handling, and testing. Each step includes concrete code snippets, validation procedures, and expected outputs.

A developer following this plan should be able to implement the complete integration and demonstrate it working with a real Linear workspace. The implementation follows ALFRED's architectural principles: non-blocking operations, pure functions where possible, strong typing, and comprehensive error handling.

Key success metrics: sub-10-second acknowledgment, complete activity timeline in Linear UI, graceful degradation on Linear API failures, and comprehensive observability through Prometheus metrics.

