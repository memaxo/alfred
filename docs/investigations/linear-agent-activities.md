# Linear Agent Activities Investigation

**Date:** 2025-11-09  
**Status:** Tools exist but not integrated into workflow execution  
**Impact:** Alfred is not a first-class Linear agent

---

## Executive Summary

Linear Agent Activities are partially implemented but not integrated into the workflow execution flow. The `ticket` tool supports all activity types (`activity.thought`, `activity.action`, `activity.response`, `activity.error`), but these are never automatically emitted during workflow execution. Additionally, the Linear integration lacks:

1. Automatic activity emission during workflow execution
2. Delegate management (setting Alfred as assignee)
3. Session state management (moving issues to "started")
4. runId → sessionId mapping persistence
5. Webhook subscriber for agent session events

---

## Current Implementation

### 1. Linear Activity Tools (✅ Exists)

**Location:** `packages/agent/src/orchestrator/tool/ticket.ts`

The `ticket` tool supports these activity types:

```typescript
action: z.enum([
  "create",
  "update", 
  "comment",
  "set-delegate",
  "set-started",
  "activity.thought",    // ✅ Implemented
  "activity.action",     // ✅ Implemented
  "activity.response",   // ✅ Implemented
  "activity.error",      // ✅ Implemented
  "session.external-url",
])
```

**Activity Implementation:**

```typescript
// activity.thought - Emit thinking activity
case "activity.thought":
  return runAgentActivity(client, input, {
    type: "thought",
    body: ensure(input.description, "ticket_activity_body_required"),
  });

// activity.action - Emit action activity with parameters/results
case "activity.action": {
  const content = {
    type: "action",
    title: ensure(input.title, "ticket_activity_title_required"),
    body: input.description ?? "",
    parameter: input.parameter,  // Optional tool input
    result: input.result,        // Optional tool output
  };
  return runAgentActivity(client, input, content);
}

// activity.response - Emit response activity
case "activity.response":
  return runAgentActivity(client, input, {
    type: "response",
    body: ensure(input.description, "ticket_activity_body_required"),
  });

// activity.error - Emit error activity
case "activity.error":
  return runAgentActivity(client, input, {
    type: "error",
    body: ensure(input.description, "ticket_activity_body_required"),
  });
```

**Core Implementation:**

```typescript
async function runAgentActivity(
  client: LinearClient,
  input: TicketInput,
  content: Record<string, unknown>
) {
  const sessionId = ensureSession(input);
  const payload = {
    agentSessionId: sessionId,
    content,
    ephemeral: input.ephemeral ?? undefined,
  };

  const response = await client.createAgentActivity(payload);
  const activity = await response.agentActivity;
  
  if (!(response.success && activity?.id)) {
    throw new Error("ticket_activity_failed");
  }

  return { ok: true, id: activity.id };
}
```

**Delegate Management:**

```typescript
case "set-delegate":
  return runDelegate(client, input, installation.appUser);

async function runDelegate(
  client: LinearClient,
  input: TicketInput,
  defaultDelegate: string
) {
  const issueId = ensure(input.issueId, "ticket_issue_required");
  const delegate = input.delegateId ?? defaultDelegate;

  const response = await client.updateIssue(issueId, {
    assigneeId: delegate,
  });

  return { ok: true, id: issueId };
}
```

**State Management:**

```typescript
case "set-started":
  return runSetStarted(client, input);

async function runSetStarted(client: LinearClient, input: TicketInput) {
  const issue = await client.issue(issueId);
  const team = await issue.team;
  const states = (await team.states()).nodes ?? [];

  const targetState =
    states.find((state) => state.type === "started") ??
    states.find((state) => state.name.toLowerCase().includes("progress"));

  const response = await client.updateIssue(issueId, {
    stateId: targetState.id,
  });

  return { ok: true, id: issueId, stateId: targetState.id };
}
```

### 2. Workflow Execution (❌ Not Integrated)

**Location:** `packages/api/src/workflow/runner.ts`

Current workflow execution (`runPlanV6`) does NOT emit Linear activities:

```typescript
export function runPlanV6(input: RunPlanInput, opts?: {...}): RunPlanV6 {
  async function* generator(): AsyncGenerator<WorkflowEvent, void, void> {
    yield createRunEvent(runId);
    yield createNoticeEvent(`Planning started for ${input.requirement}`);
    yield createProgressEvent(5, "initializing");

    // Context preparation
    yield createContextEvent("scan", "Scanning repository...");
    yield createProgressEvent(45, "context prepared");

    // Authorization check
    yield createRequireScopeEvent(["repo.write"], "bio-authz");

    yield createProgressEvent(100, "workflow_completed");
  }

  return { runId, summary, stream: generator(), resume, cancel };
}
```

**Missing:** No Linear activity emission during workflow execution.

### 3. Workflow Router (✅ Persistence, ❌ Activity Integration)

**Location:** `packages/api/src/routers/workflow.ts`

The workflow router handles:
- ✅ Durable run creation
- ✅ Event persistence
- ✅ Resume/cancel registration
- ❌ Linear activity emission
- ❌ Session mapping persistence

```typescript
// Current: Creates run, registers handlers, streams events
const runner = runPlanV6(input, { signal: abortController.signal });

await workflowRepo.createRun({
  id: runner.runId,
  userId: session.user.id,
  workflowId: "plan",
  status: "running",
  inputData: input,
});

await runRegistry.register(runner.runId, {
  resume: async ({ resumeData }) => await runner.resume(resumeData),
  cancel: async () => abortController.abort(),
  abortController,
});

// Stream events
for await (const event of runner.stream) {
  await workflowRepo.appendEvent({
    runId,
    eventType: getEventType(event),
    eventData: redactEventData(event),
  });
  push(event);
}
```

### 4. Webhook Handler (✅ Exists, ❌ Limited)

**Location:** `apps/web/src/routes/api/linear/webhook.ts`

Current webhook handler:
- ✅ Signature verification
- ✅ Token validation
- ✅ Resume workflow on `linear-authz` event
- ❌ No subscriber for agent session events
- ❌ No activity acknowledgment handling

```typescript
export const Route = createFileRoute("/api/linear/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify signature
        const validSignature = verifySignature(secret, header.timestamp, rawBody, header.signature);

        // Extract runId from agentSessionId
        const runId = payload?.data?.agentSessionId ?? crypto.randomUUID();

        // If authz token present, resume workflow
        const authz = extractAuthz(payload);
        if (authz) {
          await caller.workflow.resume({
            runId,
            event: "linear-authz",
            authz,
          });
        }

        return Response.json({ ok: true, runId, resumed: Boolean(authz) });
      }
    },
  },
});
```

---

## Missing Components

### 1. Automatic Activity Emission

**Location to add:** `packages/api/src/workflow/runner.ts`

Linear requires agent activities to be emitted during workflow execution:

- **`thought` activity** - Within 10s of workflow start (acknowledgment)
- **`action` activity** - For each tool call (with parameters/results)
- **`response` activity** - On workflow completion
- **`error` activity** - On workflow failure

**Expected flow:**

```typescript
async function* generator(): AsyncGenerator<WorkflowEvent, void, void> {
  yield createRunEvent(runId);
  
  // MISSING: Emit thought activity if Linear session
  if (input.linear?.sessionId) {
    await emitLinearActivity("thought", {
      sessionId: input.linear.sessionId,
      body: `Starting workflow: ${input.requirement}`,
    });
  }

  // Context preparation
  yield createProgressEvent(10, "analyzing requirement");

  // MISSING: Emit action activity for tool calls
  // For each tool execution...
  if (input.linear?.sessionId) {
    await emitLinearActivity("action", {
      sessionId: input.linear.sessionId,
      title: "Execute tool",
      parameter: JSON.stringify(toolInput),
      result: JSON.stringify(toolOutput),
    });
  }

  // MISSING: Emit response activity on completion
  if (input.linear?.sessionId) {
    await emitLinearActivity("response", {
      sessionId: input.linear.sessionId,
      body: "Workflow completed successfully",
    });
  }
}
```

### 2. Session Management Integration

**Location to add:** `packages/api/src/routers/workflow.ts`

When a workflow starts with Linear context:

1. **Set Alfred as delegate** - Assign the issue to Alfred's app user
2. **Move to "started" state** - Update issue state to "In Progress"
3. **Persist session mapping** - Store runId → sessionId for resume

```typescript
// In workflow.start mutation:
if (input.linear?.sessionId) {
  // Set delegate
  await ticketTool.execute({
    input: {
      space: input.linear.space,
      action: "set-delegate",
      issueId: extractIssueId(input.linear.sessionId),
      authz: input.authzLinear,
    },
  });

  // Set started state
  await ticketTool.execute({
    input: {
      space: input.linear.space,
      action: "set-started",
      issueId: extractIssueId(input.linear.sessionId),
      authz: input.authzLinear,
    },
  });

  // Persist session mapping
  await persistSessionMapping(runner.runId, input.linear.sessionId);
}
```

### 3. Session Mapping Persistence

**Location to add:** `packages/db/src/schema/linear.ts` or use existing graph memory

Two options for persisting runId → sessionId mapping:

**Option A: Add to workflow_runs table (Simple)**

```sql
ALTER TABLE workflow_runs
ADD COLUMN linear_session_id TEXT,
ADD COLUMN linear_space TEXT;

CREATE INDEX idx_workflow_runs_linear_session 
  ON workflow_runs(linear_session_id) 
  WHERE linear_session_id IS NOT NULL;
```

**Option B: Use graph memory (Flexible)**

```typescript
// Store as memory node + edge
await persistKnowledge("linear-workflow", [
  {
    data: { _: "node", kind: "workflow-run", label: runId, resource: runId },
  },
  {
    data: { _: "node", kind: "linear-session", label: sessionId, resource: sessionId },
  },
  {
    data: {
      _: "relation",
      kind: "maps-to",
      from: runId,
      to: sessionId,
      resource: "linear-workflow",
    },
  },
]);
```

**Recommendation:** Use workflow_runs table (Option A) for simplicity and queryability.

### 4. Webhook Subscriber for Agent Session Events

**Location to add:** `apps/web/src/routes/api/linear/webhook.ts`

Current webhook handler only supports `linear-authz` resume events. Need to handle:

- **Issue assigned to Alfred** - Start workflow
- **Issue commented** - Provide additional context
- **Issue state changed** - Handle cancellation
- **Issue closed** - Mark workflow completed

```typescript
// Enhanced webhook handler
const eventType = extractEventType(payload);

switch (eventType) {
  case "Issue": {
    const action = payload.action; // "create" | "update" | "remove"
    const issue = payload.data;

    // Check if Alfred is the assignee
    if (issue.assignee?.id === installation.appUser) {
      // Start workflow for this issue
      await startWorkflowForLinearIssue(issue);
    }

    // Check if issue was closed
    if (action === "update" && issue.state?.type === "completed") {
      // Cancel workflow if running
      await cancelWorkflowForLinearIssue(issue.id);
    }
    break;
  }

  case "Comment": {
    const comment = payload.data;
    const issueId = comment.issue?.id;

    // Find workflow by sessionId
    const workflow = await findWorkflowByLinearSession(issueId);
    if (workflow) {
      // Add comment as context to workflow
      await addContextToWorkflow(workflow.runId, comment.body);
    }
    break;
  }
}
```

### 5. Activity Emission Helper

**Location to add:** `packages/agent/src/orchestrator/linear.ts`

Create a helper for emitting Linear activities during workflow execution:

```typescript
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { linearRepo } from "@alfred/db";
import { LinearClient } from "@linear/sdk";

export async function emitLinearActivity(
  activityType: "thought" | "action" | "response" | "error",
  params: {
    sessionId: string;
    space: string;
    authz: string;
    title?: string;
    body?: string;
    parameter?: string;
    result?: string;
    ephemeral?: boolean;
  }
): Promise<{ ok: boolean; id?: string }> {
  // Validate authz
  await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
    action: `linear.activity.${activityType}`,
    resource: { kind: "linear", id: params.space },
  });

  // Get Linear client
  const installation = await linearRepo.getLinearByWorkspace(params.space);
  if (!installation) {
    throw new Error("linear_installation_missing");
  }

  const client = new LinearClient({ accessToken: installation.token });

  // Build content
  const content: Record<string, unknown> = { type: activityType };
  if (params.title) content.title = params.title;
  if (params.body) content.body = params.body;
  if (params.parameter) content.parameter = params.parameter;
  if (params.result) content.result = params.result;

  // Emit activity
  const payload = {
    agentSessionId: params.sessionId,
    content,
    ephemeral: params.ephemeral,
  };

  const response = await client.createAgentActivity(payload as any);
  const activity = await response.agentActivity;

  if (!(response.success && activity?.id)) {
    throw new Error("linear_activity_failed");
  }

  return { ok: true, id: activity.id };
}

export async function setLinearDelegate(params: {
  space: string;
  issueId: string;
  authz: string;
  delegateId?: string;
}): Promise<void> {
  await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
    action: "linear.set-delegate",
    resource: { kind: "linear", id: params.space },
  });

  const installation = await linearRepo.getLinearByWorkspace(params.space);
  if (!installation) {
    throw new Error("linear_installation_missing");
  }

  const client = new LinearClient({ accessToken: installation.token });
  const delegate = params.delegateId ?? installation.appUser;

  await client.updateIssue(params.issueId, { assigneeId: delegate });
}

export async function setLinearStarted(params: {
  space: string;
  issueId: string;
  authz: string;
}): Promise<{ stateId: string }> {
  await requireToolScopesAndPolicy(params.authz, ["linear.write"], {
    action: "linear.set-started",
    resource: { kind: "linear", id: params.space },
  });

  const installation = await linearRepo.getLinearByWorkspace(params.space);
  if (!installation) {
    throw new Error("linear_installation_missing");
  }

  const client = new LinearClient({ accessToken: installation.token });
  const issue = await client.issue(params.issueId);
  const team = await issue.team;
  const states = (await team.states()).nodes ?? [];

  const targetState =
    states.find((state) => state.type === "started") ??
    states.find((state) => state.name.toLowerCase().includes("progress"));

  if (!targetState) {
    throw new Error("linear_started_state_missing");
  }

  await client.updateIssue(params.issueId, { stateId: targetState.id });

  return { stateId: targetState.id };
}
```

---

## Integration Architecture

### Workflow Execution Flow (Proposed)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. User assigns Linear issue to Alfred                          │
│    OR User calls workflow.start with linear.sessionId           │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. Workflow starts (packages/api/src/routers/workflow.ts)       │
│    - Create durable run                                          │
│    - Set Alfred as delegate (if Linear context)                  │
│    - Move issue to "started" state                               │
│    - Persist runId → sessionId mapping                           │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. Runner emits events (packages/api/src/workflow/runner.ts)    │
│    - Emit "thought" activity (< 10s)                             │
│    - Emit "action" activity for tool calls                       │
│    - Emit "response" activity on completion                      │
│    - Emit "error" activity on failure                            │
└──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. Linear webhook handler                                        │
│    (apps/web/src/routes/api/linear/webhook.ts)                  │
│    - Receive webhook events                                      │
│    - Handle issue updates (comments, state changes)              │
│    - Resume workflow on authz events                             │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Linear Issue
    │
    ├─ sessionId ────────────────┐
    │                            │
    ▼                            ▼
Alfred Workflow              workflow_runs
    │                         ┌─────────────┐
    │                         │ runId       │
    │                         │ sessionId   │ (NEW column)
    │                         │ status      │
    │                         └─────────────┘
    │
    ├─ Emit activities ──────────────┐
    │                                 │
    │                                 ▼
    │                         Linear Activities
    │                         ┌──────────────────┐
    │                         │ thought          │
    │                         │ action           │
    │                         │ response         │
    │                         │ error            │
    │                         └──────────────────┘
    │
    ▼
Workflow completes
    │
    └─ Update issue state
       └─ Move to "Done" or "Cancelled"
```

---

## Implementation Plan

### Phase 1: Session Management (1-2 days)

1. **Add session mapping to workflow_runs table**
   - Migration: Add `linear_session_id` and `linear_space` columns
   - Update `workflowRepo.createRun` to accept Linear context
   - Add index on `linear_session_id`

2. **Integrate delegate/state management**
   - Create `packages/agent/src/orchestrator/linear.ts` with helpers
   - Update `workflow.start` mutation to call Linear helpers
   - Persist session mapping on workflow creation

**Estimated:** 1-2 days

### Phase 2: Activity Emission (2-3 days)

1. **Add activity emission to runner**
   - Update `runPlanV6` to accept Linear context
   - Emit `thought` activity within 10s of start
   - Emit `action` activity for tool calls (placeholder until real tools integrated)
   - Emit `response` activity on completion
   - Emit `error` activity on failure

2. **Handle activity errors gracefully**
   - Log activity failures but don't break workflow
   - Add metrics for activity emission success/failure

**Estimated:** 2-3 days

### Phase 3: Webhook Enhancement (1-2 days)

1. **Expand webhook handler**
   - Handle issue assignment events → start workflow
   - Handle comment events → add context to workflow
   - Handle state change events → cancel workflow if needed
   - Handle close events → mark workflow completed

2. **Add webhook metrics**
   - Track event types received
   - Track workflow starts/resumes from webhooks
   - Track errors by event type

**Estimated:** 1-2 days

### Phase 4: Testing & Validation (1 day)

1. **Integration tests**
   - Test workflow with Linear context
   - Test activity emission
   - Test webhook events
   - Test session mapping persistence

2. **Manual validation**
   - Create Linear issue
   - Assign to Alfred
   - Verify activities in Linear UI
   - Verify state transitions

**Estimated:** 1 day

**Total Estimated Time:** 5-8 days

---

## Testing Strategy

### Unit Tests

```typescript
// packages/agent/src/orchestrator/linear.test.ts
describe("Linear Activity Emission", () => {
  it("should emit thought activity", async () => {
    const result = await emitLinearActivity("thought", {
      sessionId: "test-session",
      space: "test-space",
      authz: "Bearer test-token",
      body: "Starting workflow",
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should emit action activity with parameters", async () => {
    const result = await emitLinearActivity("action", {
      sessionId: "test-session",
      space: "test-space",
      authz: "Bearer test-token",
      title: "Execute tool",
      parameter: '{"input": "test"}',
      result: '{"output": "success"}',
    });
    expect(result.ok).toBe(true);
  });
});

describe("Session Management", () => {
  it("should set Alfred as delegate", async () => {
    await setLinearDelegate({
      space: "test-space",
      issueId: "test-issue",
      authz: "Bearer test-token",
    });
    // Verify delegate set
  });

  it("should move issue to started state", async () => {
    const result = await setLinearStarted({
      space: "test-space",
      issueId: "test-issue",
      authz: "Bearer test-token",
    });
    expect(result.stateId).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// packages/api/test/workflow-linear.test.ts
describe("Workflow Linear Integration", () => {
  it("should create workflow with Linear context", async () => {
    const result = await caller.workflow.start({
      requirement: "Test workflow",
      auto: "low",
      linear: {
        space: "test-space",
        sessionId: "test-session",
      },
      authzLinear: "Bearer test-token",
    });

    expect(result.runId).toBeDefined();
    expect(result.ticketId).toBe("test-session");

    // Verify session mapping persisted
    const run = await workflowRepo.getRun(result.runId);
    expect(run.linearSessionId).toBe("test-session");
  });

  it("should emit activities during workflow execution", async () => {
    const activities: string[] = [];

    // Mock Linear client to track activities
    const mockEmit = vi.fn((type) => activities.push(type));

    // Start workflow with Linear context
    await caller.workflow.start({
      requirement: "Test workflow",
      linear: { space: "test", sessionId: "test" },
    });

    // Verify activities emitted in order
    expect(activities).toContain("thought");
    expect(activities).toContain("response");
  });
});
```

### Manual Testing Checklist

- [ ] Create Linear issue
- [ ] Assign issue to Alfred bot user
- [ ] Verify webhook received
- [ ] Verify workflow started
- [ ] Verify `thought` activity appears in Linear UI (< 10s)
- [ ] Verify issue moved to "In Progress" state
- [ ] Verify Alfred set as assignee
- [ ] Trigger tool execution
- [ ] Verify `action` activity appears with parameters/results
- [ ] Complete workflow
- [ ] Verify `response` activity appears
- [ ] Cause workflow error
- [ ] Verify `error` activity appears

---

## Metrics

### New Metrics to Add

```typescript
// packages/api/src/metrics.ts

// Linear activity emission
export const linearActivityEmissionsTotal = new client.Counter({
  name: "linear_activity_emissions_total",
  help: "Total Linear activity emissions",
  labelNames: ["type", "status"] as const,
  registers: [metricsRegistry],
});

// Linear activity duration
export const linearActivityDurationSeconds = new client.Histogram({
  name: "linear_activity_duration_seconds",
  help: "Linear activity emission duration",
  labelNames: ["type"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

// Session management
export const linearSessionOperationsTotal = new client.Counter({
  name: "linear_session_operations_total",
  help: "Linear session operations (delegate, state)",
  labelNames: ["operation", "status"] as const,
  registers: [metricsRegistry],
});
```

### Dashboard Queries

```promql
# Activity emission rate
rate(linear_activity_emissions_total[5m])

# Activity emission success rate
rate(linear_activity_emissions_total{status="ok"}[5m]) /
rate(linear_activity_emissions_total[5m])

# Activity emission latency (p99)
histogram_quantile(0.99, rate(linear_activity_duration_seconds_bucket[5m]))

# Session operation success rate
rate(linear_session_operations_total{status="ok"}[5m]) /
rate(linear_session_operations_total[5m])
```

---

## Security Considerations

1. **Token Validation:** All Linear operations must validate authz tokens via `requireToolScopesAndPolicy`
2. **Webhook Verification:** All webhook events must verify signature before processing
3. **Session Mapping:** Only persist session mappings for authenticated workflows
4. **Activity Content:** Redact PII/secrets before emitting activities
5. **Error Messages:** Don't expose internal state in Linear activities

---

## Performance Considerations

1. **Activity Emission:** Non-blocking - log errors but don't fail workflow
2. **Session Mapping:** Cache Linear installations to avoid repeated DB queries
3. **Webhook Processing:** Async - acknowledge immediately, process in background
4. **State Transitions:** Batch Linear API calls when possible
5. **Activity Frequency:** Throttle activities to avoid rate limits (Linear has rate limits)

---

## References

- **Linear SDK:** [@linear/sdk](https://github.com/linear/linear/tree/master/packages/sdk)
- **Linear Webhooks:** [Linear Developer Docs](https://developers.linear.app/docs/graphql/webhooks)
- **Agent Activities:** [Linear Agent Activities](https://linear.app/docs/api#agentactivity)
- **Workflow Patterns:** `.ruler/17-workflow-patterns.md`
- **Error Handling:** `.ruler/16-error-handling.md`
- **Observability:** `.ruler/18-observability.md`

---

## Decision Log

### Why not use tool calls directly?

**Decision:** Create dedicated `emitLinearActivity` helper instead of calling `toolTicket` directly.

**Reasoning:**
- Tool calls are synchronous and blocking
- Activities should be fire-and-forget (non-blocking)
- Helper provides better error handling and logging
- Easier to mock in tests

### Where to persist session mapping?

**Decision:** Add columns to `workflow_runs` table instead of graph memory.

**Reasoning:**
- Simpler queries (no join required)
- Better performance (indexed column)
- More explicit schema
- Easier to maintain

### When to emit activities?

**Decision:** Emit activities from runner, not from tool calls.

**Reasoning:**
- Runner has full context of workflow lifecycle
- Activities represent workflow state, not individual tool calls
- Easier to enforce timing constraints (< 10s for `thought`)
- Better separation of concerns

---

## Next Steps

1. Review this investigation with team
2. Create implementation tasks in Linear
3. Assign to developer
4. Schedule integration testing session
5. Update PRD when complete

---

**Investigation Status:** ✅ Complete  
**Ready for Implementation:** Yes  
**Estimated Effort:** 5-8 days  
**Priority:** Medium (required for first-class Linear agent)

