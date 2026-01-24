# Run Tests

## Overview

Execute tests for a specific package or file and fix any failures systematically.

## Test Commands

### Run All Tests for a Package

```bash
bun test packages/<package>/test/
```

### Run Specific Test File

```bash
bun test packages/<package>/test/<file>.test.ts
```

### Run Tests Matching Pattern

```bash
bun test --grep "<pattern>"
```

### Run with Coverage

```bash
bun test --coverage
```

## Workflow

### 1. Run Tests

Execute relevant tests and capture output.

### 2. Analyze Failures

For each failure:

- Read the error message carefully
- Check if it's a test bug or implementation bug
- Look at the expected vs actual values

### 3. Fix Systematically

- Fix one failure at a time
- Re-run tests after each fix
- Don't move on until current fix passes

### 4. Verify All Pass

- Run the full test suite for the package
- Check for any flaky tests (run twice if suspicious)

## Common Test Patterns (ALFRED)

### Mocking Dependencies

```typescript
import { mock } from "bun:test";

// Mock before imports
const mockFunction = mock();
mock.module("@alfred/package", () => ({
  functionName: mockFunction,
}));

// Import after mocking
const { module } = await import("../src/module");
```

### Reset Mocks

```typescript
beforeEach(() => {
  mockFunction.mockReset();
  // Set up default successful responses
  mockFunction.mockResolvedValue({ success: true });
});
```

### Test Categories

- **Schema validation**: Test input validation
- **Policy enforcement**: Test auth/authz
- **Successful execution**: Test happy path
- **Error handling**: Test failure modes

## Troubleshooting

### Test Times Out

- Check for unresolved promises
- Look for missing mock implementations
- Increase timeout if legitimately slow

### Mock Not Working

- Ensure mock is defined before import
- Use `await import()` after `mock.module()`
- Check mock path matches exactly

### Flaky Tests

- Look for time-dependent code
- Check for shared state between tests
- Use `beforeEach` to reset state
