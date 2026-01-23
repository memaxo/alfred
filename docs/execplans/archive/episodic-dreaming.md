# ExecPlan: Episodic Dreaming (Offline Learning)

**Status**: Deprecated (removed)
**Goal**: (Removed) Synthesize heuristic “intuitions” from past failures during idle time.

## Core Concept
This subsystem was implemented experimentally and later removed because it introduced naive clustering + heuristic generation surface area that did not meet the repo’s “lean + embedding-centric” bar.

## Outcome

- The Dreaming worker (`processDreaming`) and the `heuristic` node plumbing were removed.
- Documentation kept as a historical record of the experiment; do not reintroduce without an embedding-first design and clear operational value.
