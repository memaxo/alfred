# Testing Standards

1. **Runner and Coverage.** Use `bun test` for all packages. Maintain coverage for repos, routers, and schedulers. Use `tsc -b` for type checks in CI.

2. **Fast by default (unit-only).** Local dev flows like `test:fast` and pre-push hooks must run **unit** tests only by default. Integration/E2E/perf suites must be explicit opt-in (via scripts or env flags).

3. **Canonical runner wrapper.** Prefer running tests via the repo wrapper `scripts/test-bun.ts` (not raw `bun test`) so we get:
   - deterministic scope selection via `ALFRED_TEST_SCOPE` (`unit|integration|e2e|perf|all`)
   - deterministic hang protection via timeouts (`ALFRED_TEST_*_TIMEOUT_MS`)
   - per-file isolation when needed (`ALFRED_TEST_ISOLATE_FILES=1`)

4. **Deterministic “no-hang” kill-switches.** Tests must never hang indefinitely:
   - per-test timeout: `bun test --timeout <ms>`
   - per-process watchdog: `ALFRED_TEST_WATCHDOG_MS` in a preload
   - hard kill of stuck child process: `ALFRED_TEST_RUN_TIMEOUT_MS` / `ALFRED_TEST_FILE_TIMEOUT_MS` in the wrapper
   - hard kill of the wrapper itself: `ALFRED_TEST_RUNNER_TIMEOUT_MS` with a “last file” breadcrumb

5. **`mock.module()` isolation.** Treat `mock.module()` as process-global. For packages with heavy `mock.module()` usage:
   - prefer **one test file per Bun process** (`ALFRED_TEST_ISOLATE_FILES=1`)
   - avoid async `mock.module()` factories; do not `await import(...)` inside the factory (can deadlock during module evaluation)
   - avoid relying on "reset" semantics for module mocks across files; use explicit isolation or well-scoped preloads.

6. **Dependency injection over mock.module().** Prefer DI via tRPC context for new tests:
   - define `RouterDeps` interface with injectable dependencies
   - inject deps via `ctx.deps` in routers instead of direct imports
   - pass mock deps to `createTestCaller({ deps: mockDeps })` in tests
   - see `docs/architecture/test-dependency-injection.md` for full pattern

7. **Database Isolation.** Use ephemeral schemas, transactions, or `createTestDb`/`closeTestDb`. Reset tables between cases; no implicit globals or shared state.

8. **UI and E2E.** Use React Testing Library for logic/simple components and Playwright for complex interactions (drag-and-drop, focus). Mock auth (`Better Auth`) and use `VITE_TEST_MODE=true` for heavy visualizations.

9. **Canonical Fixtures.** Use `@alfred/test-kit` (e.g., `voice/runtime-fixture`, `workflow/runtime-fixture`) instead of bespoke mocks for pools, registries, or streaming. Always call cleanup (`restore()`/`stop()`).

10. **Sandbox and Cleanup.** Use `createTestSandbox()` or `os.tmpdir()` for temporary files. Never write to `packages/*/.*venv*/` or repository directories (except security boundary tests inside `process.cwd()`). Ensure `afterAll` hooks remove artifacts.

11. **Mocking Standards.** Mock native/WASM modules and external APIs. Import `@alfred/test-kit/redis` first. Use `mock-db-client`, `mock-metrics`, and `router-helpers` for stable, auto-stubbed repos and metrics.

12. **Integration Strategy.** Prefer tests exercising real boundaries (DB, routers, flows) over narrow unit mocks. Use standalone verification scripts (`scripts/verify-*.ts`) for native/hardware integrations.

13. **Build Verification.** Run `scripts/verify-build.ts` in CI to scan client bundles for forbidden server-only strings (`postgres`, `drizzle-orm`, `openai`).

14. **E2E Isolation.** Run E2E tests on dynamically allocated ephemeral ports passed via environment variables to support concurrency.

15. **Autonomy and Logic.** Assert monotonic reactions, zero-effect on zero-reliability, and `[0,1]` clamps in cognitive suites.
