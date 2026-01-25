# Import Safety

## Core Principle

Importing a package must be fast, side-effect free, and allow short-lived scripts (e.g., `bun -e`) to exit immediately.

## Rules

1. **No import-time work.** Do not start timers, workers, servers, subprocesses, or model/pool initialization at module import time.
2. **Unref background handles.** Any `setInterval`/`setTimeout` created for long-lived services must call `.unref()` so it does not keep the process alive.
3. **Metrics are opt-in.** Never call `prom-client.collectDefaultMetrics()` at import time; expose an explicit `startDefaultMetrics()` and invoke it from service init only.
4. **Gate auto-init.** Any “back-compat auto-init” entrypoint must be gated behind an env var (e.g., `ALFRED_API_AUTO_INIT=false` for import-only scripts).
5. **Test imports.** Add tests that `import()` key entrypoints and assert they exit quickly (time-bounded) and do not leak handles.
6. **CLI stdin cleanup.** Any CLI code that may resume `process.stdin` (completion libraries, interactive prompts) must call `process.stdin.pause()` in a `finally` or teardown hook so `bun test` processes can exit.
7. **Explicit subpath exports.** When a package is consumed via deep imports (e.g. `@pkg/auth/token`), add explicit `exports` entries for those exact paths; do not rely on wildcard exports being resolved consistently in all toolchains.

8. **Lazy init heavy validators.** Compile schema validators (Ajv/Zod) on first use and cache them; never at module import time.
