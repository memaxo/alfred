# ExecPlan: Memory Decay Configuration

## Purpose

Externalize the hardcoded parameters for the memory maintenance system (Learning Worker) to environment variables. This enables operational tuning of the "Forgetting Curve" without requiring code changes or deployments.

## Plan

- [ ] **Schema Definition**: Add the following environment variables to `packages/api/src/init.ts` (or central config schema):
  - `MEMORY_DECAY_ENABLED` (boolean, default true)
  - `MEMORY_DECAY_INTERVAL_MS` (number)
  - `MEMORY_DECAY_THRESHOLD_MS` (number)
  - `MEMORY_DECAY_FACTOR` (number, 0.0-1.0)
  - `MEMORY_PRUNE_CONFIDENCE` (number, 0.0-1.0)
  - `MEMORY_CLEANUP_AGE_MS` (number)
- [ ] **Env Example**: Update `config/env.example` with these new variables and documentation on their effects.
- [ ] **Worker Integration**: Update `packages/agent/src/orchestrator/learning-worker.ts` to initialize `DEFAULT_CONFIG` using these `process.env` values, falling back to safe defaults.
- [ ] **Documentation**: Update `docs/architecture/memory-system.md` (or create if missing) explaining the decay algorithm and how to tune these parameters.

## Progress

- [x] Schema Definition
- [x] Env Example
- [x] Worker Integration
- [x] Documentation

## Surprises & Discoveries

- `packages/api/src/init.ts` uses `ENABLE_LEARNING_WORKER` to toggle the whole worker. We added `decayEnabled` to `LearningWorkerConfig` to control the maintenance loop independently.
- `packages/db/src/repo/graph.ts` was recently refactored into a directory structure, requiring an update to the import path in `learning-worker.ts` to `@alfred/db/repo/graph/index` to resolve type definitions correctly.

## Decision Log

- Decided to interpret `MEMORY_DECAY_ENABLED` as a control for the _maintenance loop_ specifically, rather than the entire worker, to allow learning to continue even if decay is paused.
- Added `decayEnabled` to `LearningWorkerConfig`.

## Outcomes & Retrospective

- Configuration parameters are now externalized to `process.env` in `learning-worker.ts`.
- `config/env.example` is updated.
- `docs/architecture/memory-system.md` is created.
- Fixed a build/import issue related to the `db` package refactor.
