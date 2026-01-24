# Full Pipeline Test Coverage Report

## Findings

### 1. Verification Script (`scripts/verify-orchestrator.ts`)

- **Coverage**: High-level smoke test.
- **Flow**:
  - Issues a real token (mocked auth).
  - Creates a runtime with `auto: "high"`.
  - Uses a **Mock Model** that returns a hardcoded plan to create a file.
  - Verifies the file is created on disk.
- **Missing**:
  - Does **NOT** use the real Cortex/Cognitive loop logic (it drives the stream manually via the mock model).
  - Does **NOT** trigger Physiology, Arbiter, or Entropy logic because the mock model generates a "happy path" directly.
  - Does **NOT** use Git Worktrees (it runs in `process.cwd()`).

### 2. Learning Worker Integration (`packages/agent/test/learning-worker.integration.test.ts`)

- **Coverage**: Learning & Dreaming subsystems.
- **Flow**:
  - Mocks DB, Graph, and RAG.
  - Verifies `startLearningWorker` picks up runs and triggers maintenance/dreaming.
- **Missing**: Real DB interaction (uses mocks).

### 3. Unit/Component Tests

- `packages/agent/test/conflict.test.ts`: Covers Arbiter logic (isolated).
- `packages/agent/test/supervisor.test.ts`: Covers Entropy/Heartbeat (isolated).
- `packages/cognitive/test/physiology.test.ts`: Covers Physiology math (isolated).

### 4. Gap Analysis

There is **NO** automated test that exercises the full pipeline:
`Input -> Orchestrator -> Waves -> Worktree -> Droid/Codex -> Execution -> Physiology Update -> Output`.

The closest is `verify-orchestrator.ts`, but it mocks the most critical part (the Agent's brain) and doesn't exercise the new hardening features.

## Recommendation

Create a new **E2E Resilience Test** (`scripts/verify-resilience.ts`) that:

1.  Uses a "Chaos Model" (mock model that intentionally returns repetitive loops or hangs).
2.  Verifies that the **Supervisor** triggers an interrupt.
3.  Verifies that **Physiology** metrics change (Frustration goes up).
4.  Verifies that **Arbiter** is called (by simulating a merge conflict in the mock filesystem).
