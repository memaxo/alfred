# Test Review: AgentFS Router

## Overview
Review of `packages/api/test/agentfs.router.test.ts` for over-mocking, testing gaps, and anti-patterns.

## Over-Mocking Assessment

### ✅ Appropriate Mocks
The test correctly mocks `@alfred/agent/agentfs` (external SDK boundary). This is appropriate since:
- AgentFS SDK is an external dependency
- Tests should not require actual SQLite databases
- Mocking allows deterministic test behavior

### ⚠️ Minor Over-Mocking Concerns
1. **Mock setup redundancy** - `afterEach` sets up mocks that are already configured in individual tests (lines 53-61)
   - Impact: Unnecessary complexity, potential confusion
   - Fix: Remove redundant setup from `afterEach`, rely on individual test setup

## Testing Gaps

### Critical Missing Tests

#### 1. **Path Validation Edge Cases** (`isSafeAgentfsDbPath`)
Missing tests for:
- Path traversal attacks: `".agentfs/run-1/../../etc/passwd.db"`
- Wrong runId in path: `".agentfs/run-2/agent.db"` (when runId is "run-1")
- Missing `.db` extension: `".agentfs/run-1/agent"`
- Windows path separators: `".agentfs\\run-1\\agent.db"`
- Empty runId: `""`
- Very long runId (boundary: 200 chars)
- Very long dbPath (boundary: 500 chars)

**Risk**: Security vulnerability - path traversal could allow accessing arbitrary database files.

**Add tests for:**
```typescript
it("rejects path traversal in dbPath", async () => {
  await expect(
    caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-1/../../other/agent.db",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("rejects dbPath with wrong runId", async () => {
  await expect(
    caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-2/agent.db",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("rejects dbPath without .db extension", async () => {
  await expect(
    caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
```

#### 2. **Error Handling**
Missing tests for:
- `loadAgentfs()` fails (SDK open throws)
- `fsdb.fs.readdir()` fails
- `fsdb.fs.stat()` fails (already handled, but not tested)
- `fsdb.tools.getRecent()` fails
- `fsdb.kv.list()` fails
- `fsdb.close()` fails (should still return success)

**Risk**: Unhandled errors could crash the server or expose internal details.

**Add tests for:**
```typescript
it("handles AgentFS open failure gracefully", async () => {
  openMock.mockRejectedValue(new Error("db_open_failed"));
  await expect(
    caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
    })
  ).rejects.toThrow();
});

it("handles readdir failure", async () => {
  openMock.mockResolvedValue({
    fs: { readdir: vi.fn().mockRejectedValue(new Error("readdir_failed")), stat: statMock },
    tools: { getRecent: getRecentMock },
    kv: { list: kvListMock },
    close: closeMock,
  });
  await expect(
    caller.agentfs.snapshot({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
    })
  ).rejects.toThrow();
});
```

#### 3. **Schema Validation**
Missing tests for:
- Invalid `runId` (empty, too long, invalid chars)
- Invalid `dbPath` (empty, too long)
- Invalid `dir` (empty, too long, invalid format)
- Invalid `cursor` values (negative numbers, non-integers)
- Invalid `pollMs` (too small, too large, non-integer)

**Risk**: Invalid input could cause runtime errors or security issues.

**Add tests for:**
```typescript
it("rejects empty runId", async () => {
  await expect(
    caller.agentfs.snapshot({
      runId: "",
      dbPath: ".agentfs/run-1/agent.db",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("rejects runId exceeding max length", async () => {
  await expect(
    caller.agentfs.snapshot({
      runId: "a".repeat(201),
      dbPath: ".agentfs/run-1/agent.db",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("rejects negative cursor values", async () => {
  await expect(
    caller.agentfs.stream({
      runId: "run-1",
      dbPath: ".agentfs/run-1/agent.db",
      cursor: { toolCallId: -1 },
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
```

#### 4. **Helper Function Tests**
Missing unit tests for pure functions:
- `sanitizeRunId()` - edge cases (special chars, unicode, empty)
- `nextCursor()` - all update combinations, null handling
- `toDirEntry()` - null stat, missing properties, type coercion

**Risk**: Bugs in helper functions could cause subtle data corruption.

**Add tests for:**
```typescript
describe("sanitizeRunId", () => {
  it("sanitizes special characters", () => {
    expect(sanitizeRunId("run@123#test")).toBe("run-123-test");
  });
  
  it("handles unicode characters", () => {
    expect(sanitizeRunId("run-测试")).toBe("run--");
  });
});

describe("nextCursor", () => {
  it("updates toolCallId when provided", () => {
    const result = nextCursor({ toolCallId: 5 }, { toolCallId: 10 });
    expect(result.toolCallId).toBe(10);
  });
  
  it("preserves existing values when update is undefined", () => {
    const result = nextCursor({ toolCallId: 5, toolCallSince: 100 }, {});
    expect(result.toolCallId).toBe(5);
    expect(result.toolCallSince).toBe(100);
  });
});
```

#### 5. **Stream Subscription Edge Cases**
Missing tests for:
- Stream error recovery (emits error but continues)
- Concurrent subscriptions to same dbPath
- Subscription cleanup when dbPath becomes invalid
- Poll interval edge cases (min 200ms, max 5000ms)
- Stream completion after MAX_EVENTS (already tested, but could be more thorough)

**Risk**: Memory leaks, resource exhaustion, or incorrect behavior under load.

**Add tests for:**
```typescript
it("recovers from stream errors", async () => {
  let callCount = 0;
  readdirMock.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      throw new Error("temporary_error");
    }
    return ["a.txt"];
  });
  
  // Should emit error but continue polling
  const sub = await caller.agentfs.stream({
    runId: "run-1",
    dbPath: ".agentfs/run-1/agent.db",
    pollMs: 200,
  });
  
  // Verify error event then recovery
  // ... test implementation
});
```

#### 6. **Data Transformation Tests**
Missing tests for:
- Empty directories (`readdir` returns `[]`)
- Empty tool calls (`getRecent` returns `[]`)
- Empty KV store (`kv.list()` returns `[]`)
- Tool calls with null/undefined error fields
- KV entries with missing timestamps
- Large datasets (boundary: 200 tool calls limit)

**Risk**: Edge cases could cause crashes or incorrect data representation.

## Anti-Patterns

### 1. **Fragile Async Coordination** (Line 151)
```typescript
await new Promise((r) => setTimeout(r, 10));
```
**Issue**: Using `setTimeout` for async coordination is fragile and timing-dependent.

**Fix**: Use proper promise-based coordination or event-driven approach:
```typescript
// Better: Wait for actual close completion
await new Promise<void>((resolve) => {
  if (closeMock.mock.calls.length > 0) {
    resolve();
  } else {
    // Poll or use proper event mechanism
    const checkInterval = setInterval(() => {
      if (closeMock.mock.calls.length > 0) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 5);
  }
});
```

### 2. **Redundant Mock Setup** (Lines 53-61)
The `afterEach` hook sets up mocks that are already configured in individual tests.

**Fix**: Remove redundant setup, rely on individual test configuration:
```typescript
afterEach(() => {
  vi.clearAllMocks();
  // Remove mock setup - each test should configure its own mocks
});
```

### 3. **Missing Environment Variable Cleanup** (Line 192-237)
The MAX_EVENTS test modifies `process.env` but cleanup is in a `finally` block. This is correct, but could be extracted to a helper.

**Suggestion**: Use `withEnv` helper from `test/utils/mocks.ts`:
```typescript
it("enforces a MAX_EVENTS safeguard", async () => {
  await withEnv({ ALFRED_AGENTFS_MAX_EVENTS: "1" }, async () => {
    // test implementation
  });
});
```

### 4. **Incomplete Assertions**
Some tests don't verify all return fields:
- Missing assertion for `ts` timestamp
- Missing assertion for cursor structure completeness
- Missing assertion for entry structure (ino, isDirectory, etc.)

**Fix**: Add comprehensive assertions:
```typescript
expect(res.ts).toBeGreaterThan(0);
expect(res.cursor).toMatchObject({
  toolCallId: expect.any(Number),
  toolCallSince: expect.any(Number),
  kvUpdatedAt: expect.any(Number),
});
expect(res.entries[0]).toMatchObject({
  name: expect.any(String),
  ino: expect.any(Number),
  isDirectory: expect.any(Boolean),
});
```

## Recommendations

### High Priority
1. **Add path validation security tests** - Critical for preventing path traversal attacks
2. **Add error handling tests** - Ensure graceful failure handling
3. **Add schema validation tests** - Prevent invalid input from causing crashes
4. **Fix fragile async coordination** - Use proper promise-based patterns

### Medium Priority
5. **Add helper function unit tests** - Test pure functions in isolation
6. **Add edge case tests** - Empty data, boundaries, null handling
7. **Remove redundant mock setup** - Simplify test structure

### Low Priority
8. **Extract environment variable helpers** - Use `withEnv` consistently
9. **Add comprehensive assertions** - Verify all return fields
10. **Add stream error recovery tests** - Test resilience under failure

## Test Coverage Estimate

**Current Coverage**: ~60%
- ✅ Auth/scope enforcement
- ✅ Basic happy path
- ✅ Cursor filtering
- ✅ MAX_EVENTS safeguard
- ❌ Path validation edge cases
- ❌ Error handling
- ❌ Schema validation
- ❌ Helper functions
- ❌ Stream error recovery

**Target Coverage**: ~90%
- Add missing categories above
- Integration test with real AgentFS (optional, for critical paths)

## ALFRED Conventions Compliance

### ✅ Good Patterns Used
- Proper auth/scope testing
- Mock external boundaries appropriately
- Test policy enforcement

### ⚠️ Areas for Improvement
- Add more error case tests
- Test pure helper functions directly
- Use proper async coordination patterns
- Add security-focused path validation tests
