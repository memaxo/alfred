# ExecPlan: SSR Hardening Plan

**Owner:** Infrastructure
**Status:** Mostly Complete ⚠️ (Build verification done; API route audit pending)

## Purpose

Harden SSR build process to prevent server-only code leakage into client bundles. Address Vite static analysis issues and browser-incompatible library imports.

## Learnings

1. **Client Bundle Leakage**: Server-only packages (like `@alfred/db`) were leaking into the client bundle because API routes were importing them at the top level. Even if used only in `server` handlers, Vite's static analysis attempts to bundle them.
2. **Vite Static Analysis**: Standard `await import("@alfred/db")` is not sufficient to prevent bundling. Vite statically analyzes string literals in dynamic imports.
3. **Browser-Incompatible Libraries**: `xterm.js` accesses `document` immediately upon import, causing SSR crashes if not strictly isolated.

## Progress

- [x] Build verification script created (`scripts/verify-build.ts`)
- [ ] Audit API routes for top-level server package imports
- [ ] Refactor to variable-based dynamic imports
- [ ] Add automated Playwright smoke tests against production build
- [x] Update `.ruler/21-tanstack-start.md` with new rules (rules 21-22 added)

## Implementation

- ✅ `scripts/verify-build.ts` exists and checks for forbidden strings in client bundles
- ✅ Rules documented in `.ruler/21-tanstack-start.md` (variable-based dynamic imports, browser-only libraries)
- ⚠️ API route audit pending (systematic scan needed)

## Remaining Work

- [ ] Audit `apps/web/src/routes/api` for top-level server package imports
- [ ] Refactor to variable-based dynamic imports
- [ ] Add Playwright smoke tests against production build

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
