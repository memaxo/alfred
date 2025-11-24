# Runtime Multi-Agent Orchestration Autop Execution

This ExecPlan is a living document maintained under `.agent/PLANS.md`. Every section, especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`, must be updated as work advances.

## Purpose / Big Picture

Multi-agent workflows stall immediately after emitting ExecPlan skeletons because the runtime pipeline returns after the planning phase. Subtasks never launch Codex/Droid agents, so ExecPlans collect no progress and users must drive the work manually. This effort makes the runtime pipeline actually execute the decomposed subtasks end-to-end: fix the pipeline so scan → plan → act → report execute in sequence, materialize the ExecPlan files on disk, run Codex agents per subtask, and append progress/decision notes back into the ExecPlans automatically. After completion, a workflow directive should produce observable agent activity, write summaries to `.agent/plans/<runId>/*.md`, and push telemetry through the existing stream events.

## Progress

- [x] (2025-11-24 18:40Z) Audited runtime pipeline, multi-agent orchestrator, and ExecPlan helpers to identify where execution halts.
- [x] (2025-11-24 19:25Z) Implemented ordered phase advancement in `PipelineRunner` so scan → plan → act → report run sequentially.
- [x] (2025-11-24 19:55Z) Added ExecPlan section helpers and taught the planning phase to persist root/subtask skeletons onto disk.
- [x] (2025-11-24 20:25Z) Wired `runWaves` to feed Codex agents subtask requirements, update ExecPlan progress/decision logs, and emit wave-level status entries.
- [x] (2025-11-24 20:45Z) Extended pipeline + ExecPlan helper tests and ran `bun test packages/runtime/test/pipeline*.ts packages/agent/test/multi/execplan.test.ts`.

## Surprises & Discoveries

- None recorded yet.

## Decision Log

- Decision: Use the existing pipeline registration order (Scan → Plan → Act → Report) as the canonical sequence and advance to the next registered phase after each success.
  Rationale: Keeps the runner deterministic without introducing new configuration structures and immediately unlocks the act phase where agent spawning occurs.
  Date/Author: 2025-11-24 / Codex
- Decision: Persist the root and per-subtask ExecPlan files during the planning phase and expose pure helpers for updating their sections.
  Rationale: Ensures downstream agents always have concrete plan files to read/write and avoids duplicating Markdown-mutation logic across orchestrators.
  Date/Author: 2025-11-24 / Codex
- Decision: Emit automated Progress and Decision Log entries from `runWaves` whenever agents start, finish, escalate, or when waves abort.
  Rationale: Keeps ExecPlans truthful without relying on autonomous agents to remember bookkeeping, improving observability for humans resuming the workflow.
  Date/Author: 2025-11-24 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

The runtime interface exposed via `packages/runtime/src/workflow/orchestrator.ts` streams workflow events through `createWorkflowExecutor`. When `USE_WORKFLOW_RUNTIME` is true, the executor instantiates `WorkflowRuntime` (`packages/runtime/src/core.ts`) which chains `ScanPhase`, `PlanPhase`, `ActPhase`, and `ReportPhase` through `PipelineRunner` (`packages/runtime/src/pipeline/runner.ts`). The plan phase decomposes work via `decomposeTask` and emits ExecPlan skeleton metadata but never writes files. The act phase delegates to `runOrchestrator` (`packages/runtime/src/orchestrator/index.ts`), which should invoke `runWaves` (`packages/runtime/src/orchestrator/waves.ts`). That module already knows how to call `buildAgentSpec`, spin up worktrees/containers, and run Codex, but it only executes if the pipeline reaches the act phase. ExecPlan utilities live in `packages/agent/src/orchestrator/multi/execplan.ts`.

## Plan of Work

First, modify `PipelineRunner` so that a successful phase advances to the next registered phase instead of returning immediately; preserve escalation handling and keep a deterministic phase order list. Next, extend `packages/agent/src/orchestrator/multi/execplan.ts` with helpers that can append progress, surprises, and decision entries by replacing the relevant Markdown sections. Update the planning phase (`packages/runtime/src/phases/plan.ts`) to write the root ExecPlan plus every subtask skeleton to `.agent/plans/<runId>/` if they do not already exist. In the waves orchestrator, resolve absolute ExecPlan paths up front, feed each Codex agent both the requirement and ExecPlan location, and call the new helpers to record start/completion (and failure/escalation) updates for each subtask as well as aggregate entries for the root plan. Finish by adding or updating unit tests for the pipeline runner, the new ExecPlan helper utilities, and any orchestration behaviors that can be validated without spinning real agents.

## Concrete Steps

Work inside `/Users/jackmazac/Development/alfred`.

1. Implement the sequential phase advancement in `packages/runtime/src/pipeline/runner.ts` and add tests in `packages/runtime/test/pipeline.test.ts` (plus any new files needed).
2. Add section-update helpers in `packages/agent/src/orchestrator/multi/execplan.ts` with corresponding tests under `packages/agent/test/multi/execplan.test.ts`.
3. Teach `packages/runtime/src/phases/plan.ts` to persist ExecPlan skeletons onto disk and reuse the helper functions for future edits.
4. Enhance `packages/runtime/src/orchestrator/waves.ts` to call the helpers when agents start, complete, or escalate, ensuring each agent prompt includes the subtask requirement plus ExecPlan path.
5. Run the targeted tests via `bun test packages/runtime/test/pipeline.test.ts` and `bun test packages/agent/test/multi/execplan.test.ts`, then any additional suites touched by the edits.

## Validation and Acceptance

- With `USE_WORKFLOW_RUNTIME=true`, running a workflow should now yield wave/agent events after the initial ExecPlan notices, demonstrating that Codex agents execute automatically.
- The `.agent/plans/<runId>.root.md` file and each `.agent/plans/<runId>/<subtask>.md` file should exist with new progress entries indicating agent start/completion timestamps.
- `bun test packages/runtime/test/pipeline.test.ts` and `bun test packages/agent/test/multi/execplan.test.ts` must pass, confirming both the pipeline sequencing and ExecPlan helper logic.

## Idempotence and Recovery

Creating or updating ExecPlan files is idempotent because helpers append timestamped entries without deleting prior content; rerunning the workflow reuses the same files. The updated pipeline runner only mutates in-memory state. If an agent crashes, `runWaves` already restores the workspace checkpoint and will append a failure entry, so re-running the workflow simply adds another timestamped log for diagnostics.

## Artifacts and Notes

- Capture representative workflow stream excerpts (plan notices, wave start, wave result, execplan updates) after the implementation to help future engineers understand the expected event ordering.

## Interfaces and Dependencies

- `packages/runtime/src/pipeline/runner.ts`: add ordered phase tracking and helper methods to determine the next phase id after each success.
- `packages/agent/src/orchestrator/multi/execplan.ts`: provide pure text helpers (`updateExecPlanSection`, `appendPlanProgress`, `appendDecisionEntry`, etc.) that other packages can import.
- `packages/runtime/src/phases/plan.ts` and `packages/runtime/src/orchestrator/waves.ts`: orchestrate ExecPlan file I/O using the helpers and ensure each agent prompt includes its requirement along with the ExecPlan path.
