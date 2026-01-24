# logger-consolidation

Owner: infra

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `/.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, all runtime and UI logging across the ALFRED monorepo flows through `@alfred/logger`, producing standardized structured output in production (single-line JSON) and readable pretty logs in development, with consistent context propagation (IDs like `runId`, `workflowId`, `userId`) and redaction as a last line of defense.

You can see it working by:

1. Running any server entrypoint with `NODE_ENV=production` and observing that log lines are valid single-line JSON objects with standard keys (`timestamp`, `level`, `message`, `service`, `environment`, plus merged context).
2. Running in development and observing readable, color-coded log prefixes and context objects.
3. Searching the repo for `console.` in `apps/*/src` and `packages/*/src` and finding no direct calls (except within `packages/logger` implementation).

## Progress

- [x] (2026-01-10 10:09Z) Initialized ExecPlan and outlined scope and acceptance.
- [x] (2026-01-10 10:15Z) Enhanced `@alfred/logger` with `child()` context propagation, transport interface, safe stringify (circular/BigInt/Error), and key-based redaction.
- [x] (2026-01-10 10:15Z) Updated `@alfred/logger` unit tests for production JSON, dev pretty output, child context merge/override, circular refs, redaction, and Error normalization.
- [x] (2026-01-10 10:17Z) Standardized logger test stubs on `@alfred/test-kit/logger` by removing API-local `loggerStub` and updating API tests to use `loggerMocks`.
- [x] (2026-01-10 10:42Z) Replaced `console.*` usage under `apps/*/src` and `packages/*/src` with `@alfred/logger` (exception: logger transport), including removal of commented `console.*` references that trip repo-wide greps.
- [x] (2026-01-10 10:42Z) Ensured runtime/orchestrator logs include IDs when available by adding `runId`/`userId` to `runAgent` warnings and propagating IDs into pipeline logs via `RuntimeContext`.
- [x] (2026-01-10 10:42Z) Ran `bun run typecheck` successfully and validated impacted suites (`packages/logger` tests, `packages/api` tests, `apps/web` build).

## Surprises & Discoveries

- Observation: `/.ruler/logger.md` is referenced in generated `packages/logger/AGENTS.md` but does not exist under `/.ruler/`.
  Evidence: `ls .ruler` does not include `logger.md`; the guidance is present only in `packages/logger/AGENTS.md`.

## Decision Log

- Decision: Implement `@alfred/logger` as an isomorphic module with environment detection that avoids requiring `process` or Node-only APIs at import time.
  Rationale: `apps/web` must be able to import `@alfred/logger` without bundling server-only dependencies or crashing in the browser.
  Date/Author: 2026-01-10 / codex

## Outcomes & Retrospective

- (pending) Record what was migrated, any exceptions, performance notes, and remaining follow-ups once the refactor lands.

## Context and Orientation

This repo is a Bun-first monorepo with both browser code (`apps/web/src/...`) and server/runtime code (`packages/*/src/...`).

Key logging-related files today:

- `packages/logger/src/index.ts` contains the current global `logger` object. It formats JSON for non-development, and prints readable strings/objects in development, but it does not support scoped child loggers, transports, redaction, or safe serialization.
- `apps/web/src/components/...` contains direct `console.*` calls that bypass `@alfred/logger`.
- Several backend packages already import `@alfred/logger` but sometimes fall back to `console` or string interpolation instead of passing a context object.
- `packages/api/test/utils/mock-metrics.ts` defines a `loggerStub` used by tests; it should be moved to `packages/test-kit` so all packages can use the same pattern.

Important constraints:

- `@alfred/logger` must remain dependency-free and safe to import in both browser and server environments.
- Production logs must be single-line JSON with no crashes from circular references.
- Secrets and PII must not be logged; the logger will implement a small recursive redactor as a last line of defense, but callers remain responsible for not logging sensitive values in the first place.

## Plan of Work

First, extend `@alfred/logger` to support context propagation and controlled output:

1. Add a typed `LogContext` with encouraged standard keys (`runId`, `workflowId`, `userId`, etc.) while still allowing arbitrary keys.
2. Implement `logger.child(context)` which returns a logger whose calls merge base context and per-call context without allocating excessively.
3. Add a lightweight `transport` interface with a console transport by default. Ensure the transport uses `process.stdout.write` when available for performance, but falls back safely in the browser.
4. Implement safe serialization for production JSON, including circular reference handling and `Error` normalization.
5. Add a minimal recursive redactor (keys such as `token`, `password`, `secret`, `apiKey`, `authorization`) with a max depth guard.

Second, standardize tests:

1. Move `loggerStub` to `packages/test-kit` (new module) and update imports in tests to use it.
2. Add unit tests for the logger itself covering:
   - production JSON output is valid single-line JSON
   - development output does not throw and includes context
   - circular references do not crash serialization
   - redaction replaces sensitive values

Third, migrate call sites:

1. Use `rg "console\\.(log|error|warn|info)"` under `apps/*/src` and `packages/*/src`.
2. Replace with `logger.*` calls.
3. Convert string interpolation into structured context, and ensure at least one contextual ID is present in runtime/agent logs when available.

## Concrete Steps

All commands are run from the repo root (`/Users/jackmazac/Development/alfred`).

1. Search for direct console usage:
   - `rg -n "console\\.(log|error|warn|info)" apps/*/src packages/*/src`

2. Typecheck:
   - `bun run typecheck`

3. Run tests (scoped as needed if full suite is large):
   - `bun scripts/test-bun.ts` (or set `ALFRED_TEST_SCOPE=unit` for faster iteration)

## Validation and Acceptance

Acceptance criteria:

1. `rg -n "console\\.(log|error|warn|info)" apps/*/src packages/*/src` returns no matches (except inside `packages/logger`).
2. Running a server in `NODE_ENV=production` produces single-line JSON log entries that parse as JSON and include standard keys.
3. `apps/web` can import and run with the logger without bundling server-only modules.
4. `bun run typecheck` passes.
5. Logger unit tests cover circular references and redaction.

## Idempotence and Recovery

All edits in this plan are safe to repeat. If a migration breaks behavior, revert individual call sites back to prior log statements and re-run `bun run typecheck` to localize the failure. Avoid deleting files; prefer adding adapters during the migration if needed.

## Artifacts and Notes

- (pending) Add short transcripts of `rg` results and typecheck once completed.

## Interfaces and Dependencies

At the end of this plan, `packages/logger/src/index.ts` (or adjacent module files) must export:

- `type LogLevel = "debug" | "info" | "warn" | "error"`
- `type LogContext` with standard key suggestions and arbitrary extension
- `type LogTransport` with `write(entry: LogEntry): void`
- `type LogEntry` containing at least `timestamp`, `level`, `message`, `service`, `environment`, and `context`
- `logger.configure(config)`
- `logger.child(context)`
- `logger.debug/info/warn/error(message, context?)`

The default transport must remain console-based and dependency-free.
