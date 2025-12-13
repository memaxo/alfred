# ExecPlan: SSR Hardening Plan

**Owner:** Infrastructure
**Status:** Complete ✅

## Purpose

Harden SSR build process to prevent server-only code leakage into client bundles. Address Vite static analysis issues and browser-incompatible library imports.

## Learnings

1. **Client Bundle Leakage**: Server-only packages (like `@alfred/db`) were leaking into the client bundle because API routes were importing them at the top level. Even if used only in `server` handlers, Vite's static analysis attempts to bundle them.
2. **Vite Static Analysis**: Standard `await import("@alfred/db")` is not sufficient to prevent bundling. Vite statically analyzes string literals in dynamic imports.
3. **Browser-Incompatible Libraries**: `xterm.js` accesses `document` immediately upon import, causing SSR crashes if not strictly isolated.

## Progress

- [x] Build verification script created (`scripts/verify-build.ts`)
- [x] Audit API routes for top-level server package imports (`apps/web/src/routes/api/**`)
- [x] Refactor to variable-based dynamic imports (no top-level server package imports in API routes)
- [x] Add automated Playwright smoke tests against production build
- [x] Update `.ruler/21-tanstack-start.md` with new rules (rules 21-22 added)

## Implementation

- ✅ `scripts/verify-build.ts` exists and checks for forbidden strings in client bundles
- ✅ Rules documented in `.ruler/21-tanstack-start.md` (variable-based dynamic imports, browser-only libraries)
- ✅ API routes refactored to avoid top-level server-only imports:
  - `apps/web/src/routes/api/workflow/stream.ts`
  - `apps/web/src/routes/api/auth/$.ts`
  - `apps/web/src/routes/api/linear/webhook.ts`
  - `apps/web/src/routes/api/search.ts`
- ✅ Production-build Playwright smoke coverage:
  - `apps/web/playwright.prod.config.ts`
  - `apps/web/tests/build.prod.smoke.spec.ts`
- ✅ SSR build reliability fixes discovered during verification:
  - Pin `better-auth` to `1.3.13` (restores `better-auth/plugins/passkey` export)
  - Align `@alfred/runtime` exports to source TS so Vite SSR can resolve entrypoints
  - Ensure `@alfred/api/src/metrics.ts` produces stable, local bindings for agent workflow metrics (prevents runtime `ReferenceError` in production server bundle)

## Remaining Work

- None.

## Outcomes & Retrospective

- **Outcome**: `apps/web/src/routes/api/**` no longer imports server-only packages at module scope; server dependencies are loaded via variable-based dynamic imports at request time.
- **Outcome**: Added a dedicated Playwright config that runs smoke checks against the production build (`vite build`) and boots the built SSR server via `bun dist/server/server.js` (not the dev server).
- **Outcome**: `bun run verify:build` and `bun run test:web:smoke:prod` both pass in CI-like conditions (no DB, no UV).

## Rules

## .ruler/21-tanstack-start.md (Additions)

21. **Variable-Based Dynamic Imports.** To prevent server-only code leakage into client bundles, imports of server packages (db, agent, policy) in API routes MUST use variable-based dynamic imports:
    ```typescript
    // ✅ CORRECT
    const dbPkg = "@alfred/db";
    const { db } = await import(dbPkg);

    // ❌ INCORRECT (Vite will bundle this)
    const { db } = await import("@alfred/db");
    ```

22. **Browser-Only Libraries.** Libraries that access `window` or `document` on import (e.g., `xterm`, `canvas-confetti`) MUST be imported dynamically inside `useEffect` or `componentDidMount`. Never import them at the top level of a component file.

## .ruler/02-architecture.md (Additions)

13. **Vite Externalization.** All server-only packages (`@alfred/db`, `@alfred/agent`, `@alfred/policy`) MUST be explicitly listed in `ssr.external` in `apps/web/vite.config.ts` to ensure they remain external during SSR.

# Next Steps for Hardening

1.  **Audit API Routes**: Systematically scan `apps/web/src/routes/api` for top-level imports of `@alfred/*` server packages and refactor them to use the variable-based dynamic import pattern.
2.  **Build Verification Script**: Create a CI script (`scripts/verify-build.ts`) that runs `vite build` for the web app and analyzes the output bundle. Fail the build if strings like "drizzle-orm", "postgres", or "openai" are found in the client chunks.
3.  **Automated Test Suite**: Create a lightweight "Smoke Test" Playwright suite that runs against the **production build** (not just dev server) to catch bundling issues early.
