# Workflow Patterns

## Core Principle

Workflows are durable, resumable, and observable. Every workflow run persists state before execution, records events during execution, and handles failures gracefully.

## Rules

1. **Durable run creation.** Create the run row before starting execution:
   ```typescript
   // ✅ Create run first
   const runner = runPlanV6(input, { signal });
   await workflowRepo.createRun({
     id: runner.runId,
     userId: session.user.id,
     workflowId: "plan",
     status: "running",
     inputData: input,
   });
   ```

2. **Event persistence.** Persist every event immediately:
   ```typescript
   for await (const event of runner.stream) {
     await workflowRepo.appendEvent({
       runId,
       eventType: event.type ?? "event",
       eventData: event,
     });
     emit.next(event); // Then push to client
   }
   ```

3. **State transitions.** Update run status explicitly:
   ```typescript
   // On completion
   await workflowRepo.updateRun(runId, {
     status: "completed",
     completedAt: new Date(),
   });
   
   // On failure
   await workflowRepo.updateRun(runId, {
     status: "failed",
     errorMessage: error.message,
   });
   ```

4. **Resume patterns.** Register run handles before execution:
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

5. **Cancellation.** Always support cancellation via AbortSignal:
   ```typescript
   const abortController = new AbortController();
   const runner = runPlanV6(input, { signal: abortController.signal });
   
   return () => {
     abortController.abort();
     runRegistry.unregister(runId);
   };
   ```

6. **Error recovery.** Mark workflows as failed on error:
   ```typescript
   try {
     await executeWorkflow();
     await workflowRepo.updateRun(runId, { status: "completed" });
   } catch (error) {
     await workflowRepo.updateRun(runId, {
       status: "failed",
       errorMessage: error.message,
     });
     throw error;
   }
   ```

7. **Timeout enforcement.** Enforce timeouts at workflow level:
   ```typescript
   const timeout = setTimeout(() => {
     abortController.abort();
     workflowRepo.updateRun(runId, { status: "failed", errorMessage: "timeout" });
   }, WORKFLOW_TIMEOUT_MS);
   ```

8. **Event replay.** Events must be replayable. Store full event data, not summaries.

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

## Examples

```typescript
// ✅ Complete workflow pattern
export async function startWorkflow(input: WorkflowInput) {
  const abortController = new AbortController();
  const runner = runPlanV6(input, { signal: abortController.signal });
  
  // Create durable run
  await workflowRepo.createRun({
    id: runner.runId,
    userId: session.user.id,
    workflowId: "plan",
    status: "running",
    inputData: input,
  });
  
  // Register for resume
  await runRegistry.register(runId, {
    resume: async ({ resumeData }) => await runner.resume(resumeData),
    cancel: async () => abortController.abort(),
    abortController,
  });
  
  // Execute and persist events
  try {
    for await (const event of runner.stream) {
      await workflowRepo.appendEvent({ runId, eventData: event });
      emit.next(event);
    }
    await workflowRepo.updateRun(runId, { status: "completed" });
  } catch (error) {
    await workflowRepo.updateRun(runId, {
      status: "failed",
      errorMessage: error.message,
    });
    throw error;
  } finally {
    await runRegistry.unregister(runId);
  }
}
```

