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
4. `tests/perf/workflow-stream-latency.test.ts` – deterministic latency measurements for both transports (<100 ms budget).

All tests run against the sqlite fallback (`DATABASE_URL=sqlite::memory:`) so no Postgres service is required.

## CI Integration

The root `ci` script now invokes `bun run test:workflow-integration` after the existing integration suite. Failing workflows immediately surface in CI when either transport regresses.

### Latency Verification Modes

- **Default (mocked) mode**: `bun test tests/perf/workflow-stream-latency.test.ts` keeps the orchestrator mocked so latency noise stays under 10 ms in CI. This is the mode wired into `test:workflow-integration`.
- **Real staging mode**: `bun run test:workflow-latency:real` (sets `WORKFLOW_LATENCY_MODE=real`) disables the mocks, so the harness talks to the real orchestrator, DB, and SSE/TRPC surfaces. Run this inside staging with production-like env vars (`DATABASE_URL`, `OPENAI_API_KEY`, etc.) to capture the numbers we publish before launch.

The test logs both SSE and TRPC latencies (`[latency] transport=... first_event_ms=...`). Keep a short history of these values in the ExecPlan or release notes so regressions are obvious.

## Policy & Rate-Limit Enforcement

Both transports **must** call `enforceWorkflowPlanPolicy` from `@alfred/api/workflow/access` before invoking `orchestrateWorkflowStream`. The helper:

1. Consumes the shared route rate limit bucket via `consumeRouteRateLimit`.
2. Evaluates the `workflow.plan` policy and records an audit log.
3. Returns any obligations (e.g., `requireBio`) that the transport must pass through `callbacks.context.policy.obligations` so `ensureObligations` can enforce biometric escalation inside the orchestrator.

When obligations exist, the transports invoke the shared `createWorkflowSuspension` helper. It persists the suspended run, emits a `workflow-event` payload shaped like `{ type: "obligation", runId, obligations, resumeEvents }`, and registers the run with `runRegistry`. Mindscape pauses the stream, surfaces the enriched dialog (`reason`, `metadata`, `resumeEvents`), and resumes the run by calling `workflow.resume` with whichever event (`bio-authz`, `mfa-authz`, `human-authz`) the helper advertised after the client satisfies the obligation.

New transports (CLI, mobile, etc.) should import the same helper rather than re-implementing rate-limit or policy logic. This keeps TRPC, SSE, and future flows perfectly aligned.

## Troubleshooting

- **`SQLITE_ERROR: no such table`**: Ensure the sqlite schema (`packages/db/src/sqlite/schema.ts`) matches the Postgres schema. The harness relies on workflow, audit log, and user feedback tables.
- **`Authentication required`**: The harness injects sessions via the `x-alfred-workflow-test-session` header. If you add new routes, make sure they read auth headers through `auth.api.getSession`.
