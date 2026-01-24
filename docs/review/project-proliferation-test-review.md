# Test Review: Project Proliferation

**Date:** 2026-01-09  
**Scope:** Project proliferation test files

## Files Reviewed

- `packages/api/test/project.test.ts`
- `packages/api/test/scheduler/project-lifecycle.scheduler.test.ts`
- `packages/api/test/scheduler/pattern-lifecycle.scheduler.test.ts`

## Over-Mocking Analysis

### ✅ Appropriate Mocks

**Boundary Mocks (Correct):**

- `@alfred/db` repo functions (`getProjectById`, `archiveProject`) ✓
- `@alfred/db/repo/linear` (`getLinearByOAuth`) ✓
- `@alfred/plan` functions (`detectProject`, `linkLinearProject`) ✓
- `@linear/sdk` LinearClient ✓
- `@alfred/plan/pattern` (`managePatternLifecycle`) ✓

**Rationale:** These are external boundaries (DB, Linear API, plan package). Mocking is appropriate for unit tests.

### ✅ No Over-Mocking Issues

- Pure functions are not mocked ✓
- Implementation details are not mocked ✓
- Tests exercise real router logic ✓

## Testing Gaps

### 1. Missing Edge Cases: Project Router

**File:** `packages/api/test/project.test.ts`

**Missing Tests:**

1. **`linkLinear` - Linear installation missing `space`:**

   ```typescript
   it("throws PRECONDITION_FAILED when Linear installation has no space", async () => {
     mockGetLinearByOAuth.mockResolvedValue({
       token: "tk",
       space: null, // or undefined
     });
     // ... expect PRECONDITION_FAILED
   });
   ```

2. **`linkLinear` - `linkLinearProject` throws error:**

   ```typescript
   it("propagates errors from linkLinearProject", async () => {
     linkSpy.mockRejectedValue(new Error("linear_api_error"));
     // ... expect BAD_REQUEST with error message
   });
   ```

3. **`archive` - Missing reason parameter:**
   ```typescript
   it("archives project without reason", async () => {
     // Test that reason is optional
   });
   ```

**Risk:** Edge cases in Linear linking could fail silently or with unclear errors.

**Priority:** Medium

### 2. Missing Edge Cases: Project Lifecycle Scheduler

**File:** `packages/api/test/scheduler/project-lifecycle.scheduler.test.ts`

**Missing Tests:**

1. **Concurrent execution prevention:**

   ```typescript
   it("skips tick when already running", async () => {
     // Start tick, verify running flag prevents concurrent execution
   });
   ```

2. **Partial batch failure:**

   ```typescript
   it("continues archiving when one project fails", async () => {
     listInactiveProjectIdsMock.mockResolvedValue(["proj-1", "proj-2"]);
     archiveProjectMock
       .mockRejectedValueOnce(new Error("db_error"))
       .mockResolvedValueOnce(undefined);
     // Verify both attempts made, error logged
   });
   ```

3. **Empty batch handling:**
   ```typescript
   it("handles empty inactive project list", async () => {
     listInactiveProjectIdsMock.mockResolvedValue([]);
     // Verify no archive calls, no errors
   });
   ```

**Risk:** Scheduler could deadlock or fail silently on partial errors.

**Priority:** Medium

### 3. Missing Edge Cases: Pattern Lifecycle Scheduler

**File:** `packages/api/test/scheduler/pattern-lifecycle.scheduler.test.ts`

**Missing Tests:**

1. **Concurrent execution prevention:**

   ```typescript
   it("skips tick when already running", async () => {
     // Similar to project lifecycle test
   });
   ```

2. **Error handling:**
   ```typescript
   it("logs error and continues scheduling on failure", async () => {
     managePatternLifecycleMock.mockRejectedValue(new Error("pattern_error"));
     // Verify error logged, scheduler continues
   });
   ```

**Risk:** Scheduler could deadlock or stop on errors.

**Priority:** Low (simpler scheduler, less critical)

## Test Structure

### ✅ Good Patterns

**Reset Mocks:**

```typescript
beforeEach(() => {
  mockProjectRepo.getProjectById.mockReset();
  // ... all mocks reset
});
```

**Cleanup:**

```typescript
afterEach(() => {
  stopProjectLifecycleScheduler();
  process.env.SCHED_PROJECT_LIFECYCLE = originalEnv;
});
```

**Assertions:**

- Clear expectations with descriptive messages ✓
- Proper error type checking (`expect(error).toBeInstanceOf(TRPCError)`) ✓

### ⚠️ Anti-Patterns Found

**1. Magic Numbers in Tests**

**File:** `packages/api/test/scheduler/project-lifecycle.scheduler.test.ts:76`

```typescript
expect(listInactiveProjectIdsMock).toHaveBeenCalledWith({
  olderThanMs: 1 * 24 * 60 * 60 * 1000, // Magic number
  limit: 10,
});
```

**Fix:** Extract constants:

```typescript
const DAY_MS = 24 * 60 * 60 * 1000;
expect(listInactiveProjectIdsMock).toHaveBeenCalledWith({
  olderThanMs: 1 * DAY_MS,
  limit: 10,
});
```

**Priority:** Low

**2. Test Timeouts**

**File:** `packages/api/test/scheduler/project-lifecycle.scheduler.test.ts:72`

```typescript
await new Promise((resolve) => setTimeout(resolve, 30)); // Arbitrary timeout
```

**Fix:** Use deterministic waiting or mock timers:

```typescript
// Option 1: Mock timers
vi.useFakeTimers();
startProjectLifecycleScheduler({ intervalMs: 1000 });
vi.advanceTimersByTime(30);
vi.useRealTimers();

// Option 2: Wait for specific condition
await waitFor(() => {
  expect(listInactiveProjectIdsMock).toHaveBeenCalled();
});
```

**Priority:** Low (current tests work, but flaky)

## Coverage Gaps

### Missing Test Categories

**Project Router:**

- [ ] Schema validation (invalid UUIDs, empty strings)
- [ ] Permission checks (all procedures verify ownership)
- [ ] Error message format validation

**Schedulers:**

- [ ] Scheduler lifecycle (start/stop multiple times)
- [ ] Environment variable edge cases (empty string, "0", "true")
- [ ] Logger interface compliance

## Recommendations

### High Priority

1. **Add edge case tests for `linkLinear`:**
   - Missing Linear space ID
   - `linkLinearProject` error propagation
   - Invalid Linear project ID format

2. **Add concurrent execution tests for schedulers:**
   - Verify `running` flag prevents concurrent ticks
   - Test scheduler restart behavior

### Medium Priority

3. **Add partial failure tests:**
   - Scheduler continues on individual project archive failures
   - Error logging for failed operations

4. **Extract test constants:**
   - Replace magic numbers with named constants
   - Use deterministic timing or mock timers

### Low Priority

5. **Add schema validation tests:**
   - Invalid input formats
   - Boundary values (empty strings, max lengths)

6. **Add logger interface tests:**
   - Verify logger methods are called correctly
   - Test logger error handling

## Summary

**Overall Test Quality: Good**

- ✅ Appropriate mocking of boundaries
- ✅ Good test structure and cleanup
- ✅ Core functionality covered

**Gaps:**

- ⚠️ Missing edge case tests (Linear linking, scheduler concurrency)
- ⚠️ Magic numbers in assertions
- ⚠️ Flaky timing in scheduler tests

**Recommendations:**

- Add edge case tests for Linear linking (high priority)
- Add concurrent execution tests for schedulers (high priority)
- Extract constants and use deterministic timing (medium priority)
