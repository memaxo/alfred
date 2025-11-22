# Dynamic Re-planning (File-Based)

This ExecPlan outlines Phase 8 of the Comprehensive Engineering Upgrade: Dynamic Re-planning using a simple file-based signaling mechanism.

## Purpose

Agents may encounter blockers that require a change in strategy (e.g., "API key missing", "Dependency conflict", "Architecture flaw"). Instead of complex bidirectional protocols, we use a simple file drop pattern. If an agent gets stuck, it writes an `ESCALATION.md` file and exits. The orchestrator detects this, pauses, and triggers a re-planning step.

## Architecture

1.  **Signal**: Agent writes `ESCALATION.md` to its working directory and exits with code 0 (or 1).
2.  **Detection**: `waves.ts` checks for `ESCALATION.md` after every agent execution.
3.  **Reaction**:
    - If found, the orchestrator reads the file.
    - It invokes the **Planner** (Semantic Decomposer) with the original requirement + the escalation context.
    - The Planner generates a *new* set of subtasks for the remaining work.
    - The Orchestrator replaces the pending waves with the new plan and resumes.

## Progress

- [x] **Phase 1: Signal Detection**
  - [x] Update `AgentSpec` prompt to include instruction: "If blocked, write `ESCALATION.md` and exit."
  - [x] Update `runWaves` to check for `ESCALATION.md` existence.
  - [x] Add `escalated` state to `WavesResult`.
- [x] **Phase 2: Re-planning Loop**
  - [x] Refactor `runWaves` to support "Plan Injection".
  - [x] If escalation detected:
    - [x] Call `decomposeTask` with `{ requirement, escalationContext }`.
    - [x] Re-run `planWaves` with new tasks.
    - [x] Splice new waves into the execution queue.
    - *Note*: Implemented via `PipelineRunner` escalation to `PlanPhase`, which effectively restarts planning with context.

## Simplicity Analysis

- **No new tools**: Uses standard filesystem I/O.
- **No new protocols**: Uses existing `decompose` and `plan` logic.
- **Observable**: The `ESCALATION.md` file is a tangible artifact that can be inspected by humans.
- **Idempotent**: If the process crashes during replanning, the `ESCALATION.md` file remains, allowing recovery.

## Verification

1.  **Scenario**: Agent fails to find a file and writes `ESCALATION.md`.
2.  **Result**: Orchestrator logs "Escalation detected", generates a new task "Create missing file", executes it, then retries the original task.
