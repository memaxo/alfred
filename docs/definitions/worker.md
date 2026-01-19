# Worker

A worker is an agent that executes a single task to completion. Workers have isolated context and don't coordinate with other workers. They grind until done.

## Characteristics

- Receives single task from planner
- Works until task complete or definitively failed
- Does not see other workers' tasks
- Does not escalate to planner
- Writes artifact on completion
- Isolated context scope

## Context

Workers have minimal context by design:

**What workers receive:**
- Their specific task description
- Relevant files/artifacts for that task
- Tool catalog (CATALOG.md)
- Any context the planner explicitly includes

**What workers don't receive:**
- Knowledge of other workers
- Full project plan
- History of other tasks
- Planner's reasoning

This isolation is intentional. Workers don't need system-wide context—they need task-specific context. Less context means less drift, faster execution, and clearer focus.

## Execution Loop

```
while not (complete or failed):
    read task context
    attempt work
    if stuck:
        try alternative approach
    if progress:
        continue
    if exhausted:
        mark failed

write completion artifact
terminate
```

Workers don't yield back to planners mid-task. They complete or fail, then terminate.

## Failure Handling

When workers cannot complete:

1. Exhaust reasonable retries and approaches
2. Write failure artifact with:
   - What was attempted
   - Why it failed
   - What might help (if known)
3. Mark task as failed
4. Terminate

The planner handles retry/reassign decisions. Workers don't self-escalate.

## Model Selection

Workers can use faster/cheaper models than planners:

- Focus on code generation and execution
- Simpler decision making (execute task, not plan task)
- Shorter context windows (task-scoped)
- Higher parallelism (run many workers)

For code-heavy tasks, coding-optimized models work well. For research tasks, general reasoning models may still be better.

## Artifacts

Workers write completion artifacts:

```json
{
  "task": "Add auth schema",
  "status": "complete",
  "timestamp": "2026-01-19T12:00:00Z",
  "outputs": {
    "filesModified": ["packages/db/src/schema/auth.ts"],
    "migrationsCreated": ["0042_auth.sql"],
    "testsAdded": ["packages/db/test/auth.test.ts"]
  },
  "notes": "Used bcrypt for password hashing per security guidelines"
}
```

Planners and subsequent workers read these artifacts to understand state.

## Optimistic Concurrency

Multiple workers may modify overlapping files. ALFRED uses optimistic concurrency:

1. Workers proceed without coordination
2. Git detects conflicts on commit
3. Worker that commits second resolves merge
4. If resolution fails, worker writes failure artifact

This is more efficient than locking, per Cursor's research.

## Anti-Patterns

**Over-communicating.** Workers trying to coordinate with each other. Use artifacts, not messages.

**Escalating.** Workers asking planner what to do next. Complete or fail, don't ask.

**Scope creep.** Workers expanding beyond assigned task. Stay focused.

**Holding state.** Workers expecting to resume with prior context. Each invocation is fresh.

## Related Concepts

- **planner** — Agent that assigns tasks to workers
- **judge** — Agent that evaluates worker outputs
- **hierarchy** — Where workers fit in the structure
- **handoff** — How workers receive and return context
- **escalation** — Why workers don't escalate to planners
