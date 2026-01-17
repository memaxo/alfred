# Workflow Patterns

## Rules

1. **Durable + observable.** Workflows must be resumable and event-sourced; UIs hydrate from ordered event streams.
2. **Suspend on obligations.** If PDP returns a biometric obligation, suspend and register resumable callbacks with the run registry.
3. **Timeout + cancel.** Enforce a workflow-level timeout, propagate `AbortSignal`, and always cleanup in `finally`.
4. **Resilience.** Cap retries (DLQ) to prevent infinite resume loops.
5. **Test via fixture.** Runtime tests must use `@alfred/test-kit/workflow/runtime-fixture` (don’t inline-mock runtime/metrics/Linear).
