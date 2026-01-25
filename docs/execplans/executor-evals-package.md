# Executor evals package (@alfred/evals)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md`

Owner: runtime / agent

## Purpose / Big Picture

Create a first-class verification harness package, `@alfred/evals`, that runs “executor runtime evals” (live end-to-end checks of Codex/OpenCode executors inside AgentFS Docker containers) with reliable timeout management, structured progress/events, and diagnostic error reporting.

After this change, a developer can run a single command to:

1. preflight-check Docker + required env,
2. start or reuse an AgentFS workspace container,
3. run executor probes (Codex + OpenCode, default/server profiles, ACP/HTTP transport),
4. optionally test crash recovery,
5. receive a machine-readable report and durable artifacts explaining failures.

The current script `scripts/verify-executors-live.ts` remains the user-facing entry point initially, but becomes a thin wrapper around `@alfred/evals`.

## Progress

- [ ] (2026-01-25) Create this ExecPlan.
- [ ] Scaffold `packages/evals` workspace (package.json, tsconfig.json, src/).
- [ ] Implement core step runner (global deadline, per-step timeouts, retries, stall watchdog, always-run cleanup).
- [ ] Implement structured event model + reporters (console + JSONL; optional JUnit).
- [ ] Implement redaction + env allowlist passing.
- [ ] Implement Docker/AgentFS drivers (preflight, image handling, container lifecycle, retain-on-fail).
- [ ] Implement executor suite adapters for `toolCodex` + `toolOpenCode`.
- [ ] Port `scripts/verify-executors-live.ts` to use `@alfred/evals` while preserving current UX.
- [ ] Add unit tests for runner/reporters/redaction; add suite tests with mocks (no network/provider calls).
- [ ] Validate: `bun run typecheck`, `bun run lint`, and targeted `bun test` runs.

## Surprises & Discoveries

- (placeholder)

## Decision Log

- Decision: Name the new package `@alfred/evals` (not `@alfred/verify`).
  Rationale: “evals” matches ALFRED’s existing terminology for runtime evaluation/smoke suites and avoids implying it is only a one-off verifier.
  Date/Author: 2026-01-25 / Droid

- Decision: Keep `scripts/verify-executors-live.ts` as a wrapper initially.
  Rationale: Preserve existing workflows while migrating functionality behind a stable library/CLI.
  Date/Author: 2026-01-25 / Droid

## Outcomes & Retrospective

- (to be filled after implementation)

## Context and Orientation

### What “executor live evals” means in this repo

“Executor live evals” are real end-to-end probes of ALFRED’s executor tools (Codex and OpenCode) running inside an AgentFS Docker container. They are not unit tests; they exercise:

- AgentFS container lifecycle
- Orchestrator tool invocation (`@alfred/agent/orchestrator/tool/*`)
- Provider auth and model invocation (can incur cost)
- Streaming/IO and error propagation

The current implementation lives in:

- `scripts/verify-executors-live.ts` — ad-hoc script that:
  - checks env vars
  - mints a Bearer token via `issueAccessToken()`
  - creates an AgentFS workspace via `WorkspaceFactory.create("agentfs", ...)`
  - calls `toolCodex.execute(...)` and `toolOpenCode.execute(...)`
  - performs best-effort crash recovery by killing a PID inside the container
  - prints a short snippet and asserts exact replies

The script has known shortcomings (the motivation for this package): lossy errors, inconsistent timeouts, limited structured observability, fragile crash recovery mechanics, and non-hermetic env mutation.

### Key dependencies already in the repo

- `@alfred/agent` exposes `WorkspaceFactory`, `toolDocker`, `toolCodex`, `toolOpenCode`, and server registries.
- `scripts/test-bun.ts` is the canonical Bun test wrapper.
- `ultracite` is the formatter/linter (`bun run lint` checks formatting).

### Non-goals (explicit)

- This package does not replace Bun unit/integration tests.
- This package does not add new executors.
- This package will not auto-run provider calls in CI by default. Provider calls must be explicitly gated (env flag or CLI `--confirm-cost`).

## Plan of Work

### Milestone 1: Scaffold `@alfred/evals`

Create a new workspace at `packages/evals/` modeled after lightweight packages like `packages/pacer`.

1. Create `packages/evals/package.json`:
   - `name`: `@alfred/evals`
   - `type`: `module`
   - `sideEffects`: false
   - `exports`: `{".": "./src/index.ts"}` and optionally `{"./cli": "./src/cli.ts"}`
   - scripts:
     - `typecheck`: `tsgo -b` (or `tsgo --noEmit` if not composite)
     - `test`: `bun ../../scripts/test-bun.ts --timeout 60000 --preload ../test-kit/src/bun/preload.ts`
   - deps:
     - `@alfred/agent` (workspace:\*)
     - `@alfred/logger` (workspace:\*) for structured logging
     - `zod` (catalog)
   - devDeps:
     - `@alfred/test-kit` (workspace:\*)

2. Create `packages/evals/tsconfig.json` extending `packages/tsconfig/tsconfig.json` (same pattern as `packages/pacer/tsconfig.json`).

3. Add `packages/evals/src/index.ts` exporting the public API.

Acceptance:

- `bunx turbo run typecheck --filter=@alfred/evals` succeeds.

### Milestone 2: Core run model (step runner + events)

Implement a minimal but strict runtime model:

- A `StepRunner` that executes a list of steps.
- A global deadline enforced across steps.
- Per-step `timeoutMs` that aborts the step and records a structured failure.
- Optional `retries` with backoff+jitter (only for explicitly marked steps).
- A stall watchdog emitting `step_stalled` if no logs/events were emitted for N ms.
- A finalizer stack (`finally` handlers) to guarantee cleanup even if the run fails early.

Define a stable, JSON-serializable event union (newline-delimited JSON friendly). Ensure every event includes `{ runId, ts }`.

Acceptance:

- Unit tests prove:
  - a step times out and surfaces a diagnostic error
  - retries happen exactly N times
  - cleanup always runs
  - event stream ordering is deterministic

### Milestone 3: Reporters + artifacts

Create reporters:

- Console reporter (human friendly): shows step start/end, duration, and concise error summaries.
- JSONL reporter: writes every event to `artifactsDir/events.jsonl`.

Artifacts:

- On failure, write a `summary.json` with:
  - run config (redacted)
  - per-step outcomes
  - environment snapshot (allowlisted, redacted)
  - last N lines of relevant logs

Acceptance:

- Running the CLI with `--json` produces valid JSONL.
- Failures produce an artifacts directory with `events.jsonl` + `summary.json`.

### Milestone 4: Drivers (Docker + AgentFS)

Implement drivers with consistent error extraction:

- Docker preflight that differentiates:
  - daemon not running
  - permission denied
  - misconfigured context

- Image behavior configurable:
  - `--image <tag>`
  - `--build-image` / `--skip-build`
  - `--pull missing|always|never`

- Workspace retention policy:
  - `--retain never|on-fail|always`

Capture driver evidence on failure:

- `docker info` excerpt
- `docker inspect` excerpt for the container
- container logs if available

Acceptance:

- With mocks, driver errors include exit codes and stderr previews (not sentinel strings).

### Milestone 5: Executor suite (Codex + OpenCode)

Implement an “executors” suite that reproduces the existing checks but with structured behavior.

Inputs (CLI/env):

- transport: `acp|http` (OpenCode)
- profiles: `default|server|both`
- skip flags: `--skip-crash-recovery`, `--skip-codex`, `--skip-opencode`
- timeouts:
  - `--timeout-total-ms`
  - `--timeout-opencode-ms`
  - `--timeout-codex-ms`

Hard requirement: provider calls must be gated behind `--confirm-cost` (or `ALFRED_EVALS_CONFIRM_COST=1`). Without confirmation, the suite runs only `preflight` and exits with a clear message.

Crash recovery:

- Prefer in-container process discovery (e.g. `pgrep -f`) over parsing `docker top` output.
- Kill with TERM then KILL if needed.
- Record restart latency and assert recovery happened (don’t silently skip without recording a `step_skip` event).

Acceptance:

- A mocked unit test suite validates:
  - exact reply matching
  - skip behavior and reporting
  - crash recovery path emits correct events

### Milestone 6: Wire `scripts/verify-executors-live.ts` to `@alfred/evals`

Refactor the script to:

- Parse its existing flags.
- Call into `@alfred/evals` CLI/library with equivalent options.
- Preserve current console UX by default.

Acceptance:

- `bun run scripts/verify-executors-live.ts --help` (if implemented) and a dry run (`--preflight`) behave predictably.

## Concrete Steps

All commands run from the repo root: `/Users/jackmazac/Development/alfred`.

1. Create the package scaffold:
   - mkdir -p packages/evals/src
   - create packages/evals/package.json
   - create packages/evals/tsconfig.json
   - create packages/evals/src/index.ts

2. Run typecheck for just the new package:
   - bunx turbo run typecheck --filter=@alfred/evals

3. Run tests for just the new package:
   - bunx turbo run test --filter=@alfred/evals

4. Run repo validators at the end:
   - bun run typecheck
   - bun run lint
   - bun run test:fast (or a targeted subset if appropriate)

## Validation and Acceptance

At completion, all must be true:

- `bun run typecheck` passes.
- `bun run lint` passes.
- `bunx turbo run test --filter=@alfred/evals` passes.
- `scripts/verify-executors-live.ts` continues to work, but now produces:
  - clear step-by-step progress output
  - diagnostic failure messages (including underlying exit codes / stderr previews)
  - an artifacts directory when requested.

## Idempotence and Recovery

- Running the suite multiple times should not leak containers by default.
- If `--retain=on-fail|always` is used, the suite prints the container name/id so the operator can inspect and clean up later.
- The suite must never run provider calls unless cost is explicitly confirmed.

## Interfaces and Dependencies

Public API surface (initial, minimal):

- `runExecutorEvals(config): Promise<RunSummary>`
- `createConsoleReporter(opts)`
- `createJsonlReporter(filePath)`

Dependencies:

- `@alfred/agent` for tool + workspace integration.
- `@alfred/logger` for structured logging.
- `zod` for config validation.
