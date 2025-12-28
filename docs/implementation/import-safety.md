# import-safety

Keep ALFRED’s packages safe to `import()` in short-lived scripts and CLIs. Importing an entrypoint (for example `@alfred/api/router`) must not start services, spawn subprocesses, or keep the event loop alive.

## What can go wrong

- Import-time timers (for example default Prometheus collectors) keep `bun -e` processes alive.
- Import-time “auto init” work starts background pools/workers unexpectedly (voice models, schedulers, cleanup loops).

## Canonical patterns

- **Explicit init**: start services only inside an explicit `init*()` function, never at module top-level.
- **Gate auto-init**: allow disabling back-compat auto init with `ALFRED_API_AUTO_INIT=false`.
- **Unref timers**: if a background interval exists, call `.unref()` so it won’t block process exit.
- **Lazy imports**: keep heavy modules behind `await import()` inside handlers/routes.

## Verification

- **Import test**: `packages/api/test/imports.test.ts` asserts key imports exit quickly and don’t leak handles.

