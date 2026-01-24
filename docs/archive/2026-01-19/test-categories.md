# Test categories

ALFRED uses **filename conventions** and an explicit opt-in policy for slow suites.

## Categories

- **Unit**: default.
  - Naming: `*.test.ts`, `*.spec.ts` (and `__tests__`).
  - Must not require external services.
- **Integration**: explicit opt-in.
  - Naming: `*.integration.test.ts`, `*integration*.test.ts`, `test/integration/**`, `*postgres*.test.ts`.
  - May require real DBs, real workflow wiring, or other boundary components.
- **E2E (Bun)**: explicit opt-in.
  - Naming: `*.e2e.test.ts`, `test/e2e/**`.
- **Perf**: explicit opt-in.
  - Naming: `*.perf.test.ts`, `tests/perf/**`.

## Commands

From repo root (`/Users/jackmazac/Development/alfred`):

- **Fast (unit-only, default for pre-push)**:
  - `bun run test:fast`

- **Unit-only across all packages**:
  - `bun run test:unit`

- **Integration-only (Bun)**:
  - `bun run test:integration:bun`

- **E2E-only (Bun)**:
  - `bun run test:e2e:bun`

- **Perf-only (Bun)**:
  - `bun run test:perf:bun`

Playwright E2E lives under `apps/web/.tests/` and is run separately via the existing scripts (`test:mindscape:*`).

## Timeouts and hang guards

- All package test scripts run with `--timeout 60000` (per-test timeout).
- A process watchdog (`ALFRED_TEST_WATCHDOG_MS`, default 5 minutes) terminates stuck test processes.
- `@alfred/runtime` runs tests **one file per process** (`ALFRED_TEST_ISOLATE_FILES=1`) to prevent `mock.module()` cross-file pollution.
