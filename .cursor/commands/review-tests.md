# Review Tests

## Overview
Review tests for a specific feature to identify over-mocking, testing gaps, and anti-patterns.

## Scope
Identify test files for the feature:
```bash
# Find test files
fd "test|spec" --extension ts packages/<package>/
```

## Test Quality Checklist

### Over-Mocking Red Flags

#### Mocking Implementation Details
- [ ] Mocking internal functions that aren't boundaries
- [ ] Mocking the thing being tested
- [ ] Mocking simple utility functions
- [ ] Mock setup longer than test logic

```typescript
// BAD: Mocking implementation detail
mock.module("../utils/format", () => ({
  formatDate: () => "2024-01-01",
}));

// GOOD: Test the real formatting
expect(formatDate(new Date("2024-01-01"))).toBe("Jan 1, 2024");
```

#### Mock Everything Pattern
- [ ] Every import is mocked
- [ ] No real code executes in test
- [ ] Tests pass but code is broken

```typescript
// BAD: Testing mocks, not code
mock.module("@alfred/db/repo/rag", () => ({
  createDocument: mock(() => ({ id: "123" })),
  addChunks: mock(() => []),
  getChunks: mock(() => []),
}));
// This test proves nothing about the actual repo

// GOOD: Integration test with real DB (or test repo logic directly)
```

### What SHOULD Be Mocked

#### Appropriate Mocks
- [x] External APIs (`@alfred/auth/token`, Linear, OpenAI)
- [x] Database connections (for unit tests)
- [x] File system (for unit tests)
- [x] Time-dependent functions (`Date.now()`)
- [x] Network requests

#### Should NOT Be Mocked
- [ ] Pure functions
- [ ] Simple transformations
- [ ] The module under test
- [ ] Type guards and validators

### Testing Gaps

#### Coverage Gaps
- [ ] Happy path only (no error cases)
- [ ] No edge cases (empty inputs, nulls, boundaries)
- [ ] No integration between components
- [ ] Missing permission/auth tests

#### Behavioral Gaps
- [ ] State changes not verified
- [ ] Side effects not checked
- [ ] Return values not asserted
- [ ] Error messages not validated

### Test Structure Issues

#### Anti-Patterns
- [ ] Tests depend on execution order
- [ ] Shared mutable state between tests
- [ ] No `beforeEach` reset of mocks
- [ ] Assertions in loops without clear failure messages
- [ ] Magic numbers without explanation

#### Missing Categories
For any feature, tests should cover:
1. **Schema validation** - Invalid inputs rejected
2. **Policy enforcement** - Auth required, scopes checked
3. **Successful execution** - Happy path works
4. **Error handling** - Failures handled gracefully
5. **Edge cases** - Boundaries, empty, null

## Review Output

### Format
```markdown
## Test Review: [feature]

### Over-Mocking Issues
1. **[test file:line]** - [What's over-mocked]
   - Impact: Tests pass but [real issue] not caught
   - Fix: [Use real implementation / integration test]

### Testing Gaps
1. **Missing: [scenario]**
   - Risk: [What could break undetected]
   - Add test for: [specific case]

### Anti-Patterns
1. **[test file:line]** - [Pattern]
   - Fix: [Correction]

### Recommendations
1. Add integration test for [flow]
2. Remove mock for [module] and test directly
3. Add error case tests for [scenarios]
```

## ALFRED-Specific Test Patterns

### Good Patterns (from codebase)
```typescript
// Reset mocks properly
beforeEach(() => {
  mockFunction.mockReset();
  mockFunction.mockResolvedValue({ success: true });
});

// Test schema validation
it("rejects invalid input", () => {
  const result = schema.safeParse({ bad: "data" });
  expect(result.success).toBe(false);
});

// Test policy enforcement
it("enforces policy", async () => {
  mockPolicy.mockRejectedValue(new Error("unauthorized"));
  await expect(tool.execute({ input })).rejects.toThrow("unauthorized");
});
```

### Reference Files
- `packages/agent/test/rag.test.ts` - Good tool test structure
- `packages/api/test/*.test.ts` - Router test patterns
