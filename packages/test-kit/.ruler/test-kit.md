# Test Harness & Fixtures

1. **Canonical Fixtures.** Use shared fixtures from `@alfred/test-kit` (e.g., `createTestSession`, `mockWorkflowRepo`). Never invent ad-hoc mocks for core services.

2. **Sandbox Isolation.** Use `createTestSandbox()` for file system operations. Failed tests must not leave artifacts in the repository.

3. **Mocking Standards.** Use `mock.module()` for stable, auto-stubbed dependencies. Always call `mockReset()` in `beforeEach`.

4. **Deterministic Time.** Pass explicit timestamps to functions instead of relying on `Date.now()` inside implementation.

5. **Fixture Structure.** Organize new fixtures under domain-matching folders (e.g., `src/auth/`, `src/voice/`). Export from the central `index.ts`.
