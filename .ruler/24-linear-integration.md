# Linear Integration

## Core Principle

Linear Agent Activities enable ALFRED to function as a first-class Linear agent by automatically emitting progress updates during workflow execution. Implementation complete in Phase 5.1.

## Rules

1. **Non-blocking activities.** All Linear activity emissions must be fire-and-forget operations wrapped in try-catch blocks. Activity failures must never break workflow execution. Log errors but continue processing.

2. **10-second acknowledgment.** The first `thought` activity MUST be emitted within 10 seconds of workflow start. Use `Promise.race` with a 9-second timeout to ensure deadline compliance.

3. **Retry logic.** All Linear API calls must use exponential backoff retry logic via `p-retry`. Retry on rate limit errors (429) and server errors (5xx). Do NOT retry permanent errors (4xx except 429).

4. **Session persistence.** Always persist `linearSessionId` and `linearSpace` in `workflow_runs` table when Linear context is provided.

5. **Error handling.** Linear API errors must be logged with structured logging, non-fatal (don't throw), tracked via metrics, and never expose internal details to Linear UI.

## Implementation Reference

- Linear helper module: `packages/agent/src/orchestrator/linear.ts`
- Workflow router integration: `packages/api/src/routers/workflow.ts`
- Webhook handler: `apps/web/src/routes/api/linear/webhook.ts`

See `docs/guides/linear-integration.md` for detailed implementation patterns and examples.
