# Testing Standards

1. **Vitest first.** Each repo, router, and scheduler module requires Vitest coverage proving the main execution paths succeed and error paths fail cleanly.
2. **Integration smoke tests.** API routers should ship with request-level tests that exercise auth guards, scope requirements, and representative payloads.
3. **No implicit globals.** Tests must stub environment variables explicitly within the test file. Restore originals in `afterEach`.
4. **DB tests.** Use ephemeral schemas or transactions to keep tests isolated. Reset tables between cases.
5. **UI tests.** Critical screens (notes, reminders) require component-level tests verifying optimistic updates and error handling. Use React Testing Library.
6. **Automation.** Add new test commands to Turbo pipelines when you create packages so CI can run them consistently.
