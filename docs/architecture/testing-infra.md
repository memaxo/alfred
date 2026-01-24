# testing-infra

Purpose: keep ALFRED’s test suite fast by default, and **deterministically non-hanging** under Bun.

## Defaults

- **Unit-only by default** for local developer flows (`test:fast`, pre-push).
- Integration/E2E/perf run only via explicit opt-in.

## Deterministic “no hangs”

We layer multiple kill-switches because a single stuck handle can keep a Bun test process alive even after output finishes:

- **Per-test timeout**: `bun test --timeout 60000`
- **Per-process watchdog** (preload): `ALFRED_TEST_WATCHDOG_MS`
- **Hard kill suite** (wrapper): `ALFRED_TEST_RUN_TIMEOUT_MS`
- **Hard kill per file** (isolation mode): `ALFRED_TEST_FILE_TIMEOUT_MS`
- **Hard kill the wrapper**: `ALFRED_TEST_RUNNER_TIMEOUT_MS` (prints `lastFile=...`)

The canonical entrypoint is `scripts/test-bun.ts`.

## Scope selection

Test scope is chosen by naming conventions (plus directory segments):

- `*.integration.test.ts` or `/integration/` → integration
- `*.e2e.test.ts` or `/e2e/` → e2e
- `*.perf.test.ts` or `/perf/` → perf
- everything else → unit

Use `ALFRED_TEST_SCOPE=unit|integration|e2e|perf|all`.

## Module mocks (`mock.module()`)

`mock.module()` is process-global. Preferred strategies:

- **Per-file process isolation** for mock-heavy suites: `ALFRED_TEST_ISOLATE_FILES=1`
- Avoid async `mock.module()` factories (no `await import(...)` inside) to prevent module-eval deadlocks.
- Avoid leaking module singletons across tests; for singleton state, import a fresh copy via a cache-busting query (e.g. `...?t=<uuid>`).

## Common hang source: stdin

Completion/CLI libraries can resume stdin and keep the test process alive. Always pause stdin in teardown (`process.stdin.pause()`).
