# Sequential Pattern

The sequential pattern executes steps in linear order, where each step's output feeds into the next step's input. This is ALFRED's default execution pattern for MVP.

## Characteristics

- Steps execute one at a time
- Each step completes before the next begins
- Output from step N becomes available (as artifact) to step N+1
- Failure in any step halts the sequence (or triggers retry)
- Simple to reason about and debug

## Diagram

```
[Step A] → artifact → [Step B] → artifact → [Step C] → result
```

Each arrow represents artifact-based handoff. Step B reads Step A's artifact, does work, writes its own artifact.

## When to Use

**Tasks with strict dependencies.** Step B genuinely cannot start until Step A completes. Example: parse file, then analyze parsed output.

**Workflows where order matters.** Side effects must happen in sequence. Example: create branch, commit changes, push.

**Debugging and development.** Sequential is easier to trace than parallel. Start sequential, parallelize later if needed.

**Single-agent execution.** When only one agent runs at a time, sequential is natural.

## Trade-offs

**Latency.** Total time = sum of step times. No opportunity for parallelism.

**Simplicity.** One execution path. One failure mode. Easy to understand.

**Debugging.** Can inspect state between steps. Can re-run from any step.

## Implementation

The pipeline in `packages/pipeline/` uses sequential execution by default:

```
discover → plan → schedule → execute → verify
```

Each stage completes before the next starts. Stage outputs persist as artifacts and context entries.

## Contrast with Planned Wave

Sequential:
```
A → B → C → D
```

Planned Wave:
```
[A, B] → [C, D]
```

Planned wave groups independent steps into parallel batches. Still sequential between batches, but parallel within.

ALFRED MVP uses sequential. Planned wave is a future enhancement when parallelism provides clear benefit.

## Related Concepts

- **planned-wave** — Parallel execution of independent steps
- **recursive-planning** — Planners spawning sub-planners
- **handoff** — How context transfers between steps
- **direction** — Sequential implies top-down flow
