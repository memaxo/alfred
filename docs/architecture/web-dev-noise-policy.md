# Web Dev Noise Policy

Owner: web, infra  
Last Updated: 2026-01-17

## Purpose

Keep the web dev server and production build pipeline **quiet by default** while preserving SSR hardening (no server-only leakage into client bundles).

## Scope

This policy targets:
- `cd apps/web && bun run dev`
- `bun run verify:build`
- `bun run test:web:smoke:prod`

## Definitions

- **True defect**: crash, stack trace, unhandled rejection, noisy `ERROR` log for an expected missing dependency, SSR/client leakage, route scanner warnings, or build failures.
- **Intentional tradeoff**: variable-based dynamic imports used to keep Vite from statically bundling server-only modules.

## Rules (generalized)

1. **Server-only packages stay external.**
   - `apps/web/vite.config.ts` must externalize server-only packages for SSR (`ssr.external`), including `@alfred/db`, `@alfred/agent`, `@alfred/policy`, `@alfred/runtime`, `@alfred/voice`, and `@alfred/api`.
   - Externalize `prom-client` to avoid browser-compatibility resolver warnings during client builds.

2. **No module-scope server imports in routes.**
   - API routes must not import server-only modules at module scope, even inside `server.handlers`.
   - Prefer variable-based dynamic import:
     - `const pkg = "@alfred/db"; await import(/* @vite-ignore */ pkg)`

3. **Suppress intentional Vite analyzer noise at the callsite.**
   - Any intentional variable-based `import()` must include `/* @vite-ignore */` to avoid “dynamic import cannot be analyzed” warnings.

4. **Route files export only `Route`.**
   - Do not export helper components/functions from route modules; this causes TanStack Router bundle warnings and defeats code splitting.

5. **Optional subsystems are WARN/INFO by default.**
   - Missing DB/UV must never emit `ERROR` logs on default dev startup.
   - Errors are reserved for explicitly enabled subsystems that still fail.
   - Gate DB recovery loops in dev behind `ENABLE_DB_RECOVERY=1`.

6. **Prefer fail-closed metrics imports.**
   - Never import `@alfred/api/metrics` at module scope in code that might run in the browser bundle; load it lazily inside server-only handlers using a variable-based dynamic import.

## Guards

- **Dev-noise guard**: `apps/web/src/tests/dev/noise.test.ts`
- **Route hygiene guard** (no tests under routes): `apps/web/src/tests/routes/hygiene.test.ts`
- **Leakage guard**: `bun run verify:build`
- **Prod smoke**: `bun run test:web:smoke:prod`

