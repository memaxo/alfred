# Testing Standards

1. **Bun test runner.** All packages run specs with `bun test` (Bun’s built-in runner). Author suites with `bun:test` APIs and keep coverage on every repo, router, and scheduler path, including Laminar fallbacks for eval flows.
2. **Integration smoke tests.** API routers should ship with request-level tests that exercise auth guards, scope requirements, and representative payloads.
3. **No implicit globals.** Tests must stub environment variables explicitly within the test file. Restore originals in `afterEach`.
4. **DB tests.** Use ephemeral schemas or transactions to keep tests isolated. Reset tables between cases.
5. **UI tests.** Critical screens (notes, reminders) require component-level tests verifying optimistic updates and error handling. Use React Testing Library.
6. **Automation.** Add new test commands to Turbo pipelines when you create packages so CI can run them consistently. Pair them with `tsc -b` checks (`bun run typecheck` or package-local `npm run typecheck`) so type errors surface alongside failing tests.
7. **Shared DB harness.** When a suite touches Postgres, instantiate connections through `createTestDb`/`closeTestDb` (`packages/api/test/utils/db.ts`). Use that Drizzle client to truncate tables between tests so no connections or data leak across cases.
8. **Real integration and e2e.** Prefer end-to-end and integration tests that exercise real boundaries (DB, routers, schedulers, UI flows) over narrow unit tests that only mock behaviour.
10. **Verification scripts.** Create standalone `scripts/test-<domain>.ts` for subsystems relying on native, hardware, or external environments (voice, docker, gpu) to verify integration health outside the test runner.
