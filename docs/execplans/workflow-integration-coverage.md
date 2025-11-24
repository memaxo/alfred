# workflow-integration-coverage

Owner: runtime

This note captures the tmux/session reliability coverage that now backs the workflow runtime. It ties together the new integration tests, verification scripts, and CI hooks so we can keep tmux regressions visible.

## Purpose
- Guarantee WorkspaceFactory + WorktreeWorkspace session helpers are exercised whenever the review fixer runs and when multiple session starts happen concurrently.
- Provide CLI scripts that stress positive, missing-binary, and crash paths for tmux so CI reflects real-world failure handling.
- Validate ContainerWorkspace flows by running tmux inside a Docker workspace image.
- Detect leaked sessions after orchestration tests to keep runners clean.

## Recent Additions
- `packages/runtime/test/workspace.sessions.integration.test.ts` spins `runReviewPhase` under `ORCH_ENABLE_SESSIONS=1`, verifies fixer sessions start/stop via WorkspaceFactory, and asserts leak cleanup with `check-tmux-leaks`.
- The same test file now includes a concurrency stress case that races two `startSession` calls on WorktreeWorkspace while a mocked `toolSession` ensures unique IDs and cleanup.
- `scripts/check-tmux-leaks.ts` lists tmux sessions (default patterns `ws-` / `verify-session-`) and fails on leaks; tests override its list handler for deterministic assertions.
- Added a regression in `workspace.sessions.integration.test.ts` that pins the failure path by feeding `check-tmux-leaks` a synthetic leak list and asserting it throws.
- `scripts/verify-sessions.ts` gained `--fail` (simulated missing tmux) and `--session-crash` (kills the tmux server mid-run) in addition to the default happy path.
- `tests/sessions-container.ts` builds a tiny Docker image with tmux, boots a `ContainerWorkspace`, and proves tmux sessions can start/peek/stop inside the container.

## Usage
- Integration test entry point: `bun test packages/runtime/test/workspace.sessions.integration.test.ts` (set `ORCH_ENABLE_SESSIONS=1` to exercise session helpers; the test mocks `toolSession` so `ORCH_TMUX_DISABLED=1` is safe).
- Leak detection: `bun scripts/check-tmux-leaks.ts` (add `--strict` when tmux must exist, e.g., nightly in CI).
- Session verification: `bun scripts/verify-sessions.ts` (default), `bun scripts/verify-sessions.ts --fail`, and `bun scripts/verify-sessions.ts --session-crash`.
- Container verification: `bun tests/sessions-container.ts` (requires Docker, runs only in nightly CI).

## CI Hooks
- `.github/workflows/ci.yml` now runs the default verify-sessions script plus the new `--fail` / `--session-crash` modes and `check-tmux-leaks` as best-effort steps after the main test matrix.
- `.github/workflows/postgres-nightly.yml` runs all three verify-sessions modes *and* executes `bun scripts/check-tmux-leaks.ts --strict` to fail on leaks.
- Nightly also runs `bun tests/sessions-container.ts` to cover the Docker + tmux path.
