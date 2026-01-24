# E2E Test Automation

## Overview

E2E tests for the `web` application are automated using a custom script that manages ephemeral port allocation and isolated dev server instances. This ensures that:

1.  Concurrent test runs (e.g., by different agents or CI jobs) do not conflict on port binding.
2.  Tests run against a fresh, isolated instance of the application.
3.  Server-side code (TanStack Start) is correctly bundled and executed in the test environment.

## How to Run

To run the full E2E suite with automatic port allocation:

```bash
cd apps/web
bun run test:e2e:auto
```

This script (`apps/web/scripts/test-e2e.ts`) performs the following steps:

1.  **Port Discovery**: Scans for an available port in the range 3100-3200.
2.  **Process Spawning**: Spawns `bunx playwright test` with the `MINDSCAPE_PORT` environment variable set to the allocated port.
3.  **Config Integration**: `playwright.config.ts` reads `MINDSCAPE_PORT` and spins up the dev server (`bun run dev:test`) on that specific port.

## Architecture

### Port Isolation

- **Script**: `apps/web/scripts/test-e2e.ts`
- **Range**: 3100-3200 (default)
- **Mechanism**: Attempts to bind a temporary server to each port. If successful, the port is free.

### Playwright Configuration

- **File**: `apps/web/playwright.config.ts`
- **WebServer**: Configured to launch `bun run dev:test` with `--port=PORT`.
- **Base URL**: Dynamically set to `http://127.0.0.1:PORT`.

### Backend Compatibility

- **Dynamic Imports**: Server-side code (e.g., `initial-frame.server.ts`) uses string literals for local imports (e.g., `await import("./ascii")`) to ensure Vite can resolve them during the test build.
- **Performance**: Critical paths (e.g., graph snapshots) use direct Drizzle queries to bypass potential repository overhead in the test environment.

## Regression Prevention

- **Ruler**: `.ruler/05-testing.md` mandates the use of ephemeral ports for E2E tests.
- **CI**: GitHub Actions should execute `test:e2e:auto` to verify the entire stack.

## Troubleshooting

- **"Protocol error: Cannot navigate to invalid URL"**: Usually means the dev server failed to start or the port was taken after allocation (rare). Check the console logs for dev server errors.
- **"Server Fn Error" / "ERR_MODULE_NOT_FOUND"**: Indicates a bundling issue with server-only modules. Ensure dynamic imports use string literals or are properly externalized in `vite.config.ts`.
