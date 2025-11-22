# Workflow Patterns

## Core Principle

Workflows are durable, resumable, and observable. Follow existing patterns in `packages/api/src/routers/workflow.ts` and `packages/runtime/`.

## Rules

1. **Suspend/resume for obligations.** Implement workflow suspension when PDP returns `requireBio` obligation:
   ```typescript
   await runRegistry.register(runId, {
     resume: async ({ resumeData }) => {
       await runner.resume(resumeData);
     },
     cancel: async () => {
       abortController.abort();
     },
     abortController,
   });
   ```

2. **Timeout enforcement.** Enforce timeouts at workflow level (default: 30 minutes):
   ```typescript
   const timeout = setTimeout(() => {
     abortController.abort();
     workflowRepo.updateRun(runId, { status: "failed", errorMessage: "timeout" });
   }, WORKFLOW_TIMEOUT_MS);
   ```

3. **Cancellation support.** Always propagate AbortSignal through async chains and clean up in finally blocks.

5. **Event replay.** Expose a `replay` procedure for event-sourced entities that allows clients to hydrate state deterministically by fetching raw events in chronological order.

6. **Resilience & DLQ.** Persistent workflows must implement Dead Letter Queues (max retry limits) to prevent infinite resume loops.

## Workflow Status Lifecycle

```
running → completed
running → failed
running → suspended → resumed → completed
running → cancelled
```

## Performance Budgets

- Run creation: <10ms
- Event persistence: <5ms per event
- Status update: <5ms
- Resume dispatch: <50ms

See `packages/api/src/routers/workflow.ts` for implementation reference.
