# Workflow Streaming Integration Tests

## Purpose

Workflow streaming now has two primary transports:

1. `/api/workflow/stream` – the SSE endpoint Mindscape uses.
2. `trpc.workflow.stream` – the legacy subscription path for other clients.

The new integration suite verifies that both transports exercise the real orchestrator, policy enforcement, and preference refresh logic without mocks. It also proves the shared `WorkflowTestHarness` can inject authenticated sessions in-process.

## Running Locally

From the repository root:

```
bun run test:workflow-integration
```

The script runs:

1. `packages/api/test/utils/workflow-server.test.ts` – harness sanity checks.
2. `packages/api/test/workflow.stream.integration.test.ts` – TRPC streaming scenarios.
3. `apps/web/src/routes/api/__tests__/workflow.stream.integration.test.ts` – SSE scenarios.

All tests run against the sqlite fallback (`DATABASE_URL=sqlite::memory:`) so no Postgres service is required.

## CI Integration

The root `ci` script now invokes `bun run test:workflow-integration` after the existing integration suite. Failing workflows immediately surface in CI when either transport regresses.

## Troubleshooting

- **`SQLITE_ERROR: no such table`**: Ensure the sqlite schema (`packages/db/src/sqlite/schema.ts`) matches the Postgres schema. The harness relies on workflow, audit log, and user feedback tables.
- **`Authentication required`**: The harness injects sessions via the `x-alfred-workflow-test-session` header. If you add new routes, make sure they read auth headers through `auth.api.getSession`.
