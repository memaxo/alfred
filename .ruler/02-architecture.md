# Architecture Guide

1. **Layering.** Follow the DB → repo → API → UI pipeline. DB exposes schema + migrations only. Repos shape persistence logic. API packages wrap repos with auth/context. Apps consume API via tRPC.
2. **Cross-package imports.** Packages may only depend inward (e.g. `apps/*` can import from `packages/*`, never the reverse). Shared types live in `packages/type`.
3. **Server-only modules.** `@alfred/db`, `pg`, and other Node dependencies must never reach `apps/web` client bundles. Use SSR externalisation and browser stubs where necessary.
4. **Env loading.** Each package loads its own `.env` file if it runs standalone. Never rely on a sibling package’s env loader.
5. **Background workers.** Schedulers and queues must guard execution behind explicit env flags (e.g. `SCHED_REMIND=1`). Multi-instance safety is a future concern—document the limitation.
6. **Observability.** Expose metrics via `@alfred/api/metrics` with Prometheus naming (`alfred_*`). Add new metrics through central registry helpers.
