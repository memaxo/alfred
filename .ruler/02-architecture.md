# Architecture Guide

1. **Layering.** Follow the DB → repo → API → UI pipeline. DB exposes schema + migrations only. Repos shape persistence logic. API packages wrap repos with auth/context. Apps consume API via tRPC.
2. **Cross-package imports.** Packages may only depend inward (e.g. `apps/*` can import from `packages/*`, never the reverse). Shared types live in `packages/type`.
3. **Server-only modules.** `@alfred/db`, `pg`, and other Node dependencies must never reach `apps/web` client bundles. Use SSR externalisation and browser stubs where necessary.
4. **Env loading.** Each package loads its own `.env` file if it runs standalone. Never rely on a sibling package’s env loader.
5. **Background workers.** Schedulers and queues must guard execution behind explicit env flags (e.g. `SCHED_REMIND=1`). Multi-instance safety is a future concern—document the limitation.
6. **Observability.** Serve Prometheus metrics from `/api/metrics` (see `apps/web/src/routes/api/metrics.ts`) and declare them in the central registry (`packages/api/src/metrics.ts`). The baseline series now include `trpc_requests_total`, `health_checks_total{target,status}`, `policy_decisions_total{action,decision}`, `droid_exec_runs_total{auto,exit_code}`, the eval counters/histograms (`eval_runs_total`, `eval_duration_seconds`, `eval_scores_total`, `eval_failures_total`), and Laminar export gauges (`laminar_eval_datapoints_total`, `laminar_eval_errors_total`). Follow the same naming pattern for future additions.
7. **Health checks.** Expose `/healthz` (liveness) and `/healthz/deps` (Postgres + Redis readiness). Route handlers must increment `health_checks_total` with the appropriate labels.
8. **Type-check workflow.** Treat the repo as a solution-style TS project. Run `bun run typecheck` (root `tsc -b`) for CI and package-local `npm run typecheck` scripts where defined. New packages must opt into composite builds and add themselves to the root references list.
