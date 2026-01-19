# Planner

A planner is an agent that breaks down tasks and spawns workers. Planners hold high-level context and make strategic decisions about how work should be divided and executed.

## Responsibilities

- Analyze task and identify subtasks
- Create execution plan
- Spawn workers for subtasks (or execute directly for simple tasks)
- Monitor worker completion via artifacts
- Handle worker failures (retry, reassign, abort)
- Decide when the overall task is complete

## Context

Planners hold broader context than workers but not the entire project. They read:

- **Task description** — What needs to be accomplished
- **Relevant artifacts** — Prior work, existing state
- **CATALOG.md** — What tools are available
- **Worker completion artifacts** — Status of spawned work

Planners don't hold:
- Full message history from all prior conversations
- Implementation details of worker execution
- Context from unrelated tasks

This scoping prevents drift and keeps planning focused.

## Model Selection

Planners benefit from reasoning models (GPT-5.2 class per Cursor's research). Why:

- Following complex instructions over long horizons
- Maintaining focus without shortcuts
- Evaluating multiple approaches
- Synthesizing information from multiple artifacts

Code generation speed matters less for planners—they produce plans, not implementations.

## Planner vs Orchestrator

ALFRED has both:

**Orchestrator** — Top-level coordinator receiving user intent. Decides whether to use assistant (conversational) or planner (task execution). Exists in `packages/agent/`.

**Planner** — Task decomposition agent. Receives a task from orchestrator, breaks it down, spawns workers. May be recursive (planners spawn sub-planners).

For MVP, the orchestrator often acts as a simple planner—directly decomposing and executing without separate planner agents. Full planner separation is a scale enhancement.

## Planning Output

A plan is a structured decomposition:

```
Task: Implement user authentication

Subtasks:
1. Add auth schema to database
2. Create auth API routes  
3. Add login UI component
4. Write auth tests

Dependencies:
- 2 depends on 1
- 3 depends on 2
- 4 depends on 1, 2, 3

Execution:
- Wave 1: [1]
- Wave 2: [2]
- Wave 3: [3, 4]
```

The plan persists as an artifact. Workers read their assigned subtask from the plan.

## Failure Handling

When a worker fails:

1. Worker writes failure artifact with reason
2. Planner reads failure artifact on next iteration
3. Planner decides:
   - Retry same worker with adjusted context
   - Reassign to different worker
   - Decompose subtask further
   - Abort and escalate to human

Planners don't receive real-time failure notifications. They read artifacts and reason about state.

## Anti-Patterns

**Over-planning.** Breaking tasks into too many tiny subtasks. Creates coordination overhead.

**Under-planning.** Assigning large, ambiguous tasks to workers. Workers get stuck.

**Holding too much context.** Trying to track all worker details. Causes drift.

**Micromanaging.** Re-planning on every worker update. Let workers complete.

## Related Concepts

- **worker** — Agents that execute planner-assigned tasks
- **judge** — Agents that evaluate outputs and prevent drift
- **hierarchy** — How planners fit in the agent structure
- **recursive-planning** — Planners spawning sub-planners
- **direction** — Top-down flow from planner to worker
