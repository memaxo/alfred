# Testing Standards

1. **Runner and Coverage.** Use `bun test` for all packages. Maintain coverage for repos, routers, and schedulers. Use `tsc -b` for type checks in CI.

2. **Database Isolation.** Use `@alfred/test-kit/repo` (`createIsolatedDb`, `resetTables`) or ephemeral schemas/transactions. Reset tables between cases; no implicit globals or shared state.

3. **UI and E2E.** Use React Testing Library for logic/simple components and Playwright for complex interactions (drag-and-drop, focus). Mock auth (`Better Auth`) and use `VITE_TEST_MODE=true` for heavy visualizations.

4. **Canonical Fixtures.** Use `@alfred/test-kit` (e.g., `voice/runtime-fixture`, `workflow/runtime-fixture`) instead of bespoke mocks for pools, registries, or streaming. Always call cleanup (`restore()`/`stop()`).

5. **Sandbox and Cleanup.** Use `createTestSandbox()` or `os.tmpdir()` for temporary files. Never write to `packages/*/.*venv*/` or repository directories (except security boundary tests inside `process.cwd()`). Ensure `afterAll` hooks remove artifacts.

6. **Mocking Standards.** Mock native/WASM modules and external APIs. Import `@alfred/test-kit/redis` first. Prefer `@alfred/test-kit/router` (`createAuthedCaller`, `assertAuthGuard`, `assertPolicyEnforced`) and `@alfred/test-kit/scheduler` (`createMockTime`, `assertConcurrencyGuard`) over bespoke setup; use `mock-db-client`/`mock-metrics` where needed.

7. **Integration Strategy.** Prefer tests exercising real boundaries (DB, routers, flows) over narrow unit mocks. Use standalone verification scripts (`scripts/verify-*.ts`) for native/hardware integrations.

8. **Build Verification.** Run `scripts/verify-build.ts` in CI to scan client bundles for forbidden server-only strings (`postgres`, `drizzle-orm`, `openai`).

9. **E2E Isolation.** Run E2E tests on dynamically allocated ephemeral ports passed via environment variables to support concurrency.

10. **Autonomy and Logic.** Assert monotonic reactions, zero-effect on zero-reliability, and `[0,1]` clamps in cognitive suites.
