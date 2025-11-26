# Workflow API Reference

**Owner:** API  
**Last Updated:** 2025-11-26

## Purpose

This document provides a complete reference for ALFRED's workflow API, including endpoints, event types, schemas, suspend/resume patterns, and error handling.

## Base Path

All workflow endpoints are under the `workflow` tRPC router:

```typescript
trpc.workflow.start()
trpc.workflow.stream()
trpc.workflow.resume()
trpc.workflow.get()
trpc.workflow.events()
trpc.workflow.reasoning()
trpc.workflow.listRuns()
```

## Endpoints

### `workflow.start`

Creates a new workflow run and returns run metadata.

**Type:** `mutation`

**Input Schema:**
```typescript
{
  requirement: string;        // User requirement/request
  auto: "low" | "medium" | "high";  // Autonomy level
  mode?: "plan" | "execute"; // Execution mode
  cw?: string;                // Working directory
  linear?: {                  // Optional Linear context
    issueId?: string;
    space?: string;
  };
  authzLinear?: string;       // Linear authorization token
}
```

**Response:**
```typescript
{
  runId: string;              // Unique run identifier
  summary: string;            // Workflow summary
  results: unknown[];          // Empty initially
  plan: Plan | null;          // Execution plan (if generated)
  ticketId?: string;          // Linear issue ID (if created)
  ticketUrl?: string;         // Linear issue URL (if created)
}
```

**Authentication:** Required (authed procedure)

**Policy:** Requires `workflow.plan` permission

**Example:**
```typescript
const result = await trpc.workflow.start.mutate({
  requirement: "Deploy the latest changes to staging",
  auto: "medium",
  mode: "execute",
  cw: "/Users/jack/Development/project",
});
```

### `workflow.stream`

Subscribes to real-time workflow events via tRPC subscription.

**Type:** `subscription`

**Input Schema:** Same as `workflow.start`

**Event Types:** See [Event Types](#event-types) section

**Authentication:** Required (authed procedure)

**Policy:** Policy check performed before streaming starts

**Example:**
```typescript
trpc.workflow.stream.useSubscription(
  {
    requirement: "Deploy to staging",
    auto: "medium",
  },
  {
    onData: (event) => {
      console.log("Event:", event.type, event);
    },
    onError: (error) => {
      console.error("Error:", error);
    },
    onComplete: () => {
      console.log("Stream complete");
    },
  }
);
```

### `workflow.resume`

Resumes a suspended workflow with authorization event.

**Type:** `mutation`

**Input Schema:**
```typescript
{
  runId: string;              // Workflow run ID
  event: "deploy-authz" | "linear-authz" | "bio-authz" | "mfa-authz" | "human-authz";
  authz: string;             // Authorization token (elevated)
}
```

**Response:**
```typescript
{
  ok: boolean;
}
```

**Authentication:** Required (authed procedure)

**Error Codes:**
- `NOT_FOUND` - Run not found or not suspended

**Example:**
```typescript
await trpc.workflow.resume.mutate({
  runId: "run-123",
  event: "bio-authz",
  authz: "elevated-token-here",
});
```

### `workflow.get`

Retrieves workflow run metadata.

**Type:** `query`

**Input Schema:**
```typescript
{
  runId: string;
}
```

**Response:** Workflow run object with status, input, output, etc.

**Authentication:** Required (authed procedure)

**Error Codes:**
- `NOT_FOUND` - Run doesn't exist

### `workflow.events`

Retrieves all events for a workflow run.

**Type:** `query`

**Input Schema:**
```typescript
{
  runId: string;
}
```

**Response:** Array of `WorkflowEvent` objects

**Authentication:** Required (authed procedure)

**Use Case:** Replay workflow execution, debug issues, build UI visualizations

### `workflow.reasoning`

Retrieves reasoning traces for a workflow run.

**Type:** `query`

**Input Schema:**
```typescript
{
  runId: string;
  limit?: number;            // Max 2000, default: all
}
```

**Response:** Array of reasoning traces with text and timestamps

**Authentication:** Required (authed procedure)

**Policy:** Requires `workflow.read` permission

**Use Case:** Display reasoning chains in UI, debug decision-making

### `workflow.listRuns`

Lists workflow runs with filtering and pagination.

**Type:** `query`

**Input Schema:**
```typescript
{
  limit?: number;
  before?: string;           // Cursor for pagination
  status?: "running" | "completed" | "failed" | "suspended" | "cancelled";
}
```

**Response:** Paginated list of workflow runs

**Authentication:** Required (authed procedure)

## Event Types

Workflow events are discriminated unions with a `type` field:

### `progress`

Workflow progress update.

```typescript
{
  type: "progress";
  runId: string;
  pct?: number;             // 0-100
  message?: string;
}
```

### `stdout` / `stderr`

Tool output streams.

```typescript
{
  type: "stdout" | "stderr";
  runId: string;
  text: string;
}
```

### `droid`

Droid executor chunks.

```typescript
{
  type: "droid";
  runId: string;
  chunk: unknown;
}
```

### `notice`

Informational notices.

```typescript
{
  type: "notice";
  runId: string;
  message: string;
}
```

### `plan`

Execution plan generated.

```typescript
{
  type: "plan";
  runId: string;
  plan: Plan;               // Execution plan schema
}
```

### `obligation`

Workflow suspended, requires authorization.

```typescript
{
  type: "obligation";
  runId: string;
  obligations: Obligation[]; // Policy obligations
  resumeEvents: string[];    // Events to emit on resume
}
```

### `complete`

Workflow completed.

```typescript
{
  type: "complete";
  runId: string;
  status: "completed" | "failed" | "cancelled";
  results?: unknown[];
  error?: string;
}
```

## Suspend/Resume Pattern

### Suspension Flow

1. **Policy Check**: Workflow requires biometric elevation
2. **Suspension**: Workflow paused, `obligation` event emitted
3. **User Action**: User completes biometric challenge
4. **Resume**: Client calls `workflow.resume` with elevated token
5. **Continuation**: Workflow resumes from suspension point

### Implementation

**Server Side:**
- `createWorkflowSuspension` manages suspension state
- Run registered in `runRegistry` with resume handler
- Suspended runs stored in `workflow_runs` table with `status='suspended'`

**Client Side:**
- Listen for `obligation` events
- Show biometric challenge UI
- Call `workflow.resume` with elevated token on completion

**Example:**
```typescript
// Client listens for obligation events
trpc.workflow.stream.useSubscription(input, {
  onData: (event) => {
    if (event.type === "obligation") {
      // Show biometric challenge
      const token = await completeBiometricChallenge();
      // Resume workflow
      await trpc.workflow.resume.mutate({
        runId: event.runId,
        event: "bio-authz",
        authz: token,
      });
    }
  },
});
```

## Error Handling

### Error Types

**tRPC Errors:**
- `UNAUTHORIZED` - Session required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Run doesn't exist
- `PRECONDITION_FAILED` - Biometric required
- `INTERNAL_SERVER_ERROR` - Unexpected error

### Error Handling Pattern

```typescript
try {
  await trpc.workflow.start.mutate(input);
} catch (error) {
  if (error.data?.code === "PRECONDITION_FAILED") {
    // Handle biometric requirement
  } else if (error.data?.code === "FORBIDDEN") {
    // Handle permission denied
  } else {
    // Handle other errors
  }
}
```

### Stream Error Handling

```typescript
trpc.workflow.stream.useSubscription(input, {
  onError: (error) => {
    // Error emitted to stream
    // Stream may continue or terminate
    console.error("Workflow error:", error);
  },
});
```

## Timeouts

**Workflow Timeout:** 30 minutes (default)

**Per-Step Timeout:** Enforced by runtime and tools

**Timeout Handling:**
- Workflow marked as `failed`
- Error event emitted
- Resources cleaned up

## Linear Integration

### Automatic Ticket Creation

If `linear.issueId` not provided, workflow creates Linear issue automatically.

**Response Fields:**
- `ticketId` - Linear issue ID
- `ticketUrl` - Linear issue URL

### Agent Activities

Workflow emits Linear Agent Activities:
- `thought` - Workflow started (within 10 seconds)
- `action` - Tool executions (throttled)
- `response` - Completion summary
- `error` - Failure details

**See:** `docs/guides/linear-integration.md` for details

## Related Documentation

- [Workflow Patterns](../../.ruler/17-workflow-patterns.md) - Development patterns
- [Linear Integration](../guides/linear-integration.md) - Linear setup and usage
- [Troubleshooting](../guides/troubleshooting.md) - Common issues

