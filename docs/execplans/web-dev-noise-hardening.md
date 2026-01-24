# Web dev + build noise hardening

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds, per `.agent/PLANS.md`.

This plan is explicitly downstream of (and must not weaken) `docs/execplans/ssr-hardening-plan.md`, which established ALFRED’s SSR “no server-only leakage” doctrine via variable-based dynamic imports in TanStack Start API routes.

## Purpose / Big Picture

After this change, running the web dev server and production build pipeline is quiet and deterministic: no unexpected errors, no avoidable warnings, and no noisy ERROR logs for optional subsystems when they are not enabled. SSR hardening guarantees remain intact: server-only packages stay externalized, and client bundles contain zero server-only leakage (enforced by `bun run verify:build`).

The user-visible proof is simple:

- Starting the dev server (`cd apps/web && bun run dev`) produces **zero avoidable warnings** and **zero ERROR logs** for expected missing optional dependencies (database not running, UV not installed).
- The SSR leakage scan still passes (`bun run verify:build`).
- The production smoke test still passes in a “no DB, no UV” environment (`bun run test:web:smoke:prod`).

## Progress

- (2026-01-13) Capture baseline noise from `apps/web` dev server output and classify each line as a true defect vs intentional tradeoff.
- (2026-01-13) Remove avoidable Vite dynamic-import analysis warnings without weakening SSR isolation (targeted `/* @vite-ignore */` only where the import is intentionally opaque).
- (2026-01-13) Remove TanStack Router “route exports will not be code-split” warnings by eliminating non-route exports from route modules (move or un-export).
- (2026-01-13) Ensure no test files live under `apps/web/src/routes/**`; move any existing tests out and add an automated guard that fails CI/tests if it regresses.
- (2026-01-13) Make optional subsystems quiet-by-default:
  - Voice pools must not attempt local init unless explicitly enabled.
  - DB-dependent services must short-circuit cleanly behind `isDbAvailable()` and not emit ERROR logs during normal dev when DB is absent.
- (2026-01-13) Add regression tests:
  - `isDbAvailable()` and `isUvAvailable()` cannot return false positives.
  - A “dev-noise” suite that starts/stops the dev server (or a minimal SSR entry) and asserts no ERROR-level logs for missing optional deps.
- (2026-01-13) Update `docs/troubleshooting/dev-errors.md` to document the new baseline (“quiet by default; errors only when opted in”), plus the env flags that opt in to noisy subsystems.
- (2026-01-13) Run end-to-end validation commands and record short transcripts in this plan.

## Surprises & Discoveries

- Observation: Vite warns for variable-based dynamic imports even when the module specifier is a `const` string.
  Evidence: The current API route files use `const pkg = "..."; await import(pkg)` and still trigger “dynamic import cannot be analyzed” warnings.
- Observation: `packages/api/src/init.ts` currently defaults `VOICE_PROVIDER` to `"maya1"`, which makes UV absence part of the common-path dev startup.
  Evidence: `packages/api/src/init.ts` reads `process.env.VOICE_PROVIDER ?? "maya1"`.

## Decision Log

- Decision: Treat variable-based dynamic import warnings as “intentional tradeoff” and suppress them at the callsite using `/* @vite-ignore */`, rather than changing import patterns.
  Rationale: String-literal dynamic imports can be statically analyzed by Vite and risk reintroducing SSR leakage or bundling. The existing SSR hardening doctrine requires imports to remain opaque to Vite’s analyzer.
  Date/Author: 2026-01-13 / agent
- Decision: Make local-voice initialization opt-in by defaulting `VOICE_PROVIDER` to a cloud provider (`"openai"`) in service init, while preserving explicit local providers (`"maya1"`, `"supertonic"`) when configured.
  Rationale: “Quiet by default” requires that missing UV does not produce warnings/errors unless the user chose a local voice provider.
  Date/Author: 2026-01-13 / agent

## Outcomes & Retrospective

TBD.

## Context and Orientation

ALFRED’s web app lives under `apps/web` and is a TanStack Start (TanStack Router + Vite SSR) application. It contains API routes under `apps/web/src/routes/api/**` that run on the server during SSR and must not leak server-only dependencies into client bundles.

Key systems involved:

- `apps/web/vite.config.ts` controls SSR externalization and client bundle behavior. It already externalizes server-only packages (e.g. `@alfred/db`, `@alfred/agent`) and uses `vite-tsconfig-paths` scoped to the web `tsconfig.json`.
- `docs/execplans/ssr-hardening-plan.md` documents why API routes use variable-based dynamic imports (to prevent Vite from statically analyzing/bundling server-only code).
- `packages/api/src/init.ts` is the API service initializer that starts optional background workers and optional voice pools. This must behave well under Vite dev SSR/HMR shutdown.
- `packages/api/src/utils/service-availability.ts` provides `isDbAvailable()` and `isUvAvailable()`; false positives here cause noisy ERROR logs and unstable dev startup.

Definitions used in this plan:

- “True defect”: a crash, stack trace, incorrect state, broken shutdown (e.g. “Vite module runner has been closed” surfacing as an uncaught error), false-positive availability checks, or ERROR logs for optional subsystems on the default path.
- “Intentional tradeoff”: warnings or constraints produced because we deliberately keep imports opaque to Vite to preserve SSR isolation (variable-based `import(pkg)`).
- “Safe suppression”: a targeted suppression that only affects Vite’s static analyzer (e.g. `/* @vite-ignore */`), without changing runtime behavior or bundling guarantees.

## Plan of Work

First, capture the exact noise surface by running `cd apps/web && bun run dev` and recording warnings/errors. Classify each entry as either a true defect (must be fixed) or an intentional tradeoff (must be eliminated if avoidable, otherwise suppressed safely and documented).

Then execute the hardening in three threads, keeping SSR guarantees intact:

1. Vite import-analysis noise: add `/* @vite-ignore */` at the specific dynamic import callsites that intentionally use variable-based module specifiers. The goal is zero “dynamic import cannot be analyzed” warnings, without converting to string-literal imports.
2. TanStack Router code-splitting noise: remove non-route exports from route modules that trigger “exports will not be code-split” warnings. Route modules should typically export only `Route` and keep component helpers un-exported, or move helpers to non-route modules.
3. Optional subsystem noise: ensure “missing optional dependency” scenarios produce at most a single WARN/INFO log and never emit ERROR logs unless the subsystem was explicitly enabled (via env flags or provider selection). Fix any false positives in availability checks and add regression tests.

Finally, enforce the baseline with automated tests and guards, and update troubleshooting docs to describe the new expected behavior and opt-in flags.

## Concrete Steps

All commands are from the repository root unless otherwise specified.

- Baseline capture:
  - `cd apps/web && bun run dev`
  - Observe logs for:
    - Vite dynamic import analysis warnings
    - TanStack Router route warnings (route-piece, code-splitting)
    - ERROR logs for DB/UV absence
    - shutdown/HMR errors
- Implement and validate iteratively:
  - `bun run verify:build`
  - `bun run test:web:smoke:prod`
  - `cd apps/web && bun test` (web package test runner wrapper)

## Validation and Acceptance

Acceptance is met when all of the following are true:

- `cd apps/web && bun run dev` produces:
  - zero tsconfig parsing errors
  - zero TanStack Router “route file does not contain any route piece” warnings
  - zero TanStack Router “exports will not be code-split” warnings
  - zero Vite “dynamic import cannot be analyzed” warnings, unless each remaining warning has a documented rationale and a deliberate suppression
  - zero ERROR logs for expected missing optional dependencies (DB not running, UV missing)
  - no uncaught errors during shutdown/reload (including “Vite module runner has been closed”)
- `bun run verify:build` passes (no server-only leakage).
- `bun run test:web:smoke:prod` passes in a “no DB, no UV” environment.

## Idempotence and Recovery

All changes are safe to re-run:

- Adding `/* @vite-ignore */` is a no-op at runtime and only affects Vite’s analyzer.
- Moving tests out of `apps/web/src/routes/**` is reversible and does not change runtime behavior.
- Optional subsystem gating is controlled by environment variables; reverting to “enabled” behavior is done by setting those flags explicitly.

If a dev server becomes noisy again, re-run the baseline capture step and compare against this plan’s recorded suppression list and logging policy.

## Artifacts and Notes

This section will be populated with short transcripts proving:

- pre-change baseline logs (representative warnings/errors)
- post-change dev server startup/shutdown logs
- `verify:build` and `test:web:smoke:prod` pass outputs
