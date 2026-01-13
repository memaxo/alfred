# Pipeline Package Boundaries

## Core Principle

The pipeline is a stage orchestrator, not a workflow system. It sequences stages, emits events, and provides observers. Everything else belongs elsewhere.

## Pipeline Scope

1. **Pipeline IN SCOPE.** Stage registration, stage execution with timeouts, event emission via `ctx.emit()`, observer pattern, typed stage boundaries, context key-value storage, AbortSignal propagation, stage-level error handling.

2. **Pipeline OUT OF SCOPE.** Database persistence (use observers), Linear/GitHub integration (use observers), UI/presentation (use apps), agent implementation details (use `@alfred/agent`), authentication (use `@alfred/auth`), HTTP routing (use `@alfred/api`), metrics collection (use observers), project detection (use `@alfred/plan`), task decomposition (use `@alfred/plan`).

## Import Rules

3. **Pipeline never imports `@alfred/db`.** Persistence is a side effect handled by observers, not orchestration logic.

4. **Pipeline never imports `@alfred/api`.** API imports pipeline, not vice versa. Transport layer sits above orchestration.

5. **Pipeline may import `@alfred/agent`.** Agent utilities (stuck detection, escalation, workspace) are legitimate dependencies for the execute stage.

6. **Pipeline may import `@alfred/plan`.** Planning utilities (decomposition, wave planning) are legitimate dependencies for plan/schedule stages.

7. **Stages import domain packages.** Stages are thin wrappers that delegate to domain packages. Import the canonical implementation, don't duplicate.

## Extension Rules

8. **Extend via observers only.** New cross-cutting capabilities (persistence, integrations, metrics) must be implemented as observers. Never add callbacks to `PipelineRunner`.

9. **No new callbacks.** Adding a callback to `PipelineRunner` or `PipelineContext` is forbidden. Use events and observers.

10. **Stages stay thin.** Each stage should be <200 lines. If a stage grows beyond this, extract domain logic to the appropriate package.

## Resume/Checkpoint Rules

11. **Context must be serializable.** Everything stored via `ctx.set()` must be JSON-serializable. Store IDs and keys, not object instances.

12. **Events enable reconstruction.** The event stream must contain enough information to reconstruct pipeline state at any stage boundary.

13. **Checkpoint after stages.** Use `CheckpointObserver` to persist state after each stage for resume capability.

## Event Rules

14. **Events are typed.** Every event has a `type` discriminant. Add new types to `PipelineEvent` union with JSDoc.

15. **Events are immutable.** Never mutate an event after emission. Create new events for state changes.

16. **Events are the API.** External systems (UI, persistence, integrations) consume events via observers. They never call stage methods directly.

## Adjacent Package Responsibilities

17. **`@alfred/agent` owns agents.** Executor implementations (codex, opencode, droid), workspace management, session lifecycle, escalation detection, stuck detection.

18. **`@alfred/plan` owns planning.** Project detection, task decomposition, wave planning, ExecPlan generation, dependency analysis.

19. **`@alfred/db` owns persistence.** Schema definitions, migrations, repository functions. Called by observers, never by pipeline core.

20. **`@alfred/api` owns transport.** tRPC routers, HTTP endpoints, request validation, authentication checks. Imports pipeline to expose as API.

## Anti-Pattern Recognition

21. **God stage.** A stage that does orchestration AND persistence AND integration. Fix: Extract to observers.

22. **Callback accumulation.** Adding callbacks to PipelineRunner/Context interfaces. Fix: Use observer pattern.

23. **Domain logic in stages.** Stages implementing business logic instead of delegating. Fix: Move to domain package, import.

24. **Direct DB calls in stages.** Stage calling repository functions directly. Fix: Use observer for persistence.

25. **Non-serializable context.** Storing class instances or functions in context. Fix: Store serializable data only.
