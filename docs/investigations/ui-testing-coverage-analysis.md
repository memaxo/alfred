# UI Testing Coverage Analysis

**Date:** 2025-01-27  
**Scope:** `apps/web` UI testing coverage assessment  
**Objective:** Assess real (minimal mock) testing for UI components, identify gaps, and recommend improvements

---

## Executive Summary

The ALFRED web app has **8 test files** covering components, hooks, and routes. Testing is primarily **unit-level with heavy mocking** of tRPC and hooks. **No E2E tests exist** for UI flows, and **integration tests are limited** to component-hook integration without real network calls.

**Key Findings:**
- ✅ Good unit test coverage for core components (`Chat`, `Actions`, `ChatContainer`)
- ⚠️ Integration tests mock tRPC/hooks (not real implementations)
- ❌ No E2E tests for UI flows (notes, reminders, chat, workflows)
- ❌ No smoke tests for critical screens
- ⚠️ Route tests heavily mock tRPC (profile, privacy, preferences)
- ❌ Missing tests for critical flows (authentication, notes CRUD, reminders, workflows)

---

## 1. Test Classification Analysis

### 1.1 Test Files Inventory

| File | Type | Mock Level | Test Type | Coverage Scope |
|------|------|------------|-----------|----------------|
| `chat-container.integration.test.tsx` | Integration | **Heavy** | Integration | Component + Hook (mocked) |
| `chat-container.test.tsx` | Unit | **Heavy** | Unit | Component isolation |
| `chat.test.tsx` | Unit | **Minimal** | Unit | Pure component rendering |
| `actions.test.tsx` | Unit | **No mock** | Unit | Pure component rendering |
| `use-assistant-stream.integration.test.tsx` | Integration | **Heavy** | Integration | Hook logic (no network) |
| `cache-merge.test.ts` | Unit | **No mock** | Unit | Pure utility functions |
| `profile.test.tsx` | Route | **Heavy** | Unit | Route component + mocked tRPC |
| `privacy.test.tsx` | Route | **Heavy** | Unit | Route component + mocked tRPC |
| `preferences.test.tsx` | Route | **Heavy** | Unit | Route component + mocked tRPC |

### 1.2 Mock Level Breakdown

#### Heavy Mock (6 files)
- **tRPC mocking**: All route tests (`profile`, `privacy`, `preferences`) mock `@/utils/trpc` with custom `trpcMock` objects
- **Hook mocking**: `chat-container.integration.test.tsx` mocks `@/hooks/use-assistant-stream`
- **Library mocking**: `react-virtuoso` mocked in chat tests (stub implementation)
- **Toast mocking**: `sonner` mocked in route tests

**Pattern:**
```typescript
mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));
mock.module("@/hooks/use-assistant-stream", () => ({ useAssistantStream: mockHook }));
```

#### Minimal Mock (1 file)
- **`chat.test.tsx`**: Only mocks `react-virtuoso` with stub (necessary for virtualization testing), uses real `Chat` component

#### No Mock (2 files)
- **`actions.test.tsx`**: Pure component test, no mocks
- **`cache-merge.test.ts`**: Pure utility function test, no mocks

### 1.3 Test Type Breakdown

#### Unit Tests (6 files)
- Component isolation: `chat.test.tsx`, `actions.test.tsx`, `chat-container.test.tsx`
- Hook logic: `use-assistant-stream.integration.test.tsx` (despite name, tests hook in isolation)
- Route components: `profile.test.tsx`, `privacy.test.tsx`, `preferences.test.tsx`
- Utilities: `cache-merge.test.ts`

#### Integration Tests (2 files)
- **`chat-container.integration.test.tsx`**: Tests `ChatContainer` + mocked `useAssistantStream` hook
  - ✅ Tests component-hook integration
  - ❌ Mocks the hook (not real implementation)
  - ❌ No real tRPC calls
  - ❌ No real network/streaming

- **`use-assistant-stream.integration.test.tsx`**: Tests hook logic without network
  - ✅ Tests message hydration, action derivation, clearing
  - ❌ No real tRPC streaming
  - ❌ No real EventSource/SSE
  - Note: Name suggests integration but tests hook in isolation

#### E2E Tests (0 files)
- ❌ No E2E tests for UI flows
- ❌ No tests with real HTTP server
- ❌ No tests with real tRPC client
- ❌ No tests with real database

#### Smoke Tests (0 files)
- ❌ No smoke tests for critical screens
- ❌ No "does it render" sanity checks
- Note: Backend has smoke tests (`packages/embed/test/smoke.test.ts`)

---

## 2. Integration Test Analysis

### 2.1 Current Integration Tests

#### `chat-container.integration.test.tsx`
**What it tests:**
- Component renders and accepts user input
- Messages are sent through mocked hook
- Clear button resets state
- Agent switching hydrates/clears state

**What's mocked:**
- `@/hooks/use-assistant-stream` - Complete mock implementation
- `react-virtuoso` - Stub component

**What's real:**
- `ChatContainer` component
- React rendering
- User interactions (fireEvent)

**Boundary:** Component → Mocked Hook (no tRPC, no network)

#### `use-assistant-stream.integration.test.tsx`
**What it tests:**
- Hook hydrates pre-existing messages
- Hook derives actions from tool call parts
- Hook clears messages and resets error state

**What's mocked:**
- Nothing explicitly (but no network calls)

**What's real:**
- Hook implementation (partial - no streaming)
- React hooks (`useState`, `useCallback`)

**Boundary:** Hook logic only (no tRPC, no streaming, no network)

### 2.2 Integration Test Gaps

**Missing Integration Tests:**
1. **Component + Real Hook**: `ChatContainer` with real `useAssistantStream` (mocked tRPC)
2. **Hook + Mocked tRPC**: `useAssistantStream` with mocked tRPC client (real React Query)
3. **Route + Real tRPC**: Route components with real tRPC calls (mocked server)
4. **Full Stack**: Component → Hook → tRPC → Server (mocked DB/external APIs)

**Current State:**
- Integration tests stop at component-hook boundary
- No integration tests crossing hook-tRPC boundary
- No integration tests crossing tRPC-server boundary

---

## 3. E2E Test Gap Analysis

### 3.1 Current E2E Tests

**UI E2E Tests:** ❌ None

**Backend E2E Tests:** ✅ `packages/embed/test/e2e.test.ts`
- Tests complete flow: ingest → embed → retrieve
- Uses real database, real embedding service
- No HTTP server (direct function calls)

### 3.2 E2E Test Infrastructure

**Documented but Unimplemented:**
- `apps/web/src/hooks/__tests__/e2e-trpc.md` describes desired E2E pattern
- Requires:
  1. Test server setup (HTTP server with tRPC handler)
  2. Test database (isolated schema)
  3. Mocked external APIs (OpenAI, Cohere)
  4. Real tRPC client (not mocked)
  5. Real EventSource for streaming

**Status:** Documented but not implemented (reason: "Requires test server infrastructure and longer execution time")

### 3.3 Missing E2E Tests

**Critical Flows Without E2E Tests:**

1. **Authentication Flow**
   - Sign-in → Session creation → Protected route access
   - Sign-up → Email verification → Profile setup

2. **Chat Flow**
   - Send message → tRPC call → Streaming response → UI update
   - Agent switching → State persistence → Hydration

3. **Notes Flow**
   - Create note → tRPC mutation → Database write → UI update
   - Read notes → tRPC query → Database read → List render
   - Update note → Optimistic update → Server sync → Error handling
   - Delete note → Confirmation → Database delete → UI removal

4. **Reminders Flow**
   - Create reminder → tRPC mutation → Database write → UI update
   - List reminders → tRPC query → Database read → List render
   - Complete reminder → Status update → UI refresh

5. **Workflows Flow**
   - Start workflow → tRPC call → Runtime execution → Status updates
   - Monitor workflow → Streaming events → UI updates
   - Complete workflow → Final state → UI refresh

6. **Settings Flow**
   - Update preferences → tRPC mutation → Database write → UI update
   - Update privacy → Policy check → Database write → UI update
   - Update profile → Validation → Database write → UI update

### 3.4 E2E Test Requirements

**Infrastructure Needed:**
1. **Test Server Utility**
   ```typescript
   async function createTestServer(): Promise<TestServer> {
     // Start Bun.serve with tRPC handler
     // Use test database
     // Mock external APIs
     // Return server instance with port
   }
   ```

2. **Test Client Utility**
   ```typescript
   function createTestClient(baseUrl: string): TRPCClient {
     // Create real tRPC client
     // Connect to test server
     // Return client instance
   }
   ```

3. **Database Isolation**
   - Use `createTestDb()` from `packages/api/test/utils/db.ts`
   - Truncate tables between tests
   - Isolated schema per test suite

4. **Authentication Mock**
   - Create test sessions
   - Mock Better Auth for E2E tests
   - Provide authenticated context

---

## 4. Smoke Test Analysis

### 4.1 Current Smoke Tests

**UI Smoke Tests:** ❌ None

**Backend Smoke Tests:** ✅ `packages/embed/test/smoke.test.ts`
- Quick sanity check: service initializes, returns valid embeddings
- Verifies normalization, error handling

### 4.2 Missing Smoke Tests

**Critical Screens Without Smoke Tests:**

1. **Authentication Screens**
   - `login.tsx` - Sign-in form renders
   - Sign-up form renders

2. **Main Screens**
   - `index.tsx` - Dashboard renders
   - `note.tsx` - Notes list renders
   - `remind.tsx` - Reminders list renders
   - `dashboard.tsx` - Dashboard renders

3. **Chat Screens**
   - `ai.tsx` - Chat interface renders
   - `orchestrator/run.tsx` - Workflow view renders

4. **Settings Screens**
   - `profile.tsx` - Profile form renders
   - `preferences.tsx` - Preferences form renders
   - `privacy.tsx` - Privacy controls render

**Smoke Test Pattern:**
```typescript
describe("Smoke: Notes route", () => {
  it("renders without crashing", () => {
    render(<NotesRoute />);
    expect(screen.getByText(/notes/i)).toBeInTheDocument();
  });
});
```

---

## 5. Real vs Mocked Boundaries

### 5.1 Current Boundaries

**Component Layer (Real):**
- ✅ `Chat` component - Real implementation
- ✅ `Actions` component - Real implementation
- ✅ `ChatContainer` component - Real implementation
- ✅ Route components - Real implementation

**Hook Layer (Mixed):**
- ❌ `useAssistantStream` - Mocked in tests
- ✅ Hook logic (hydration, clearing) - Real in integration test

**tRPC Layer (Mocked):**
- ❌ All tRPC calls - Mocked via `mock.module("@/utils/trpc")`
- ❌ React Query hooks - Mocked (`useQuery`, `useMutation`)
- ❌ Query utils - Mocked (`setData`, `invalidate`, `cancel`)

**Server Layer (Not Tested):**
- ❌ HTTP handlers - Not tested in UI tests
- ❌ tRPC routers - Not tested in UI tests
- ❌ Database operations - Not tested in UI tests

**External APIs (Not Tested):**
- ❌ OpenAI API - Not tested in UI tests
- ❌ Cohere API - Not tested in UI tests

### 5.2 Boundary Decisions

**Why Mock tRPC?**
- Tests run in isolation (no server required)
- Faster execution (no network calls)
- Predictable responses (no flakiness)
- **Trade-off:** Doesn't test real tRPC integration

**Why Mock Hooks?**
- `useAssistantStream` requires tRPC client
- Tests component behavior without network
- **Trade-off:** Doesn't test hook implementation

**Why Mock Libraries?**
- `react-virtuoso` - Complex virtualization (stub sufficient for testing)
- `sonner` - Toast notifications (side effects in tests)

### 5.3 Mock Reduction Opportunities

**Opportunity 1: Real Hook + Mocked tRPC**
- Use real `useAssistantStream` implementation
- Mock tRPC client (not React Query hooks)
- Test hook logic with mocked network responses

**Opportunity 2: Real tRPC + Mocked Server**
- Use real tRPC client
- Mock HTTP server responses
- Test tRPC client integration

**Opportunity 3: Real Server + Mocked External APIs**
- Use real HTTP server with tRPC handler
- Mock external APIs (OpenAI, Cohere)
- Test full stack integration

---

## 6. Critical Flow Coverage

### 6.1 Coverage Matrix

| Flow | Unit Test | Integration Test | E2E Test | Mock Level |
|------|-----------|------------------|----------|------------|
| **Authentication** | ❌ | ❌ | ❌ | N/A |
| Sign-in | ❌ | ❌ | ❌ | N/A |
| Sign-up | ❌ | ❌ | ❌ | N/A |
| **Chat** | ✅ | ⚠️ | ❌ | Heavy |
| Send message | ✅ | ⚠️ | ❌ | Hook mocked |
| Stream response | ❌ | ❌ | ❌ | N/A |
| Agent switching | ✅ | ⚠️ | ❌ | Hook mocked |
| **Notes** | ❌ | ❌ | ❌ | N/A |
| Create note | ❌ | ❌ | ❌ | N/A |
| Read notes | ❌ | ❌ | ❌ | N/A |
| Update note | ❌ | ❌ | ❌ | N/A |
| Delete note | ❌ | ❌ | ❌ | N/A |
| **Reminders** | ❌ | ❌ | ❌ | N/A |
| Create reminder | ❌ | ❌ | ❌ | N/A |
| List reminders | ❌ | ❌ | ❌ | N/A |
| Complete reminder | ❌ | ❌ | ❌ | N/A |
| **Workflows** | ❌ | ❌ | ❌ | N/A |
| Start workflow | ❌ | ❌ | ❌ | N/A |
| Monitor workflow | ❌ | ❌ | ❌ | N/A |
| Complete workflow | ❌ | ❌ | ❌ | N/A |
| **Settings** | ✅ | ❌ | ❌ | Heavy |
| Update profile | ✅ | ❌ | ❌ | tRPC mocked |
| Update preferences | ✅ | ❌ | ❌ | tRPC mocked |
| Update privacy | ✅ | ❌ | ❌ | tRPC mocked |

**Legend:**
- ✅ = Tested
- ⚠️ = Partially tested (mocked dependencies)
- ❌ = Not tested

### 6.2 Error State Coverage

**Error States Tested:**
- ✅ Action errors (`actions.test.tsx` - displays error when action fails)
- ✅ Hook errors (`use-assistant-stream.integration.test.tsx` - clears error state)
- ❌ tRPC errors (network failures, validation errors)
- ❌ Server errors (500, timeout)
- ❌ Authentication errors (unauthorized, expired session)
- ❌ Database errors (constraint violations, connection failures)

**Missing Error Tests:**
- Network failures in tRPC calls
- Validation errors in forms
- Optimistic update rollbacks
- Streaming errors (connection drops, malformed events)
- Authentication failures (expired tokens, invalid credentials)

---

## 7. Test Infrastructure Analysis

### 7.1 Existing Infrastructure

#### Test Setup
- ✅ `apps/web/src/test/dom.ts` - DOM setup for tests (JSDOM)
- ✅ `apps/web/vitest.config.ts` - Vitest configuration (happy-dom environment)
- ✅ `packages/api/test/utils/db.ts` - Database test harness (`createTestDb`, `truncateTables`)
- ✅ `packages/api/test/utils/trpc.ts` - tRPC test caller (`createTestCaller`)

#### Test Utilities
- ✅ React Testing Library - Component rendering and interaction
- ✅ Bun test runner - Test execution
- ✅ Vitest - Test framework (configured but using Bun runner)

### 7.2 Missing Infrastructure

#### Test Server Utilities
- ❌ `createTestServer()` - Start HTTP server with tRPC handler
- ❌ `createTestClient()` - Create tRPC client connected to test server
- ❌ `cleanupTestServer()` - Stop server and cleanup

#### Authentication Utilities
- ❌ `createTestSession()` - Create authenticated test session
- ❌ `mockAuth()` - Mock Better Auth for tests
- ❌ `authenticatedRender()` - Render component with auth context

#### Streaming Utilities
- ❌ `createMockStream()` - Create mock EventSource/SSE stream
- ❌ `waitForStreamEvent()` - Wait for specific stream event
- ❌ `simulateStreamError()` - Simulate stream errors

#### Route Testing Utilities
- ❌ `renderRoute()` - Render TanStack Start route with loader data
- ❌ `mockLoaderData()` - Mock route loader data
- ❌ `navigateToRoute()` - Navigate to route in tests

### 7.3 Infrastructure Recommendations

**Priority 1: Test Server Infrastructure**
```typescript
// apps/web/src/test/server.ts
export async function createTestServer(options?: {
  port?: number;
  db?: TestDb;
}): Promise<TestServer> {
  // Start Bun.serve with tRPC handler
  // Use test database
  // Mock external APIs
  // Return server instance
}

export async function cleanupTestServer(server: TestServer): Promise<void> {
  // Stop server
  // Cleanup resources
}
```

**Priority 2: Test Client Infrastructure**
```typescript
// apps/web/src/test/client.ts
export function createTestClient(baseUrl: string): TRPCClient {
  // Create real tRPC client
  // Connect to test server
  // Return client instance
}
```

**Priority 3: Authentication Utilities**
```typescript
// apps/web/src/test/auth.ts
export function createTestSession(userId?: string): TestSession {
  // Create test session
  // Mock Better Auth
  // Return session object
}

export function authenticatedRender(
  component: ReactNode,
  session?: TestSession
): RenderResult {
  // Render with auth context
  // Return render result
}
```

---

## 8. Recommendations

### 8.1 Gap Analysis Summary

**Critical Gaps:**
1. ❌ **No E2E tests** for UI flows
2. ❌ **No smoke tests** for critical screens
3. ❌ **Missing tests** for notes, reminders, workflows
4. ❌ **Missing tests** for authentication flows
5. ⚠️ **Heavy mocking** limits integration test value
6. ❌ **No error state tests** for network/server failures

### 8.2 Mock Reduction Opportunities

**Opportunity 1: Real Hook + Mocked tRPC**
- Replace `useAssistantStream` mock with real implementation
- Mock tRPC client responses (not React Query hooks)
- Test hook logic with mocked network

**Opportunity 2: Real tRPC + Mocked Server**
- Use real tRPC client in tests
- Mock HTTP server responses
- Test tRPC client integration

**Opportunity 3: Real Server + Mocked External APIs**
- Use real HTTP server with tRPC handler
- Mock external APIs (OpenAI, Cohere)
- Test full stack integration

### 8.3 Test Infrastructure Needs

**Required Infrastructure:**
1. **Test Server Setup**
   - `createTestServer()` - Start HTTP server
   - `cleanupTestServer()` - Stop server
   - Database isolation per test

2. **Test Client Setup**
   - `createTestClient()` - Create tRPC client
   - Connect to test server
   - Handle authentication

3. **Authentication Mocking**
   - `createTestSession()` - Create test session
   - Mock Better Auth
   - Provide auth context

4. **Streaming Utilities**
   - `createMockStream()` - Mock EventSource
   - `waitForStreamEvent()` - Wait for events
   - `simulateStreamError()` - Simulate errors

### 8.4 Priority Recommendations

#### Priority 1: Smoke Tests (Quick Wins)
**Effort:** Low | **Value:** High | **Time:** 2-4 hours

Add smoke tests for critical screens:
- `login.tsx` - Sign-in form renders
- `note.tsx` - Notes list renders
- `remind.tsx` - Reminders list renders
- `ai.tsx` - Chat interface renders
- `profile.tsx` - Profile form renders

**Example:**
```typescript
describe("Smoke: Notes route", () => {
  it("renders without crashing", () => {
    mock.module("@/utils/trpc", () => ({
      trpc: {
        note: {
          list: { useQuery: () => ({ data: [], isLoading: false }) },
        },
      },
    }));
    render(<NotesRoute />);
    expect(screen.getByText(/notes/i)).toBeInTheDocument();
  });
});
```

#### Priority 2: Real Hook + Mocked tRPC Integration Tests
**Effort:** Medium | **Value:** High | **Time:** 4-8 hours

Replace hook mocks with real implementations:
- Use real `useAssistantStream` hook
- Mock tRPC client responses (not React Query hooks)
- Test hook logic with mocked network

**Example:**
```typescript
describe("ChatContainer with real hook", () => {
  it("streams messages through real hook", async () => {
    // Mock tRPC client, not hook
    const mockTrpcClient = createMockTrpcClient();
    mock.module("@/utils/trpc", () => ({ trpc: mockTrpcClient }));
    
    // Use real hook
    render(<ChatContainer agent="assistant" />);
    
    // Test real hook behavior
    fireEvent.change(screen.getByPlaceholderText(/Ask Alfred/i), {
      target: { value: "Hello" },
    });
    fireEvent.submit(screen.getByRole("form"));
    
    await waitFor(() => {
      expect(mockTrpcClient.assistant.stream.mutate).toHaveBeenCalled();
    });
  });
});
```

#### Priority 3: Notes Flow Tests
**Effort:** Medium | **Value:** High | **Time:** 6-12 hours

Add tests for notes CRUD operations:
- Create note → tRPC mutation → UI update
- Read notes → tRPC query → List render
- Update note → Optimistic update → Server sync
- Delete note → Confirmation → UI removal

**Example:**
```typescript
describe("Notes route", () => {
  it("creates a note and updates UI", async () => {
    const trpcMock = createTrpcMock();
    mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));
    
    render(<NotesRoute />);
    
    fireEvent.change(screen.getByPlaceholderText("Note title"), {
      target: { value: "Test note" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    
    await waitFor(() => {
      expect(trpcMock.note.create.mutate).toHaveBeenCalledWith({
        title: "Test note",
      });
      expect(screen.getByText("Test note")).toBeInTheDocument();
    });
  });
});
```

#### Priority 4: E2E Test Infrastructure
**Effort:** High | **Value:** Very High | **Time:** 16-24 hours

Implement E2E test infrastructure:
- `createTestServer()` - Start HTTP server with tRPC handler
- `createTestClient()` - Create tRPC client connected to test server
- Database isolation per test
- Authentication mocking

**Example:**
```typescript
describe("E2E: Notes flow", () => {
  let server: TestServer;
  let client: TRPCClient;
  
  beforeAll(async () => {
    server = await createTestServer();
    client = createTestClient(`http://localhost:${server.port}`);
  });
  
  afterAll(async () => {
    await cleanupTestServer(server);
  });
  
  it("creates note through real server", async () => {
    const result = await client.note.create.mutate({
      title: "E2E test note",
    });
    expect(result.id).toBeTruthy();
  });
});
```

#### Priority 5: Reminders & Workflows Tests
**Effort:** Medium | **Value:** Medium | **Time:** 8-16 hours

Add tests for reminders and workflows:
- Reminders CRUD operations
- Workflow start/monitor/complete
- Streaming event handling

---

## 9. Test Coverage Matrix

### 9.1 Component Coverage

| Component | Unit Test | Integration Test | E2E Test | Status |
|-----------|-----------|------------------|----------|--------|
| `Chat` | ✅ | ❌ | ❌ | ✅ Tested |
| `ChatContainer` | ✅ | ⚠️ | ❌ | ⚠️ Partial |
| `Actions` | ✅ | ❌ | ❌ | ✅ Tested |
| `Actions` (error states) | ✅ | ❌ | ❌ | ✅ Tested |
| `Plan` | ❌ | ❌ | ❌ | ❌ Missing |
| `Task` | ❌ | ❌ | ❌ | ❌ Missing |
| `Tool` | ❌ | ❌ | ❌ | ❌ Missing |
| `NotePane` | ❌ | ❌ | ❌ | ❌ Missing |
| `RemindPane` | ❌ | ❌ | ❌ | ❌ Missing |
| `PaneLayout` | ❌ | ❌ | ❌ | ❌ Missing |
| `AutonomySlider` | ❌ | ❌ | ❌ | ❌ Missing |
| `PrivacyControls` | ❌ | ❌ | ❌ | ❌ Missing |

### 9.2 Route Coverage

| Route | Unit Test | Integration Test | E2E Test | Status |
|-------|-----------|------------------|----------|--------|
| `login.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `index.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `note.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `remind.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `ai.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `orchestrator/run.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `profile.tsx` | ✅ | ❌ | ❌ | ⚠️ Partial |
| `preferences.tsx` | ✅ | ❌ | ❌ | ⚠️ Partial |
| `privacy.tsx` | ✅ | ❌ | ❌ | ⚠️ Partial |
| `dashboard.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `todos.tsx` | ❌ | ❌ | ❌ | ❌ Missing |
| `drive.tsx` | ❌ | ❌ | ❌ | ❌ Missing |

### 9.3 Hook Coverage

| Hook | Unit Test | Integration Test | E2E Test | Status |
|------|-----------|------------------|----------|--------|
| `useAssistantStream` | ⚠️ | ⚠️ | ❌ | ⚠️ Partial |
| `useVoiceCapture` | ❌ | ❌ | ❌ | ❌ Missing |

**Legend:**
- ✅ = Fully tested
- ⚠️ = Partially tested (mocked dependencies)
- ❌ = Not tested

---

## 10. Conclusion

### 10.1 Current State

The ALFRED web app has **solid unit test coverage** for core components (`Chat`, `Actions`, `ChatContainer`) but **lacks integration and E2E tests** for critical user flows. Testing relies heavily on mocking (tRPC, hooks, libraries), which limits the value of integration tests.

### 10.2 Key Strengths

- ✅ Good unit test coverage for pure components
- ✅ Well-structured test files (clear naming, organization)
- ✅ Uses React Testing Library (best practices)
- ✅ Database test harness exists (`packages/api/test/utils/db.ts`)
- ✅ tRPC test caller exists (`packages/api/test/utils/trpc.ts`)

### 10.3 Key Weaknesses

- ❌ No E2E tests for UI flows
- ❌ No smoke tests for critical screens
- ❌ Missing tests for notes, reminders, workflows
- ❌ Missing tests for authentication flows
- ⚠️ Heavy mocking limits integration test value
- ❌ No error state tests for network/server failures

### 10.4 Recommended Next Steps

1. **Immediate (1-2 weeks):**
   - Add smoke tests for critical screens
   - Add notes flow tests (unit + integration)
   - Add reminders flow tests (unit + integration)

2. **Short-term (2-4 weeks):**
   - Implement E2E test infrastructure
   - Add E2E tests for critical flows (chat, notes, reminders)
   - Reduce mocking in integration tests (real hooks + mocked tRPC)

3. **Medium-term (1-2 months):**
   - Add E2E tests for all critical flows
   - Add error state tests
   - Add performance tests for hot paths

---

## Appendix A: Test File Locations

### Test Files
- `apps/web/src/components/__tests__/chat-container.integration.test.tsx`
- `apps/web/src/components/__tests__/chat-container.test.tsx`
- `apps/web/src/components/__tests__/chat.test.tsx`
- `apps/web/src/components/__tests__/actions.test.tsx`
- `apps/web/src/hooks/__tests__/use-assistant-stream.integration.test.tsx`
- `apps/web/src/hooks/__tests__/cache-merge.test.ts`
- `apps/web/src/routes/__tests__/profile.test.tsx`
- `apps/web/src/routes/__tests__/privacy.test.tsx`
- `apps/web/src/routes/__tests__/preferences.test.tsx`

### Test Utilities
- `apps/web/src/test/dom.ts` - DOM setup
- `apps/web/vitest.config.ts` - Vitest configuration
- `packages/api/test/utils/db.ts` - Database test harness
- `packages/api/test/utils/trpc.ts` - tRPC test caller

### Documentation
- `apps/web/src/hooks/__tests__/e2e-trpc.md` - E2E test pattern (unimplemented)
- `.ruler/05-testing.md` - Testing standards

---

## Appendix B: Mock Patterns

### tRPC Mock Pattern
```typescript
const trpcMock = {
  useUtils: () => ({
    router: {
      procedure: {
        cancel: vi.fn(),
        getData: vi.fn(),
        setData: vi.fn(),
        invalidate: vi.fn(),
      },
    },
  }),
  router: {
    procedure: {
      useQuery: () => queryResult,
      useMutation: (config) => ({
        isPending: false,
        mutate: async (input) => {
          spy(input);
          await config?.onSuccess?.(result, input, context);
        },
      }),
    },
  },
};

mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));
```

### Hook Mock Pattern
```typescript
mock.module("@/hooks/use-assistant-stream", () => ({
  useAssistantStream: () => {
    const [messages, setMessages] = useState([]);
    const send = useCallback((text) => {
      setMessages((prev) => [...prev, createMessage(text)]);
    }, []);
    return { messages, send, clear, hydrate };
  },
}));
```

---

**End of Report**

