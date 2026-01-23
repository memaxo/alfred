# Critical Testing Gaps Analysis

**Date:** 2025-01-27  
**Last Updated:** 2025-01-27  
**Status:** In Progress - Major Gaps Addressed

## Executive Summary

This document identifies critical testing gaps across the ALFRED codebase. While substantial test coverage exists for core workflows, cognitive architecture, and voice systems, significant gaps remain in API router coverage, database repository tests, UI component tests, and background scheduler verification.

### Recent Progress (2025-01-27)

✅ **Completed:**
- Note router tests (18 tests) - Full CRUD coverage with auth guards
- Remind router tests (19 tests) - Full CRUD coverage with due reminders
- Timer router tests (14 tests) - Full CRUD coverage
- Reminder scheduler tests (6/7 tests) - Concurrency guards, error handling
- Assistant repository tests (19 tests) - All CRUD operations with performance assertions

**Total:** 76 new tests covering critical productivity features

## Critical Gaps by Category

### 1. API Router Testing (HIGH PRIORITY)

**Standard:** All API routers should ship with request-level tests that exercise auth guards, scope requirements, and representative payloads (`.ruler/05-testing.md` rule 2).

#### Missing Router Tests

| Router | Procedures | Criticality | Notes |
|--------|-----------|-------------|-------|
| `note.ts` | `create`, `list`, `update`, `delete` | **HIGH** | ✅ **COMPLETE** - 18 tests (`packages/api/test/note.router.test.ts`) |
| `remind.ts` | `create`, `list`, `due`, `fire`, `delete` | **HIGH** | ✅ **COMPLETE** - 19 tests (`packages/api/test/remind.router.test.ts`) |
| `timer.ts` | `create`, `active`, `done`, `cancel` | **MEDIUM** | ✅ **COMPLETE** - 14 tests (`packages/api/test/timer.router.test.ts`) |
| `book.ts` | `create`, `list`, `delete` | **MEDIUM** | Bookmark management, no tests found |
| `todo.ts` | `getAll`, `create`, `toggle`, `delete` | **LOW** | Public procedure (no auth), but should still test |
| `preference.ts` | `set`, `get`, `list`, `delete`, `correct` | **HIGH** | Policy enforcement, preference inference, no tests |
| `privacy.ts` | `facts`, `purge`, `export`, `events` | **CRITICAL** | Privacy controls, data deletion, no tests |
| `profile.ts` | `get`, `update` | **MEDIUM** | User profile management, no tests |
| `graph.ts` | Multiple graph operations | **MEDIUM** | Some integration tests exist, but no router-level tests |
| `fs.ts` | File system operations | **HIGH** | Security-sensitive, needs auth/policy tests |
| `terminal.ts` | Terminal operations | **HIGH** | Security-sensitive, needs auth/policy tests |
| `tune.ts` | Model tuning operations | **LOW** | Experimental feature |
| `deploy.ts` | Deployment operations | **CRITICAL** | Production deployments, needs comprehensive tests |
| `eval.ts` | Eval operations | **MEDIUM** | Some tests exist, but router-level coverage incomplete |
| `linear.ts` | Linear integration | **MEDIUM** | Webhook handling needs tests |
| `home.ts` | Home operations | **LOW** | Minimal functionality |

#### Existing Router Tests (for reference)

- ✅ `workflow.ts` - Comprehensive tests (`workflow.router.test.ts`, `workflow.suspension.test.ts`, etc.)
- ✅ `codex.ts` - Tests exist (`codex.router.test.ts`, `codex-stream.test.ts`)
- ✅ `cognitive.ts` - Tests exist (`cognitive.router.test.ts`)
- ✅ `admin.ts` - Tests exist (`admin.router.test.ts`)
- ✅ `droids.ts` - Tests exist (`droids.router.test.ts`)
- ✅ `token.ts` - Tests exist (`token.router.test.ts`)
- ✅ `voice.ts` - Tests exist (`voice.router.streaming.test.ts`, `voice.telemetry.test.ts`)

#### Required Test Patterns

Each router test should verify:

1. **Authentication guards** - Unauthenticated requests are rejected
2. **Authorization checks** - User-scoped queries (rule 5: least privilege)
3. **Input validation** - Zod schema validation works correctly
4. **Policy enforcement** - `requirePolicy` middleware is invoked where applicable
5. **Error handling** - Proper TRPCError codes and messages
6. **Success paths** - Representative CRUD operations succeed

**Example pattern:**
```typescript
describe("noteRouter", () => {
  it("rejects unauthenticated create", async () => {
    await expect(caller.note.create({...})).rejects.toThrow("UNAUTHORIZED");
  });
  
  it("creates note with valid input", async () => {
    const result = await authedCaller.note.create({ title: "Test", content: "..." });
    expect(result.id).toBeDefined();
  });
  
  it("scopes list to user", async () => {
    const notes = await authedCaller.note.list({});
    expect(notes.every(n => n.userId === userId)).toBe(true);
  });
});
```

### 2. Database Repository Testing (HIGH PRIORITY)

**Standard:** All repo queries must complete in <10ms (p99). Use ephemeral schemas or transactions to keep tests isolated (`.ruler/05-testing.md` rule 4, `.ruler/04-database.md` rule 12).

#### Missing Repository Tests

| Repository | Functions | Criticality | Notes |
|-----------|-----------|-------------|-------|
| `assistant.ts` | `createNote`, `getNotes`, `updateNote`, `deleteNote`, `createReminder`, `getReminders`, `getDueReminders`, `createTimer`, `getActiveTimers`, `createBookmark`, `getBookmarks`, `createTask`, `getTasks` | **HIGH** | ✅ **COMPLETE** - 19 tests with performance assertions (`packages/db/test/repo.assistant.test.ts`) |
| `conversation.ts` | Conversation management | **MEDIUM** | Some usage in integration tests, but no dedicated repo tests |
| `deploy/` | Deployment lifecycle | **CRITICAL** | Production deployments, needs comprehensive tests |
| `graph/write.ts` | Graph mutations | **MEDIUM** | Some traversal tests exist, but write operations need coverage |
| `graph/scoring.ts` | Confidence scoring | **MEDIUM** | Critical for knowledge graph quality |
| `graph/temporal.ts` | Temporal edge operations | **MEDIUM** | Bitemporal graph operations |
| `policy.ts` | Policy audit logging | **HIGH** | Security-critical audit trail |
| `sanitize.ts` | Content sanitization | **CRITICAL** | Security-critical, prevents XSS/injection |

#### Existing Repository Tests

- ✅ `user.ts` - Tests exist (`repo.user.test.ts`)
- ✅ `rag.ts` - Tests exist (`repo.rag.test.ts`, `repo.rag.hybrid.test.ts`)
- ✅ `workflow.ts` - Some tests exist
- ✅ `codex-learning.ts` - Tests exist (`codex-learning.test.ts`)
- ✅ `graph/traverse.ts` - Tests exist (`graph.traverse.sqlite.test.ts`)

#### Required Test Patterns

Each repo test should:

1. **Use `createTestDb`/`closeTestDb`** - Isolated Postgres connections (`packages/api/test/utils/db.ts`)
2. **Reset tables between tests** - `TRUNCATE` in `beforeEach`
3. **Assert performance budgets** - Query completion <10ms
4. **Test edge cases** - Empty results, invalid IDs, constraint violations
5. **Verify user scoping** - Queries are scoped to `userId`

### 3. UI Component Testing (MEDIUM PRIORITY)

**Standard:** Critical screens (notes, reminders) require component-level tests verifying optimistic updates and error handling (`.ruler/05-testing.md` rule 5).

#### Missing Component Tests

| Component/Route | Criticality | Notes |
|----------------|-------------|-------|
| `apps/web/src/routes/note.tsx` | **HIGH** | Notes pane - core productivity feature |
| `apps/web/src/routes/remind.tsx` | **HIGH** | Reminders pane - core productivity feature |
| Timer UI components | **MEDIUM** | No timer route found, but timer-node exists in Mindscape |
| Bookmark UI components | **MEDIUM** | No bookmark route found |
| `apps/web/src/routes/profile.tsx` | **MEDIUM** | Profile management |
| `apps/web/src/routes/preferences.tsx` | **MEDIUM** | Preferences management |
| `apps/web/src/routes/privacy.tsx` | **HIGH** | Privacy controls - critical for user trust |
| `apps/web/src/components/pane-layout.tsx` | **MEDIUM** | Shared pane component used by notes/reminders |
| `apps/web/src/components/sign-in-form.tsx` | **HIGH** | Authentication entry point |
| `apps/web/src/components/sign-up-form.tsx` | **HIGH** | User registration |

#### Existing Component Tests

- ✅ `chat-container.tsx` - Tests exist (`chat-container.integration.test.tsx`)
- ✅ `command-palette.tsx` - Tests exist (`command-palette.test.tsx`)
- ✅ Mindscape components - Extensive E2E tests
- ✅ `workflow-detail-modal.tsx` - Tests exist (`workflow-detail-content.test.tsx`)

#### Required Test Patterns

Each component test should:

1. **Use React Testing Library** - Render components, query by role/label
2. **Test optimistic updates** - UI updates before server confirmation
3. **Test error handling** - Error states, retry affordances
4. **Test empty states** - No data scenarios
5. **Test loading states** - Skeleton/loading indicators
6. **Mock tRPC calls** - Use `createRouteTrpcMock` or real tRPC with test DB

**Example pattern:**
```typescript
describe("NotePane", () => {
  it("renders empty state when no notes", async () => {
    const { getByText } = render(<NotePane />, { trpc: mockTrpc({ noteList: [] }) });
    expect(getByText("No notes yet")).toBeInTheDocument();
  });
  
  it("creates note optimistically", async () => {
    const { getByPlaceholder, getByRole } = render(<NotePane />);
    await user.type(getByPlaceholder("Title"), "Test Note");
    await user.click(getByRole("button", { name: "Create" }));
    expect(getByText("Test Note")).toBeInTheDocument(); // Optimistic
  });
});
```

### 4. Background Scheduler Testing (HIGH PRIORITY)

**Standard:** Schedulers must be gated behind env flags and tested for correct execution (`.ruler/02-architecture.md` rule 5).

#### Missing Scheduler Tests

| Scheduler | Location | Criticality | Notes |
|-----------|----------|-------------|-------|
| `remind.ts` | `packages/api/src/scheduler/remind.ts` | **HIGH** | ✅ **COMPLETE** - 6/7 tests (`packages/api/test/scheduler/remind.scheduler.test.ts`) |
| `preference-decay.ts` | `packages/api/src/scheduler/preference-decay.ts` | **MEDIUM** | Preference confidence decay, no tests found |
| `preference-inference.ts` | `packages/api/src/scheduler/preference-inference.ts` | **MEDIUM** | Background preference inference, no tests found |
| Learning worker | `packages/agent/src/orchestrator/learning-worker.ts` | **MEDIUM** | Tests exist but may need scheduler-specific tests |
| Codex session cleanup | Background workers | **MEDIUM** | Session timeout handling |

#### Required Test Patterns

Each scheduler test should:

1. **Test env flag gating** - Scheduler doesn't run when flag is unset
2. **Test execution logic** - Scheduler processes correct items
3. **Test concurrency guards** - `running` flag prevents overlapping ticks
4. **Test error handling** - Errors don't crash scheduler, logged appropriately
5. **Test cleanup** - `stopScheduler()` properly cleans up timers
6. **Use deterministic time** - Mock `Date.now()` for predictable behavior

**Example pattern:**
```typescript
describe("ReminderScheduler", () => {
  it("does not start when SCHED_REMIND is unset", () => {
    startReminderScheduler();
    expect(schedulerHandle).toBeNull();
  });
  
  it("processes due reminders", async () => {
    const onFire = vi.fn();
    startReminderScheduler({ onFire, now: () => new Date("2025-01-27T12:00:00Z") });
    await waitFor(() => expect(onFire).toHaveBeenCalled());
  });
  
  it("skips tick if previous run still in progress", async () => {
    // Test concurrency guard
  });
});
```

### 5. Security-Critical Path Testing (CRITICAL PRIORITY)

**Standard:** Token issuance, biometric elevation, and policy enforcement must be thoroughly tested (`.ruler/03-security.md`).

#### Existing Security Tests

- ✅ `token.router.test.ts` - Token elevation tests exist
- ✅ `tool-policy.test.ts` - Policy enforcement tests exist
- ✅ `secure-working-directory.test.ts` - Secure subprocess tests exist

#### Potential Gaps

1. **Token expiration** - Verify tokens expire within 5 minutes (300s default)
2. **Biometric ticket TTL** - Verify `requireRecentBiometric` enforces ≤2 minute TTL
3. **Policy audit logging** - Verify `policyRepo.createAuditLog` is called for all policy decisions
4. **Scope validation** - Verify `requireToolScopesAndPolicy` validates scopes correctly
5. **Elevated token requirements** - Verify medium/high autonomy requires `elevated=true` and `mfa="passkey"`
6. **Directory handle lifecycle** - Verify `openDirectorySecure()` handles are closed in `finally` blocks
7. **Input sanitization** - Verify `sanitize.ts` prevents XSS/injection attacks

### 6. Error Handling & Edge Cases (MEDIUM PRIORITY)

**Standard:** All error paths should be tested, especially SSR graceful degradation (`.ruler/16-error-handling.md`).

#### Missing Error Handling Tests

1. **SSR graceful degradation** - Database unavailable during SSR should not crash
2. **Service availability checks** - `isDbAvailable()`, `isUvAvailable()` behavior
3. **Transient vs permanent errors** - Error classification and retry logic
4. **tRPC error serialization** - Errors are properly serialized to clients
5. **Stream error handling** - Streaming endpoints handle errors gracefully
6. **Workflow timeout handling** - Workflows timeout after 30 minutes (default)

### 7. Performance Budget Testing (MEDIUM PRIORITY)

**Standard:** Hot-path functions must meet declared budgets (`.ruler/09-purity-and-performance.md` rule 2).

#### Existing Performance Tests

- ✅ `cognitive/test/performance-budget.test.ts` - Cognitive state transitions
- ✅ `knowledge/src/__tests__/query.hot.test.ts` - Hot query performance
- ✅ `tests/perf/workflow-stream-latency.test.ts` - Workflow streaming latency

#### Potential Gaps

1. **Database query performance** - All repo queries should assert <10ms (p99)
2. **Graph traversal performance** - Graph queries should meet budgets
3. **RAG retrieval performance** - Hybrid search should meet latency budgets
4. **Voice pipeline latency** - STT/TTS should meet real-time requirements

### 8. E2E Test Coverage (LOW-MEDIUM PRIORITY)

**Standard:** Prefer Playwright E2E tests for complex interactions (`.ruler/05-testing.md` rule 11).

#### Existing E2E Tests

- ✅ Mindscape E2E tests - Extensive coverage (`mindscape.*.e2e.spec.ts`)
- ✅ Auth E2E tests - Authentication flows (`auth.e2e.spec.ts`)
- ✅ Workflow E2E tests - Workflow execution (`workflow-execution.e2e.spec.ts`)
- ✅ Voice E2E tests - Voice sessions (`voice-session.e2e.spec.ts`)

#### Potential Gaps

1. **Notes CRUD flow** - End-to-end note creation/editing/deletion
2. **Reminders CRUD flow** - End-to-end reminder management
3. **Timer flow** - Timer creation, countdown, completion
4. **Privacy controls** - Data export, fact deletion flows
5. **Profile updates** - Profile modification flows

## Priority Recommendations

### Immediate (Critical Security & Core Features)

1. **Privacy router tests** - `privacy.ts` handles sensitive data deletion
2. **Deploy router tests** - `deploy.ts` handles production deployments
3. **FS/Terminal router tests** - Security-sensitive file/terminal operations
4. **Assistant repo tests** - Core CRUD operations for notes/reminders/timers
5. **Sanitize repo tests** - Content sanitization security

### High Priority (User-Facing Features)

1. **Note/Remind/Timer router tests** - Core productivity features
2. **Preference router tests** - Policy enforcement, inference logic
3. **Reminder scheduler tests** - Background reminder firing
4. **Note/Remind UI component tests** - Optimistic updates, error handling

### Medium Priority (Quality & Performance)

1. **Profile router tests** - User profile management
2. **Graph write/scoring tests** - Knowledge graph mutations
3. **Preference decay scheduler tests** - Background maintenance
4. **Performance budget assertions** - Database query performance

### Low Priority (Nice to Have)

1. **Todo router tests** - Public procedures, minimal auth
2. **Home router tests** - Minimal functionality
3. **Tune router tests** - Experimental feature

## Testing Infrastructure Gaps

### Missing Test Utilities

1. **Router test helpers** - Standardized pattern for testing tRPC routers with auth
2. **Component test helpers** - Standardized pattern for testing TanStack Start routes
3. **Scheduler test helpers** - Utilities for testing background schedulers with mocked time
4. **Performance assertion helpers** - Utilities for asserting performance budgets

### CI/CD Gaps

1. **Router test coverage** - CI should fail if routers lack tests
2. **Performance regression detection** - CI should fail if performance budgets are exceeded
3. **Security test coverage** - CI should verify security-critical paths are tested

## Next Steps

1. **Create router test template** - Standardized pattern for testing tRPC routers
2. **Create repo test template** - Standardized pattern for testing database repos
3. **Prioritize critical gaps** - Start with security-critical and user-facing features
4. **Add CI checks** - Enforce test coverage for new routers/repos
5. **Document test patterns** - Add examples to `docs/testing/` for future reference

## References

- `.ruler/05-testing.md` - Testing standards
- `.ruler/03-security.md` - Security expectations
- `.ruler/04-database.md` - Database rules
- `.ruler/16-error-handling.md` - Error handling standards
- `packages/api/test/` - Existing test examples
- `packages/db/test/` - Existing repo test examples
