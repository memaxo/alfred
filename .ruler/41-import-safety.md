# Import Safety

## Core Principle

Importing a package must be fast, side-effect free, and allow short-lived scripts (e.g., `bun -e`) to exit immediately.

## Rules

1. **No import-time work.** Do not start timers, workers, servers, subprocesses, or model/pool initialization at module import time.
2. **Unref background handles.** Any `setInterval`/`setTimeout` created for long-lived services must call `.unref()` so it does not keep the process alive.
3. **Metrics are opt-in.** Never call `prom-client.collectDefaultMetrics()` at import time; expose an explicit `startDefaultMetrics()` and invoke it from service init only.
4. **Gate auto-init.** Any “back-compat auto-init” entrypoint must be gated behind an env var (e.g., `ALFRED_API_AUTO_INIT=false` for import-only scripts).
5. **Test imports.** Add tests that `import()` key entrypoints and assert they exit quickly (time-bounded) and do not leak handles.

