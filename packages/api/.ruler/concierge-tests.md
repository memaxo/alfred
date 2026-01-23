# Concierge Tests (API)

1. **Auth tests.** Every new router must ship at least one `UNAUTHORIZED` test using `createUnauthedCaller()`.
2. **Validation tests.** Add edge-case tests for UUID fields and numeric bounds (min/max) so schema drift fails fast.
3. **Subscription tests.** Subscription routers must be tested end-to-end via `toObservable(await caller.<router>.subscribe())`, not by unit-testing internal pubsub functions.
4. **Mock hygiene.** Avoid new `mock.module()` usage in Concierge tests; prefer the shared `mock-db-client` shim and per-test data isolation.
5. **Deterministic async.** If a service fires persistence in the background, provide a test-only injection point to await it (no `setTimeout()` sleeps).

