# Communication Direction

Communication direction describes how information flows between agents in a hierarchy. ALFRED adopts a top-down model with artifact-based handoff.

## Top-Down

Information flows from planner to workers. Planners analyze tasks, create plans, and assign work. Workers receive assignments, execute, and write artifacts. Workers do not send information back to planners except via completion status and artifacts.

ALFRED uses top-down direction for its rigid planning model. This simplifies the architecture:

- Workers don't need to understand the planner's context
- No escalation logic or decision routing
- Clear responsibility boundaries
- Predictable execution flow

## Bottom-Up

Workers can escalate to planners. Information flows upward when workers encounter blockers, ambiguity, or need decisions they cannot make.

ALFRED does not use bottom-up escalation in MVP. The rationale:

- Escalation creates complexity and coordination overhead
- Forces clear task decomposition upfront
- Workers that can't complete write failure artifacts instead
- Planner reads failure artifacts and decides retry strategy

## Horizontal

Workers coordinate directly with other workers. Used for conflict resolution without planner involvement.

ALFRED uses optimistic concurrency rather than explicit horizontal coordination. If two workers modify the same file:

1. Both proceed without knowledge of the other
2. Git detects the conflict
3. The worker that commits second resolves the merge

This aligns with Cursor's finding that "allowing agents to work optimistically and resolve conflicts later was far more efficient" than strict locking.

## Mixed

A combination of directions. Cursor's research found that mixed approaches—hierarchy for planning, horizontal for conflicts—were most effective at scale.

ALFRED's hybrid approach:

- Top-down for task assignment (planner → worker)
- Artifact-based for results (worker → artifacts → planner reads)
- Optimistic concurrency for conflicts (workers resolve independently)
- Human escalation only (planner → human approval gates)

## Why Top-Down?

1. **Simplicity.** One direction is easier to reason about than many.
2. **Isolation.** Workers don't need to understand system state beyond their task.
3. **Predictability.** Execution flow is deterministic given a plan.
4. **Debugging.** Failures localize to specific workers without cascading.

The cost is flexibility—workers can't adapt plans dynamically. ALFRED accepts this tradeoff for MVP, with the expectation that recursive planning (planners spawning sub-planners) will provide flexibility at scale.

## Implementation

Top-down direction manifests in:

- `packages/pipeline/` — Stages execute sequentially, each receiving prior stage output
- Agent spawning — Orchestrator spawns workers with specific task context
- Artifact handoff — Workers write to `.agent/tools/`, subsequent stages read

No code exists for bottom-up escalation or horizontal coordination. These are future enhancements if needed.

## Related Concepts

- **hierarchy** — The roles (planner, worker, judge) in ALFRED's agent system
- **escalation** — Why ALFRED doesn't use worker → planner escalation
- **handoff** — How artifacts enable asynchronous information flow
- **planner** — The role that assigns work in top-down flow
- **worker** — The role that receives and executes assignments
