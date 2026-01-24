You are tasked with debugging the test environment for the 'alfred' monorepo, specifically the `apps/web` application which uses TanStack Start, Vite, and Bun.

## Context

The previous agent implemented a "Holonic Cognitive OS" feature set and created E2E tests in `apps/web/tests/holonic-interaction.spec.ts`. However, running these tests via `bunx playwright test` fails because the dev server (`bunx --bun vite dev`) encounters critical errors during startup.

## The Issues

### 1. Native Module ABI Mismatch (`node-pty`)

The logs show repeated errors regarding `node-pty`:

```
error: The module 'pty' was compiled against a different Node.js ABI version using NODE_MODULE_VERSION 115. This version of Bun requires NODE_MODULE_VERSION 137. Please try re-compiling or re-installing the module.
```

This suggests `node-pty` (likely a dependency of `codex` or another tool) needs to be rebuilt or re-installed to match the current Bun version.

### 2. TanStack Start / Vite Transpilation Error

There are runtime errors indicating server functions aren't being correctly processed or imported:

```
TypeError: (0,__vite_ssr_import_0__.createServerFn) is not a function
at apps/web/src/lib/mindscape/initial-frame.server.ts
...
at apps/web/src/routes/voice-s2s.tsx
```

This `createServerFn is not a function` error usually implies a mismatch between the server/client build handling in TanStack Start, or a Vite configuration issue where the `@tanstack/start` plugin isn't transforming the code as expected in the test environment.

## Your Task

1.  **Fix the ABI Mismatch:** Reinstall or rebuild `node-pty` (and potentially other native deps) to ensure they are compatible with the current Bun runtime.
2.  **Debug the Dev Server:** Investigate why `createServerFn` is undefined during the E2E test server startup. Check `vite.config.ts` and `app.config.ts` in `apps/web`.
3.  **Verify:** Successfully run the E2E tests:
    ```bash
    bunx playwright test apps/web/tests/holonic-interaction.spec.ts --config apps/web/playwright.config.ts
    ```

## Relevant Files

- `apps/web/vite.config.ts`
- `apps/web/app.config.ts`
- `apps/web/playwright.config.ts`
- `package.json` (and workspace `bun.lock`)
