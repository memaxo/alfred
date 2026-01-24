# harbor-evals

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` at repository root defines the ExecPlan format and maintenance requirements.

## Purpose / Big Picture

After this change, ALFRED will have a small, high-signal Harbor evaluation suite that catches the most expensive-to-debug regressions early: “our Harbor harness isn’t producing valid trajectories”, “the agent can no longer fix small codebases”, “ALFRED doesn’t escalate when stuck”, and “context / retrieval is broken so fixes are brittle”.

A developer can generate the dataset with `bun harbor:dataset`, run Harbor against it, and get:

- deterministic pass/fail rewards (`/logs/verifier/reward.txt`)
- a valid Harbor trajectory file (`/logs/verifier/trajectory.json`) in ATIF format (Agent Trajectory Interchange Format)
- a small set of task fixtures that represent real “coding agent” work rather than trivial file creation

The evals are ordered by ROI (highest first): harness correctness → SWE-bench-like patch tasks → ALFRED-runtime behaviors → context / retrieval tasks.

We also support **dataset profiles**:

- `HARBOR_DATASET_PROFILE=pr`: small, fast, high-signal “PR gate” set.
- `HARBOR_DATASET_PROFILE=nightly`: expanded coverage (typecheck/lint/build/multi-file/tool pairing/scope/escalation realism).

## Progress

- [x] (2026-01-19) Milestone 0: Align on “what is a Harbor eval” in this repo and pin task IDs and structure.
- [x] (2026-01-19) Milestone 1: Add the harness correctness eval (ATIF validity + reward discipline) and make `bun workflow:run --outTrajectory` produce valid ATIF.
- [x] (2026-01-19) Milestone 2: Add the SWE-bench-like evals (fail-to-pass + pass-to-pass regression) using fixture workspaces and verifiers that run `bun test` / `bun run typecheck`.
- [x] (2026-01-19) Milestone 3: Add ALFRED-runtime behavior evals (stuck → escalation file; optional safety/max-transitions smoke).
- [x] (2026-01-19) Milestone 4: Add context / retrieval evals (local-doc + code-context dependency; optional RAG refine/fallback coverage).
- [x] (2026-01-19) Milestone 5: Wire a “smoke” workflow (local) and a CI-friendly job entrypoint that can be run on demand.

## Surprises & Discoveries

- Observation: Harbor tasks expect `trajectory.json` in ATIF shape (e.g. `schema_version`, `session_id`, `steps[]`).
  Evidence: `scripts/harbor-ingest.ts` treats the trajectory as `{ schema_version?: string; steps?: unknown[] }` and defaults `schemaVersion` to `ATIF-v1.4`.

- Observation: `bun workflow:run --outTrajectory` used to write pipeline event JSON (`{ runId, events }`), which was not ATIF; Harbor runs could succeed but produce unusable trajectories.
  Evidence: Fixed by switching `scripts/workflow.ts` to run `runOrchestrator()` and write `buildAtifTrajectory(...)` output to the out path.

- Observation: Using `execSync([...].join(" "))` to call `scripts/harbor.ts gen --verify "<cmd with &&>"` breaks argument parsing because `&&` is interpreted by the shell.
  Evidence: `bun harbor:smoke` failed before the fix with “Missing required arguments.”; fixed by switching `scripts/harbor-smoke.ts` and `scripts/harbor-dataset.ts` to `spawnSync()` with argv arrays.

- Observation: Some environments alias common Unix tools (e.g. `find`), making “signature generation” shell one-liners brittle.
  Evidence: We added `scripts/harbor-fixture-sig.ts` to deterministically compute `tests.sig` for fixtures instead of relying on shell pipelines.

- Observation: `require-scope` was not previously represented in ATIF exports, and `runOrchestrator()` did not emit a scope request signal.
  Evidence: Added ATIF support for `require-scope` in `packages/runtime/src/trajectory/atif.ts` and mirrored the legacy runner scope request in `packages/runtime/src/orchestrator/index.ts` when `auto` is `medium|high`.

## Decision Log

- Decision: The first eval will be a meta-eval that validates the harness outputs (ATIF + reward discipline) before we add “real” tasks.
  Rationale: If trajectories are malformed or rewards are non-deterministic, all downstream eval work becomes noisy and analysis becomes impossible.
  Date/Author: 2026-01-19 / Cursor agent

- Decision: Task IDs will be single lowercase words (e.g. `atif`, `failtest`, `regress`, `stuck`, `context`) and must remain stable once published.
  Rationale: IDs become dataset keys for longitudinal tracking and ingestion; stability reduces churn and simplifies dashboards.
  Date/Author: 2026-01-19 / Cursor agent

- Decision: `bun workflow:run --outTrajectory` outputs ATIF (not pipeline event JSON) when `--outTrajectory` is set.
  Rationale: Harbor’s adapter (`scripts/harbor.ts` → `agents/alfred.sh`) assumes `trajectory.json` is ATIF; making the CLI honor that contract removes an entire class of “it ran but we can’t debug it” failures.
  Date/Author: 2026-01-19 / Cursor agent

## Outcomes & Retrospective

### Outcomes (2026-01-19)

We implemented a first “high ROI” Harbor dataset layer and fixed the CLI contract needed to make Harbor trajectories useful:

- `bun workflow:run --outTrajectory <path>` now writes a valid ATIF `trajectory.json` (via `@alfred/runtime/trajectory/atif` + `@alfred/runtime/trajectory/validate`) instead of pipeline event JSON.
- `bun harbor:dataset <outDir>` supports `HARBOR_DATASET_PROFILE=pr|nightly` for fast PR gating vs expanded nightly coverage.
- Added additional tasks (nightly): `typecheck`, `lintfix`, `build`, `multifile`, `pair`, `scope`, `blocked`.
- The dataset generator copies fixture workspaces from `harbor/fixtures/<taskId>/workspace/` into each generated task’s `workspace/` directory for determinism.
- SWE-bench-like tasks enforce “don’t edit tests” by verifying `tests.sig` before running `bun test`.
- Oracles are real per-task commands (generator supports `--oracle`), rather than a stub that always writes a passing reward.
- `bun harbor:smoke` now passes robustly even when `--verify` contains shell operators like `&&` (by switching from `execSync` string commands to `spawnSync` argv).
- Added `bun harbor:verify` (static dataset structure validation) and `bun harbor:summary` (reward aggregation over Harbor output trees).
- Improved ingestion: `scripts/harbor-ingest.ts` validates ATIF and stores `trajectoryOk` + validation errors alongside reward.
- Added CI workflow `./.github/workflows/harbor-smoke.yml` to run `bun harbor:smoke` on demand.

Evidence captured during implementation:

- `bun test packages/runtime/test/trajectory.test.ts` passed (2 tests).
- `bun harbor:smoke` passed and successfully generated 13 tasks in the temporary smoke dataset directory.

## Context and Orientation

This plan targets ALFRED itself (not apps generated by ALFRED).

Key terms (plain language):

- Harbor: A framework that runs evaluation “tasks” in containers and scores them with deterministic verifiers.
- Task: A directory containing (a) an instruction for the agent, (b) an execution environment, and (c) a verifier that writes a numeric reward.
- Dataset: A directory containing multiple tasks plus a `registry.json`.
- Verifier: The code (usually `tests/test.sh`) that checks whether the agent’s output is correct and writes `/logs/verifier/reward.txt` with a float in `[0, 1]` (we will use `0` or `1`).
- ATIF: Agent Trajectory Interchange Format. A JSON schema used by Harbor to record what happened (messages, tool calls, tool results) so failures are debuggable and comparable.

Existing repo patterns to follow:

- Harbor task generator: `scripts/harbor.ts` (writes `task.toml`, `instruction.md`, `environment/Dockerfile`, `agents/alfred.sh`, `tests/test.sh`).
- Harbor dataset generator: `scripts/harbor-dataset.ts` (currently generates 8 smoke-level tasks and a `registry.json`).
- Harbor ingestion: `scripts/harbor-ingest.ts` (imports `reward.txt` + `trajectory.json` into DB as an ATIF trajectory).
- Trajectory builder/validator: `packages/runtime/src/trajectory/atif.ts` + `packages/runtime/src/trajectory/validate.ts`.
- Workflow runner CLI: `package.json` script `workflow:run` → `scripts/workflow.ts run`.

Important constraints (what makes Harbor evals tricky here):

- The Harbor adapter in `scripts/harbor.ts` sets `DATABASE_URL=sqlite:/logs/verifier/alfred.db`. This means the evaluation must not require Postgres-only features.
- The verifier must be deterministic and must not require network access by default.
- The trajectory must be valid ATIF, otherwise Harbor tooling and ALFRED’s ingest pipeline cannot reason about failures.

## Plan of Work

We will implement four Harbor eval “suites” (one per ROI category), each represented by at least one Harbor task directory produced by `bun harbor:dataset`:

1. Harness correctness: `atif`

2. SWE-bench-like patch tasks: `failtest` and `regress`

3. ALFRED-runtime behaviors: `stuck` (plus an optional second task for a safety cap if we can make it deterministic)

4. Context / retrieval: `context` (local-only, no network)

The work will be done by extending the dataset generator to produce these tasks, and by adding fixture workspaces under `harbor/fixtures/<taskId>/workspace/` that get copied into each generated task’s `workspace/` directory.

We will also fix the `workflow:run --outTrajectory` contract so that the Harbor agent adapter writes ATIF to `/logs/verifier/trajectory.json` as intended.

## Concrete Steps

Milestone 0 (orientation + design pinning)

1. Read these files to refresh the current Harbor contract:
   - `docs/implementation/harbor-stage2.md`
   - `scripts/harbor.ts`
   - `scripts/harbor-dataset.ts`
   - `scripts/harbor-ingest.ts`
   - `scripts/workflow.ts`
   - `packages/runtime/src/trajectory/atif.ts`

2. Confirm final task IDs and add them to `scripts/harbor-dataset.ts` in a stable order:
   - `atif`
   - `failtest`
   - `regress`
   - `stuck`
   - `context`

Milestone 1 (harness correctness: ATIF + reward discipline)

1. Update `scripts/workflow.ts` so that when `--outTrajectory <path>` is provided, the file at that path is valid ATIF JSON.
   - Prefer using the existing builder/validator under `packages/runtime/src/trajectory/atif.ts` and `packages/runtime/src/trajectory/validate.ts`.
   - The simplest acceptable approach is:
     - run the orchestrator path that produces `WorkflowEvent` (see `packages/runtime/src/orchestrator/index.ts` `runOrchestrator()`), not just pipeline events
     - persist those events to the sqlite workflow tables (see `packages/agent/src/workflow/event-persistence.ts` or `packages/runtime/src/workflow/persist.ts`)
     - call `workflowRepo.listEvents(runId)` and then `buildAtifTrajectory({ runId, requirement, events: ... })`
     - validate the result with `validateAtifTrajectory()` and still write the file even if invalid (but include a clear error in CLI JSON output)

2. Add a new Harbor task `atif` whose verifier checks:
   - `/logs/verifier/trajectory.json` exists
   - it parses as JSON
   - it contains `schema_version` and `steps` and `session_id`
   - `packages/runtime/src/trajectory/validate.ts` reports `ok: true`
   - reward is `1` only when the above holds
   - reward is always `0` or `1` (never blank, never “true/false”)

3. Update `scripts/harbor-dataset.ts` to include the `atif` task and its verifier command (the verifier can be a `bun` invocation inside the container).

Milestone 2 (SWE-bench-like patch tasks: fail-to-pass + pass-to-pass)

1. Add fixture workspaces:
   - `harbor/fixtures/failtest/workspace/` containing a tiny Bun/TS project where:
     - one unit test fails initially (fail-to-pass)
     - fixing it requires editing a non-test file
   - `harbor/fixtures/regress/workspace/` containing a tiny Bun/TS project where:
     - one unit test fails initially
     - there is at least one regression test that passes initially and must stay passing

2. Add dataset tasks:
   - `failtest`: instruction says “make tests pass”; verifier runs `bun test`.
   - `regress`: instruction says “fix failing test without breaking others”; verifier runs `bun test` and asserts total passing count (or just exit code) and optionally checks that the failing test is now passing.

3. Ensure each task’s `environment/Dockerfile` includes whatever the fixture needs (but prefer keeping fixtures Bun-only, no Postgres, no external services).

Milestone 3 (ALFRED-runtime behavior: stuck → escalation)

1. Add fixture workspace `harbor/fixtures/stuck/workspace/` that contains a README describing where the agent should write its escalation file (or just rely on ALFRED’s existing escalation file convention).

2. Add dataset task `stuck`:
   - instruction is intentionally underspecified / ambiguous (but deterministic) and directs ALFRED to escalate if blocked
   - verifier checks:
     - an `ESCALATION-*.md` file exists under `workspace/` (or the exact path ALFRED uses for escalation in this mode)
     - the file is non-empty and contains a reason
     - reward is `1` if escalation is present, else `0`

Milestone 4 (context / retrieval: local-only context dependency)

1. Add fixture workspace `harbor/fixtures/context/workspace/` that contains:
   - a small codebase with a hidden-but-local “fact” (e.g. a constant in `src/constants.ts`)
   - a failing test or a required output that depends on discovering that fact

2. Add dataset task `context`:
   - instruction requires producing an output that can only be correct if ALFRED reads the local context (e.g. update a file to use the correct constant, or update code so tests pass)
   - verifier runs `bun test` (or a deterministic `node`/`bun` command) so the task is execution-verified

Milestone 5 (smoke + CI-friendly entrypoints)

1. Ensure `bun harbor:smoke` covers the new tasks at least structurally (task directories and scripts exist).
2. Add a documented command sequence for a developer to run the dataset locally:
   - `ALFRED_GIT_URL=file://<repo-root> ALFRED_GIT_REF=<ref> bun harbor:dataset ./harbor/datasets/alfred`
   - `uv run harbor jobs start -p ./harbor/datasets/alfred -a alfred`
3. (Optional) Add a CI workflow that only runs `bun harbor:smoke` (not Harbor itself), unless Harbor is already installed in CI.

## Validation and Acceptance

Acceptance is defined as observable behavior, not “code exists”.

For Milestone 1 (harness correctness):

- Running `bun workflow:run --requirement "Create TEST.txt with hello" --workspace <dir> --outTrajectory <path>` produces an ATIF JSON file at `<path>` that passes `validateAtifTrajectory()`.
- Running `bun harbor:dataset ./harbor/datasets/alfred` includes a task directory `./harbor/datasets/alfred/atif/`.
- Running the verifier script for `atif` produces `/logs/verifier/reward.txt` with `1` when `trajectory.json` is valid ATIF.

For Milestone 2 (patch tasks):

- `failtest` and `regress` tasks are deterministic and pass under the oracle solution (if present) and fail under an unmodified fixture workspace.
- The verifier uses execution-based checks (`bun test`) rather than string-matching outputs.

For Milestone 3 (runtime behavior):

- `stuck` reliably produces reward `1` only when ALFRED escalates by writing a non-empty escalation file.

For Milestone 4 (context):

- `context` reliably produces reward `1` only when ALFRED makes the correct code change that requires reading local context.

## Idempotence and Recovery

- Dataset generation must be safe to run multiple times. If `bun harbor:dataset` is re-run into the same output directory, it should either overwrite tasks deterministically or error with a clear message; pick one behavior and document it in `scripts/harbor-dataset.ts` help output.
- Fixture directories under `harbor/fixtures/` are treated as source-of-truth templates and must not be mutated by tests; tasks should copy them into `workspace/`.

## Artifacts and Notes

Key files we expect to touch/add:

- `scripts/workflow.ts` (fix ATIF output when `--outTrajectory` is set)
- `scripts/harbor-dataset.ts` (add tasks: `atif`, `failtest`, `regress`, `stuck`, `context`)
- `scripts/harbor.ts` (optional: improve generated verifier/oracle stubs; ensure it still matches Harbor expectations)
- `harbor/fixtures/atif/workspace/` (if needed; may be empty)
- `harbor/fixtures/failtest/workspace/`
- `harbor/fixtures/regress/workspace/`
- `harbor/fixtures/stuck/workspace/`
- `harbor/fixtures/context/workspace/`

## Interfaces and Dependencies

Harbor-side contract (must hold after implementation):

- `agents/alfred.sh` writes:
  - `DATABASE_URL=sqlite:/logs/verifier/alfred.db`
  - `/logs/verifier/trajectory.json` (valid ATIF)
- `tests/test.sh` writes:
  - `/logs/verifier/reward.txt` with `0` or `1`

ALFRED-side implementation building blocks to reuse:

- ATIF builder: `packages/runtime/src/trajectory/atif.ts` (`buildAtifTrajectory`)
- ATIF validator: `packages/runtime/src/trajectory/validate.ts` (`validateAtifTrajectory`)
- Workflow persistence helper (sqlite-compatible): `packages/agent/src/workflow/event-persistence.ts` (`persistEventSafe`)
- Orchestrator runner (yields `WorkflowEvent`): `packages/runtime/src/orchestrator/index.ts` (`runOrchestrator`)

When changing any of the above contracts, update this ExecPlan’s `Decision Log` and add evidence in `Surprises & Discoveries`.
