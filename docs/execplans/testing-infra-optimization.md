# Testing infrastructure optimization (unit-by-default, isolation, timeouts)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, developers can run fast, reliable tests by default (especially in `lefthook` pre-push and `bun run test:fast`) without accidentally executing integration/E2E/performance suites. Test hangs caused by runaway timeouts, leaked handles, or `mock.module()` cross-test pollution are mitigated via a shared preload that enforces timeouts, watchdog exits, mock cleanup, and basic environment isolation. Slow suites remain available via explicit opt-in commands, with clear categorization based on file naming conventions already used in the repository.

The success signal is observable:

    cd /Users/jackmazac/Development/alfred
    bun run test:fast
    bunx lefthook run pre-push

Both complete quickly and do not hang. Integration/E2E/perf suites only run when explicitly invoked.

## Progress

- [x] (2025-12-28) Create this ExecPlan and confirm baseline state of current test scripts and preloads.
- [x] (2025-12-28) Implement a scope-aware test runner wrapper (`scripts/test-bun.ts`) that selects tests by scope (unit/integration/e2e/perf/all) based on filename and directory conventions.
- [x] (2025-12-28) Add shared Bun preload in `packages/test-kit/src/bun/preload.ts` that:
  - sets a watchdog timeout that exits with failure if the test process hangs,
  - resets function mocks after each test (`mock.restore()` and `mock.clearAllMocks()`),
  - restores a safe subset of env var keys after each test to prevent cross-test env pollution,
  - supports “module mock resetters” registered by other preloads to re-apply baseline `mock.module()` mocks.
- [x] (2025-12-28) Refactor key API mock preloads to register module-mock resetters so baseline mocks can be re-applied between tests.
- [x] (2025-12-28) Update package `test` scripts (all `packages/*/package.json`) to:
  - run through `../../scripts/test-bun.ts` (so scope filtering is applied),
  - include `--timeout 60000`,
  - preload the shared preload (`../test-kit/src/bun/preload.ts`) plus any package-specific preloads.
- [x] (2025-12-28) Update `lefthook.yml` pre-push tests to:
  - run unit-only by default (via `ALFRED_TEST_SCOPE=unit`),
  - fail fast (`--bail=3`) while keeping overall runtime bounded.
- [x] (2025-12-28) Update `turbo.json` task `test.env` list to include new env vars used by test scope/isolation so Turbo caching stays correct.
- [x] (2025-12-28) Add durable doc(s) capturing the conventions and anti-patterns (rules under `.ruler/`, plus `docs/architecture/testing-infra.md`).
- [x] (2025-12-28) Validate: `bun run test:fast` completes without hangs (bounded by suite/file watchdogs).

## Surprises & Discoveries

- Observation: Bun’s `mock.restore()` does not reset modules overridden via `mock.module()`, so we need an explicit pattern to re-apply baseline module mocks to avoid cross-test pollution.
  Evidence: `docs/reference/bun/test/mocks.md` (section “Restore all function mocks with mock.restore()”) notes: “Doing so does not reset the value of modules overridden with mock.module().”

## Decision Log

- Decision: Categorize “unit vs integration vs e2e vs perf” by file naming conventions (`*.integration.test.ts`, `*.e2e.test.ts`, `*.perf.test.ts`) plus directory segments (`/integration/`, `/e2e/`, `/perf/`) and default to unit-only in package `test` scripts.
  Rationale: File-level naming already exists across the repo; this is simple, deterministic, and does not require rewriting test bodies or adding bespoke annotations.
  Date/Author: 2025-12-28 / agent

- Decision: Use a shared preload to mitigate hangs and mock pollution instead of attempting to bulk refactor hundreds of `mock.module()` call sites immediately.
  Rationale: The repository has ~470 `mock.module()` usages; an infra-level guard provides immediate stability, while incremental test refactors can follow.
  Date/Author: 2025-12-28 / agent

## Outcomes & Retrospective

- Outcome: Unit tests are the default for `test:fast` and pre-push, with explicit opt-in for slower scopes via `ALFRED_TEST_SCOPE`.
  Evidence:
  - `scripts/test-bun.ts` (scope selection + hard-kill timeouts).
  - `packages/test-kit/src/bun/preload.ts` (watchdog + mock/env cleanup + stdin pause).
  - Root `package.json`, `lefthook.yml`, and `turbo.json` (wiring and env propagation).
  - Package scripts across `packages/*/package.json` (standardized `--timeout 60000` + shared preload).

- Outcome: Deterministic hang mitigation is enforced at multiple layers (per-test timeout, per-process watchdog, suite/file hard-kill, wrapper hard-kill).
  Evidence:
  - `scripts/test-bun.ts` (suite/file timeout kill + SIGKILL escalation).
  - `packages/test-kit/src/bun/preload.ts` (`ALFRED_TEST_WATCHDOG_MS` + stdin pause).

- Outcome: Reduced suite-only hangs from `mock.module()` deadlocks by avoiding async `mock.module()` factories.
  Evidence:
  - `packages/api/test/assistant.replay.test.ts` (removed async `mock.module()` factory).

## Context and Orientation

Key files today:

- Root scripts:
  - `package.json`:
    - `test:fast` runs `turbo run test` excluding slow packages.
    - Several explicit integration commands exist (`test:integration`, `test:workflow-integration`, `test:integration:full`).
  - `scripts/test-bun.ts`: currently a thin wrapper around `bun test`.
- Pre-push:
  - `lefthook.yml`: `pre-push.tests` runs `bun run test:fast --filter=... --concurrency=4`.
- Turbo:
  - `turbo.json`: `tasks.test.env` currently includes `RUN_DB_TESTS`, `NODE_ENV`, `VITE_TEST_MODE`.
- Existing per-package preloads:
  - `packages/runtime/test/utils/sandbox.ts`, `packages/api/test/utils/sandbox.ts`, `packages/agent/test/utils/sandbox.ts` set `ALFRED_PLANS_DIR` to a temp directory.
  - `packages/api/test/utils/mock-metrics.ts` / `mock-db-client.ts` / `mock-voice.ts` apply broad `mock.module()` shims to avoid heavy deps.
- Bun mocking behavior:
  - `docs/reference/bun/test/mocks.md` documents that `mock.restore()` does not reset `mock.module()` overrides; this is the root of module-mock pollution between tests.

Definitions used in this plan:

- “Unit test”: A test that does not require external services (Postgres, real voice processes, Playwright, network). It may use in-memory DB (`sqlite::memory:`) or mocks.
- “Integration test”: A test that exercises real boundaries (DB, real workflow engine wiring, real subprocesses) or depends on service-like fixtures. In this repo, typically named `*.integration.test.ts` or placed under `test/integration/`.
- “E2E test”: A test that drives UI or system end-to-end. In this repo, Bun E2E tests are named `*.e2e.test.ts` and Playwright is executed separately via `bunx playwright ...`.
- “Perf test”: A test that measures performance or budgets. In this repo, typically named `*.perf.test.ts` or placed under `tests/perf/`.
- “Preload”: A Bun test runner feature (`bun test --preload <file>`) that imports a module before any test files run, typically used for stable mocks and global hooks.

## Plan of Work

First, implement shared infrastructure:

1. Extend `scripts/test-bun.ts` into a scope-aware runner:
   - When invoked from a package test script, discover all test files in that package (respecting Bun’s conventions).
   - Filter discovered files by `process.env.ALFRED_TEST_SCOPE` (default `unit`).
   - Run `bun test` with provided flags (including `--timeout`) and an explicit list of files so excluded tests do not run.

2. Add `packages/test-kit/src/bun/preload.ts`:
   - Install watchdog timer (default 300000ms) that calls `process.exit(1)` if the process stays alive too long.
   - Add `afterEach` to restore/clear function mocks and reset selected env var keys.
   - Provide a global registration API so other preloads can register “module mock resetters” that re-apply baseline `mock.module()` mocks after each test.

Then wire it everywhere:

3. Update each `packages/*/package.json` `test` script to:
   - call `bun ../../scripts/test-bun.ts` instead of `bun test`,
   - pass `--timeout 60000`,
   - include `--preload ../test-kit/src/bun/preload.ts` first,
   - retain existing package-specific preloads and concurrency flags.

4. Update `lefthook.yml`:
   - ensure `ALFRED_TEST_SCOPE=unit` is set for pre-push tests,
   - pass `-- --bail=3` through Turbo to Bun test runner.

5. Update `turbo.json`:
   - add `ALFRED_TEST_SCOPE`, `ALFRED_TEST_WATCHDOG_MS`, `ALFRED_TEST_TIMEOUT_MS` to `tasks.test.env`.

6. Document the categorization and commands:
   - add `docs/testing/test-categories.md` describing naming conventions and how to run unit/integration/e2e/perf suites.

## Concrete Steps

All commands are run from:

    cd /Users/jackmazac/Development/alfred

Implementation steps:

1. Edit `scripts/test-bun.ts` and add `packages/test-kit/src/bun/preload.ts`.
2. Update package scripts and config files (`package.json`, `lefthook.yml`, `turbo.json`).
3. Run:

   bun run test:fast
   bunx lefthook run pre-push

If anything hangs, the watchdog should terminate the run and the failing command should show which package/test was last executing.

## Validation and Acceptance

Acceptance criteria:

- `bun run test:fast` completes in under 120 seconds and does not hang.
- `bunx lefthook run pre-push` completes in under 180 seconds and does not hang.
- Integration/E2E/perf tests do not run during `test:fast` and pre-push by default.
- All package test scripts enforce `--timeout 60000`.
- Test processes have a watchdog (default 5 minutes) that exits with a non-zero code if the runner is stuck (prevents indefinite hangs).
- Module-mock pollution is reduced: tests that override `mock.module()` do not break unrelated tests executed later in the same process, because baseline mocks are re-applied between tests via resetters.

## Idempotence and Recovery

These changes are safe to apply repeatedly:

- Test runner wrapper changes only affect how tests are selected/executed.
- Preload changes are test-only and do not impact production builds.
- If a package’s tests unexpectedly rely on integration behavior, run them explicitly with:

  ALFRED_TEST_SCOPE=integration bun run --filter <pkg> test

or use the repo-level integration scripts.

## Artifacts and Notes

Key reference: `docs/reference/bun/test/mocks.md` documents that `mock.restore()` does not reset `mock.module()` overrides, so module reset requires explicit re-application.
