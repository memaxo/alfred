# tRPC Router Testing Patterns

1. **Use createTestCaller utility.** Import `createTestCaller` and `createUnauthedCaller` from `test/utils/trpc.ts` for authenticated and unauthenticated callers.

2. **Valid UUIDs required.** When testing endpoints with UUID parameters, use valid v4 UUIDs (version 4 in position 13, variant 8/9/a/b in position 17). Invalid: `11111111-1111-1111-1111-111111111111`. Valid: `11111111-1111-4111-8111-111111111111`.

3. **Mock at package boundary.** Use `mock.module("@alfred/db", () => ({ repo: { fn: vi.fn() } }))` to mock repository functions, not internal imports.

4. **Test auth consistently.** Every endpoint needs at minimum: (a) success case with authenticated user, (b) UNAUTHORIZED for unauthenticated caller.

5. **Test authorization.** For user-scoped resources, test FORBIDDEN when accessing another user's data by mocking a different `userId` in the returned data.

6. **Mock setup pattern.** Define mocks at module level, reset in `beforeEach` with `vi.clearAllMocks()`, reset in `afterEach` with `vi.resetAllMocks()`.

7. **Factory helpers for test data.** Create `createMockX(overrides)` functions that return valid default objects, allowing tests to override specific fields.

8. **Test error cases explicitly.** Test NOT_FOUND for missing resources, BAD_REQUEST for invalid state (e.g., already submitted), and validation errors for malformed input.

9. **Mock chaining for sequences.** Use `.mockResolvedValueOnce()` chain for tests that call the same mock multiple times with different expected results.

10. **Verify mock calls.** Use `expect(mockFn).toHaveBeenCalledWith(...)` to verify correct parameters were passed to repository functions.

11. **Router test file naming.** Use `<domain>.router.test.ts` pattern (e.g., `review.router.test.ts`, `note.router.test.ts`).

12. **Group tests by endpoint.** Use nested `describe` blocks: outer block for router name, inner blocks for each endpoint (`queue`, `submit`, `create`, etc.).
