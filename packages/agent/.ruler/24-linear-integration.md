# Linear Integration

## Core Principle

Linear Agent Activities enable ALFRED to function as a first-class Linear agent by automatically emitting progress updates during workflow execution. Implementation complete in Phase 5.1.

## Rules

1. **Non-blocking activities.** All Linear activity emissions must be fire-and-forget operations wrapped in try-catch blocks. Activity failures must never break workflow execution. Log errors but continue processing.

2. **10-second acknowledgment.** The first `thought` activity MUST be emitted within 10 seconds of workflow start. Use `Promise.race` with a 9-second timeout to ensure deadline compliance.

3. **Retry logic.** All Linear API calls must use exponential backoff retry logic via `p-retry`. Retry on rate limit errors (429) and server errors (5xx). Do NOT retry permanent errors (4xx except 429).

4. **Session persistence.** Always persist `linearSessionId` and `linearSpace` in `workflow_runs` table when Linear context is provided.

5. **Error handling.** Linear API errors must be logged with structured logging, non-fatal (don't throw), tracked via metrics, and never expose internal details to Linear UI.

6. **Subtask issue creation happens at execute-stage only.** Never create per-subtask Linear issues during plan preview; create them only once the run is executing (post-approval) so Linear stays aligned with “approved work”.

7. **Subtask issue prerequisites.** Per-subtask issue creation requires a Linear `teamId`. If missing, degrade to root-only sync.

8. **Dependency direction.** When a subtask lists `deps`, treat them as prerequisites: dependency issues **block** the dependent task issue.

9. **Pipeline observer config must include `space`.** Never infer Linear workspace from issue identifiers (e.g. `issueId.split("-")`); pass `space` explicitly.

10. **Cycles and sprint planning.** Use 2-week cycles for sprint planning. Assign high-priority issues to current cycle. Track velocity via cycle completion rate.

11. **Issue estimates.** Add story point estimates to all issues. Use Fibonacci scale (1, 2, 3, 5, 8, 13). Most features: 2-5 points (30-90 minutes per agent cycle, 1-3 cycles per feature). Complex features: 8 points. Use estimates for capacity planning.

12. **Dependency tracking.** Use "blocks" relations for dependent issues (e.g., ALF-128 blocks ALF-126). Use "relates to" for contextual links. Link dependencies before starting work to prevent blocked progress.

13. **Issue assignment.** Assign issues to team members for clear ownership. Use assignees for workload visibility and filtering.

14. **Due dates.** Set due dates for urgent/high-priority issues. Align with cycle end dates for sprint work.

## Implementation Reference

- Linear helper module: `packages/agent/src/orchestrator/linear.ts`
- Workflow router integration: `packages/api/src/routers/workflow.ts`
- Webhook handler: `apps/web/src/routes/api/linear/webhook.ts`

See `docs/guides/linear-integration.md` for detailed implementation patterns and examples.
