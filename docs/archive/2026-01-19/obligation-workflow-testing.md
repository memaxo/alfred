# Obligation Workflow Testing Guide

## Overview

Obligations are conditional requirements that must be satisfied before certain operations can proceed:

- **Biometric obligations**: Require recent biometric authentication (passkey/FaceID)
- **Human approval obligations**: Require manual approval from an admin
- **Custom obligations**: User-defined conditions that block operation

## Obligation Lifecycle

```
User Action → Policy Check → Obligation Detection → Obligation Blocked
                                                              ↓
User Action → Satisfy Obligation → Resume Original Operation
```

### Step by Step

1. **User initiates operation**
   - Example: User calls `workflow.stream()` with `auto: "medium"`

2. **Policy check runs**
   - System checks if user has required scopes
   - System evaluates if operation requires additional obligations

3. **Obligation detection**
   - For `auto: "medium"` or higher, biometric obligation may be required
   - For `action: "workflow.delete"`, admin approval may be required

4. **Obligation block**
   - Operation returns with obligation details
   - Event: `{ _: "obligation", obligations: [...] }`
   - Error: `TRPCError` with obligation metadata

5. **Obligation satisfaction**
   - Biometric: User performs biometric auth
   - Approval: Admin approves via `/api/obligations/:id/approve`
   - Custom: User satisfies defined condition

6. **Resume operation**
   - Original operation proceeds
   - Workflow continues from where it was blocked

## Database Schema

### `approvals` Table

Stores human approval obligations:

```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,           -- e.g., "workflow.delete"
  resource JSONB,                -- e.g., { "kind": "workflow", "id": "123" }
  trace_id TEXT NOT NULL,
  expires_at TIMESTAMP,
  status TEXT NOT NULL,           -- "pending" | "approved" | "denied" | "expired"
  approved_by TEXT,              -- who approved
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Important:** This table exists in PostgreSQL but **not in SQLite**. Tests requiring the `approvals` table must be skipped with `it.skipIf(isUsingSqlite)`.

## Testing Patterns

### Pattern 1: Test obligation event emission

```typescript
it("triggers biometric obligation in workflow", async () => {
  const harness = new WorkflowTestHarness({
    user: { id: "user", scopes: ["workflow.plan"] },
    obligations: [
      {
        type: "biometric",
        reason: "elevated_autonomy",
        metadata: { autonomy: "medium" },
      },
    ],
  });

  await harness.reset();
  const caller = await harness.createCaller();
  const events: WorkflowEvent[] = [];

  // Run workflow that triggers obligation
  await caller.stream({
    requirement: "Elevated task",
    auto: "medium",
    mode: "sequential",
  });

  // Verify obligation event was emitted
  const obligationEvents = events.filter((e) => e._ === "obligation");
  expect(obligationEvents.length).toBeGreaterThan(0);
});
```

### Pattern 2: Test approval flow creation

**Note:** Requires PostgreSQL (`RUN_DB_TESTS=1`)

```typescript
it.skipIf(!isUsingPostgres)(
  "stores approval request in database",
  async () => {
    const { createApproval, getPendingApprovals } =
      await import("@alfred/db/repo/policy");

    // Create an approval
    const approval = await createApproval({
      userId: "user-123",
      action: "workflow.delete",
      resource: { kind: "workflow", id: "123" },
      traceId: "test-trace",
      expiresAt: new Date(Date.now() + 300000), // 5 minutes
    });

    // Verify it was stored
    expect(approval.status).toBe("pending");
    expect(approval.id).toBeDefined();

    // Retrieve pending approvals
    const pending = await getPendingApprovals("user-123");
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending[0]?.id).toBe(approval.id);
  }
);
```

### Pattern 3: Test approval/deny actions

**Note:** Requires PostgreSQL (`RUN_DB_TESTS=1`)

```typescript
it.skipIf(!isUsingPostgres)(
  "approves pending request",
  async () => {
    const { createApproval, approveApproval } = await import("@alfred/db/repo/policy");

    // Create approval
    const approval = await createApproval({
      userId: "user-123",
      action: "workflow.delete",
      resource: { kind: "workflow", id: "123" },
      traceId: "approve-trace",
    });

    // Approve it
    const approved = await approveApproval(approval.id, "admin-456");
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe("admin-456");
  }
);
```

### Pattern 4: Test timeout handling

**Note:** Requires PostgreSQL (`RUN_DB_TESTS=1`)

```typescript
it.skipIf(!isUsingPostgres)(
  "expires obligations after timeout",
  async () => {
    const { createApproval, expireApprovals } = await import("@alfred/db/repo/policy");

    // Create approval that expires soon
    const approval = await createApproval({
      userId: "timeout-user",
      action: "workflow.delete",
      resource: { kind: "workflow", id: "123" },
      traceId: "timeout-trace",
      // Expired 1 second ago
      expiresAt: new Date(Date.now() - 1000),
    });

    // Run expiration worker
    const expired = await expireApprovals();

    // Verify approval was expired
    expect(expired.some((e) => e.id === approval.id)).toBe(true);

    // Check final status
    const { getApproval } = await import("@alfred/db/repo/policy");
    const retrieved = await getApproval(approval.id);
    expect(retrieved?.status).toBe("expired");
    expect(retrieved?.approvedBy).toBe("system");
  }
);
```

## Obligation Error Structure

When an obligation blocks an operation, the error includes:

```typescript
{
  code: "PRECONDITION_FAILED",
  message: "obligation_required",
  cause: {
    obligations: [
      {
        type: "biometric",
        reason: "elevated_autonomy",
        metadata: {
          autonomy: "medium",
          required: "passkey",
        },
      },
    ],
  },
}
```

Required fields for good error messages:
- **type**: The obligation type (`"biometric"`, `"human"`, custom)
- **reason**: Why the obligation exists
- **metadata**: Context about when/why needed
- **next_steps** (recommended): What user should do next

## Audit Logging

Every obligation action should be logged to `audit_logs`:

### Logged Events

1. **Obligation created**: When an obligation blocks an operation
2. **Obligation satisfied**: When user completes the requirement
3. **Obligation expired**: When timeout expires approval
4. **Approval created**: When approval request is stored
5. **Approved/Denied**: When admin approves or denies request

### Audit Log Example

```typescript
{
  userId: "user-123",
  policy: "workflow.obligation",
  decision: "deny", // "deny" because obligation not satisfied
  reason: "biometric_required",
  subject: JSON.stringify({
    id: "user-123",
    scopes: [" workflow.plan"],
  }),
  resource: JSON.stringify({
    kind: "workflow",
    workflowId: "test-workflow",
  }),
  context: JSON.stringify({
    obligations: [
      { type: "biometric", reason: "elevated_autonomy" },
    ],
  }),
}
```

## Current Limitations

1. **SQLite missing `approvals` table**
   - 25 tests skipped in Phase 3
   - Requires `RUN_DB_TESTS=1` to run full tests

2. **No obligation API endpoints**
   - Cannot test `/api/obligations/:id/approve` without implementation
   - Tests use direct repo calls instead

3. **No timeout enforcement worker**
   - Expiration logic must be tested manually
   - No background worker to auto-expire approvals

4. **Obligation event emission inconsistent**
   - Events may not be emitted in SQLite mode
   - Tests must handle both emission and non-emission scenarios

## Testing Checklist

When testing obligation workflows, verify:

- [ ] Obligation is detected correctly
- [ ] Error has proper structure (type, reason, metadata)
- [ ] Audit log is created
- [ ] Approval can be created (if human obligation)
- [ ] Approval can be approved/denied
- [ ] Approval expires after timeout
- [ ] Original operation resumes after satisfaction
- [ ] Operation still blocked if obligation not satisfied

## Future Improvements

1. **Implement obligation API endpoints**
   - `POST /api/obligations/:id/approve`
   - `POST /api/obligations/:id/deny`
   - `GET /api/obligations/pending`

2. **Implement timeout worker**
   - Background job to expire stale approvals
   - Configurable timeout intervals
   - Audit log entries for expiry events

3. **Improve event emission**
   - Consistent obligation event emission
   - Event includes obligation status history
   - Real-time updates via websockets

4. **Add SQLite `approvals` table**
   - Simplified schema for local testing
   - Mirrors Postgres behavior
   - Enables full local test coverage
