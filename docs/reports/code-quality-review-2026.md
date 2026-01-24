# ALFRED Code Quality Review

**Date:** 2026-01-19  
**Scope:** Test quality, architecture, type safety, code organization, performance budgets

---

## Executive Summary

ALFRED demonstrates **strong architectural foundations** with clean package boundaries and consistent patterns. However, **test quality suffers from over-mocking**, **large files violate architectural budgets**, and **enforcement tooling is incomplete**. The codebase shows active refactoring efforts (Concierge Focus, pipeline migration) but technical debt remains.

**Overall Assessment:** **Maintainable with systematic cleanup required**

**Key Strengths:**

- Clean package boundaries (`apps/* → packages/* → packages/type`)
- Comprehensive test infrastructure
- Strong type safety foundation (strict TypeScript)
- Consistent error handling patterns

**Key Weaknesses:**

- Over-mocking in tests (694 `mock.module()` calls across 221 files)
- Large files exceed architectural budgets (11,500+ lines in orchestrator)
- Performance budgets documented but not enforced
- Naming convention violations (158+ files)

---

## 1. Test Quality Review

### 1.1 Over-Mocking Issues

**Severity:** ⚠️ **Significant**

**Evidence:**

- **694 `mock.module()` calls** across 221 test files
- Many tests mock implementation details rather than boundaries
- Test isolation problems documented in multiple files

#### Critical Over-Mocking Patterns

**1. Mocking Implementation Details**

**Location:** `packages/api/test/assistant.router.test.ts:28-50`

```typescript
// BAD: Mocking internal implementation
mock.module("@alfred/api/ai/generate", () => ({
  generateText: generateTextMock,
  persistResult: vi.fn().mockResolvedValue(null),
}));

mock.module("@alfred/agent/assistant/tool/handoff", () => ({
  toolHandoff: { execute: handoffExecuteMock },
}));
```

**Impact:** Tests verify mocks, not actual router behavior. Changes to `generate.ts` won't be caught.

**Fix:** Use dependency injection pattern (documented in `docs/architecture/test-dependency-injection.md`)

**2. Mock Everything Pattern**

**Location:** `packages/api/test/utils/mock-db-client.ts:543-571`

```typescript
// BAD: Mocking entire DB layer
mock.module("@alfred/db", () => ({
  ...realDb,
  codexRunRepo: dbModuleStub.codexRunRepo,
  userRepo: userRepoShim,
  // ... 10+ repos mocked
}));
```

**Impact:** Tests pass but real DB integration breaks aren't caught. Mock setup (571 lines) is longer than test logic.

**Fix:** Use real DB with ephemeral schemas for integration tests, or test repo logic directly

**3. Module Cache Pollution**

**Location:** Multiple test files with top-level `mock.module()`

**Evidence:**

- `packages/api/test/assistant.router.test.ts:2-3` - Comment: "causes Bun's module cache pollution"
- `packages/api/test/voice.streaming.integration.test.ts:2-4` - Comment: "fails or hangs when run alongside other tests"

**Impact:** Tests are flaky, require isolation (`ALFRED_TEST_ISOLATE_FILES=1`), slow down CI

**Fix:** Refactor to dependency injection (per `.ruler/05-testing.md` rule 8)

### 1.2 Testing Gaps

**Severity:** ⚠️ **Moderate**

#### Missing Test Categories

**1. Error Handling Coverage**

**Gap:** Many routers test happy path only, missing:

- Invalid input rejection
- Permission failures
- Network timeout handling
- Partial failure recovery

**Example:** `packages/api/test/assistant.router.test.ts` has 1 error case (`UNAUTHORIZED`) but missing:

- Invalid message format
- Tool execution failures
- Escalation failures
- Rate limiting

**2. Integration Test Coverage**

**Gap:** Heavy reliance on mocks means integration boundaries aren't tested:

- Router → Repo → DB flow
- Pipeline → Observer → Persistence flow
- Agent → Workspace → Docker flow

**Evidence:** `docs/archive/2026-01-19/test-implementation-summary.md` shows integration tests are "skipped" or "failing"

**3. Edge Cases**

**Gap:** Missing tests for:

- Empty/null inputs
- Boundary conditions (max tokens, max steps)
- Concurrent operations
- State corruption recovery

### 1.3 Test Structure Anti-Patterns

**Severity:** ⚠️ **Moderate**

**1. Test Isolation Problems**

**Pattern:** Tests depend on execution order or shared state

**Evidence:**

- `packages/api/test/assistant.router.test.ts` - Requires `RUN_ASSISTANT_ROUTER_TESTS=1` flag
- `packages/api/test/voice.streaming.integration.test.ts` - Comment: "fails when run alongside other tests"

**Fix:** Use `ALFRED_TEST_ISOLATE_FILES=1` or refactor to DI

**2. Mock Reset Complexity**

**Pattern:** Complex `afterEach` cleanup suggests tight coupling

**Example:** `packages/api/test/assistant.router.test.ts:53-61`

```typescript
afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
  generateTextMock.mockReset();
  handoffExecuteMock.mockReset();
  validateUIMessagesMock.mockClear();
  metricsStub.assistantGenerateRequestsTotal.inc.mockClear();
  metricsStub.assistantGenerateDurationSeconds.startTimer.mockClear();
});
```

**Fix:** Use centralized mock reset registry (per `.ruler/05-testing.md` rule 7)

### 1.4 Recommendations

**Priority 1: Refactor Over-Mocked Tests**

1. Migrate `packages/api/test/assistant.router.test.ts` to dependency injection
2. Replace `mock-db-client.ts` with real DB fixtures for integration tests
3. Remove top-level `mock.module()` calls that cause cache pollution

**Priority 2: Add Missing Test Coverage**

1. Add error case tests for all routers (invalid input, permissions, failures)
2. Add integration tests for critical flows (workflow execution, voice pipeline)
3. Add edge case tests (boundaries, nulls, concurrency)

**Priority 3: Improve Test Infrastructure**

1. Document when to use `mock.module()` vs DI vs real fixtures
2. Add test coverage reporting (target: 80% for repos, 60% for routers)
3. Fix flaky tests by removing shared state

---

## 2. Architecture & Code Organization

### 2.1 Large Files Violating Budgets

**Severity:** 🔴 **Critical**

**Evidence:** Architectural budgets exist but are violated:

**1. Orchestrator Fragmentation**

**Location:** `packages/runtime/src/orchestrator/`, `packages/runtime/src/workflow/`

**Numbers:**

```
orchestrator/     19 files    7,870 lines
workflow/         12 files    2,500+ lines
phases/            4 files    1,200+ lines
─────────────────────────────────────────
Total             35+ files   11,500+ lines
```

**Violations:**

- `packages/runtime/src/orchestrator/agent.ts` - **1,231 lines** (exceeds 500-line budget)
- `packages/runtime/src/orchestrator/waves.ts` - **609 lines**
- `packages/runtime/src/workflow/orchestrator.ts` - **549 lines**

**Impact:**

- Hard to understand (35+ files to navigate)
- Hard to test (integration tests required)
- Hard to modify (changes risk breaking behavior)
- Violates `.ruler/47-system-architecture.md` rule 19: "Any system exceeding 1,000 lines total requires architectural review"

**Status:** Documented in `docs/retrospective/orchestrator-fragmentation.md` - active refactoring needed

**2. Router Files Exceeding Budgets**

**Location:** `packages/api/src/routers/`

**Current Budgets (from `packages/api/test/architecture.godfiles.test.ts`):**

- `workflow.ts` - max 500 lines
- `voice.ts` - max 750 lines
- `plan.ts` - max 950 lines
- `agentfs.ts` - max 950 lines
- `codex.ts` - max 900 lines

**Note:** These are "ratchet" budgets (prevent growth), not target budgets. True target should be ≤500 lines per `.ruler/47-system-architecture.md`.

**Status:** Active refactoring in Concierge Focus ExecPlan (`docs/execplans/concierge-focus.md`)

**3. Large Functions**

**Evidence:** Multiple functions exceed 50-line limit (hot paths: 30 lines)

**Examples:**

- `packages/agent/src/orchestrator/tool/codex/definition.ts:67-155` - `exceedsComplexityLimits()` = 88 lines
- `packages/api/src/routers/plan.ts:752-895` - Procedure = 143 lines
- `packages/runtime/src/orchestrator/index.ts:32-213` - `runOrchestrator()` = 181 lines

**Impact:** Violates `.ruler/09-purity-and-performance.md` rule 10: "Function length: max 50 lines"

### 2.2 Premature Extraction

**Severity:** ⚠️ **Moderate**

**Pattern:** Small files extracted before abstraction is clear

**Evidence:** `docs/retrospective/orchestrator-fragmentation.md:32-46`

```
orchestrator/
├── agents.ts        38 lines   ← Too small to be a file
├── convert.ts       43 lines   ← Could be inline
├── flatten.ts       27 lines   ← 1 function
├── handoff.ts       49 lines   ← 2 functions
├── hydrate.ts       51 lines   ← Could merge with resume.ts
├── resume.ts        45 lines   ← Could merge with hydrate.ts
├── suspend.ts       33 lines   ← 1 function
└── summary.ts       47 lines   ← 1 function
```

**Impact:** Increases cognitive load (35+ files to navigate) without clear benefit

**Fix:** Merge related small files, extract only when abstraction is stable (per `.ruler/47-system-architecture.md` rule 24)

### 2.3 Feature Accretion Without Boundaries

**Severity:** ⚠️ **Moderate**

**Pattern:** Features bolted onto existing structure without architectural consideration

**Evidence:** `docs/retrospective/orchestrator-fragmentation.md:18-30`

```
Initial:     orchestrate() → execute()
+Linear:     orchestrate() → ensureTicket() → execute() → syncLinear()
+Review:     orchestrate() → ensureTicket() → execute() → review() → syncLinear()
+Learning:   orchestrate() → ensureTicket() → execute() → review() → learn() → syncLinear()
+Resume:     orchestrate() → loadHistory() → hydrate() → ensureTicket() → execute() → ...
```

**Impact:** Each feature added 50-200 lines without asking "Should this be a separate concern?"

**Fix:** Use observer pattern (per `.ruler/48-pipeline-boundaries.md`) - pipeline emits events, observers handle persistence/integrations

### 2.4 Recommendations

**Priority 1: Complete Orchestrator Refactoring**

1. Migrate to canonical pipeline (`packages/pipeline/`) - already in progress
2. Extract domain services from routers (per `.ruler/02-architecture.md` rule 10)
3. Reduce router files to ≤500 lines (Concierge Focus ExecPlan)

**Priority 2: Enforce Architectural Budgets**

1. Implement `scripts/check-budgets.ts` (currently TODO stub)
2. Add CI gate: fail on files >500 lines (or >1000 lines for systems)
3. Require architectural review before adding features to large systems

**Priority 3: Consolidate Small Files**

1. Merge related small files in `packages/runtime/src/orchestrator/`
2. Extract only when abstraction is stable (≥100 lines or complete abstraction)
3. Document file purpose in directory READMEs

---

## 3. Type Safety

### 3.1 Type Suppressions

**Severity:** ✅ **Good** (21 suppressions, mostly justified)

**Evidence:** Only 21 `@ts-expect-error`/`@ts-ignore` instances across 6 files

**Justified Cases:**

- Vite type definitions (`apps/web/vite.config.ts`)
- Test mocks (`packages/api/test/**/*.test.ts`)
- Generated code (`apps/web/src/routeTree.gen.ts`)

**Status:** Compliant with `.ruler/09-purity-and-performance.md` rule 9: "Avoid type suppressions unless absolutely necessary"

### 3.2 `any` Type Usage

**Severity:** ⚠️ **Moderate** (704 usages, many justified)

**Analysis:** From `docs/archive/2026-01-19/architecture-code-quality-review.md:100-124`

**Justified Cases:**

- Drizzle JSONB: `packages/db/src/schema/assistant.ts:28` (`export const tasks: any`)
- Test mocks: `packages/api/test/**/*.test.ts`
- Legacy tool interface: `packages/agent/src/v6.ts:44` (`execute: (...args: any[])`)

**Questionable Cases:**

- `packages/api/src/routers/workflow.ts:99` - `coerceRecord(val: unknown): Record<string, unknown>` - could use Zod
- `packages/knowledge/src/query.hot.ts` - some `any` in hot paths could be narrowed
- Tool execution: Legacy interface uses `any[]` - could use generics

**Impact:** Reduces type safety benefits, makes refactoring riskier

**Recommendation:**

1. Audit `any` usages: categorize as "justified" vs "fixable"
2. Fix fixable cases: use `unknown` + type guards, Zod validation, generics
3. Document justified cases: add comments explaining necessity
4. Target: 50% reduction in non-justified `any` in Q1

### 3.3 Recommendations

**Priority 1: Audit and Document `any` Usage**

1. Categorize 704 `any` usages: justified (JSONB, mocks) vs fixable
2. Add comments to justified cases explaining necessity
3. Create tracking issue for fixable cases

**Priority 2: Fix Fixable Cases**

1. Replace `coerceRecord()` with Zod schema validation
2. Narrow `any` in hot paths (`packages/knowledge/src/query.hot.ts`)
3. Migrate legacy tool interface to generics

---

## 4. Performance Budgets

### 4.1 Budget Enforcement Missing

**Severity:** 🔴 **Critical**

**Evidence:** `docs/archive/2026-01-19/architecture-code-quality-review.md:69-96`

**Problem:**

- Budget checker is TODO stub (`scripts/check-budgets.ts:86-94`)
- Rules state "Budget breaches are defects" but CI doesn't enforce
- Hot paths (`.hot.ts` files) have instrumentation but no automated validation

**Code Evidence:**

```typescript
// scripts/check-budgets.ts:86-94
function checkBudgets(): Violation[] {
  const violations: Violation[] = [];
  // TODO: [Phase 3] Implement actual measurement
  return violations;
}
```

**Impact:**

- Performance regressions can slip in unnoticed
- `.hot.ts` files may not actually meet budgets
- Rules document expectations that aren't verified

**Hot Path Budgets (from `.ruler/09-purity-and-performance.md`):**

- `<100 µs`: State transitions, normalizations
- `<1 ms`: Graph lookups, redaction, validation
- `<10 ms`: Fact extraction, context building
- `<100 ms`: Plan generation, complex queries
- `<16 ms`: UI render cycles (60fps)

**Status:** Instrumentation exists (`@alfred/metrics/performance`) but no validation

### 4.2 Recommendations

**Priority 1: Implement Budget Enforcement**

1. Implement `scripts/check-budgets.ts` using `@alfred/test-kit/src/performance/budget.ts`
2. Add warmup-based tests for hot paths (per `.ruler/09-purity-and-performance.md` rule 16)
3. Gate CI: `bun run check:budgets` fails on violations
4. Verify existing `.hot.ts` files meet budgets

**Priority 2: Add Budget Tests**

1. Add deterministic warmup-based tests for:
   - `packages/cognitive/src/transition.ts` (state transitions)
   - `packages/knowledge/src/query.hot.ts` (graph lookups)
   - `packages/plan/src/generate/*.ts` (plan generation)
2. Fail tests when measured average exceeds documented budget

---

## 5. Naming Conventions

### 5.1 Violations

**Severity:** ⚠️ **Moderate** (158+ files violate single-word rule)

**Evidence:** `docs/archive/2026-01-19/architecture-code-quality-review.md:44-66`

**Violations:**

- Multi-word filenames: `workflow-server.ts`, `runtime-fixture.ts`, `ai-adapter.ts`
- Snake_case scripts: `stt_server.py`, `download_models.py`
- Compound exports: `MayaTTSProcess`, `STTPool`, `TTSPool`

**Impact:**

- Violates core rule `.ruler/01-naming-conventions.md` ("single lowercase word")
- Creates cognitive dissonance between rules and reality
- `scripts/check-names.ts` exists but is unimplemented (TODO comments)

**Status:** Documented in ExecPlans (voice scripts), but systematic cleanup needed

### 5.2 Recommendations

**Priority 1: Implement Naming Checker**

1. Implement `scripts/check-names.ts` with AST parsing
2. Add CI gate: `bun run check:names` fails on violations
3. Document exceptions: clarify when multi-word is acceptable (e.g., `.integration.test.ts`)

**Priority 2: Systematic Cleanup**

1. Phase 1: Fix voice scripts (already documented in ExecPlan)
2. Phase 2: Fix test utilities (`test-kit`, `api/test/utils`)
3. Phase 3: Fix core packages (prioritize hot paths)

---

## 6. Code Quality Metrics Summary

| Category         | Status      | Violations                                      | Priority |
| ---------------- | ----------- | ----------------------------------------------- | -------- |
| **Test Quality** | ⚠️ Moderate | 694 `mock.module()` calls, missing error cases  | High     |
| **Architecture** | 🔴 Critical | 11,500+ lines in orchestrator, files >500 lines | Critical |
| **Type Safety**  | ✅ Good     | 704 `any` (many justified), 21 suppressions     | Medium   |
| **Performance**  | 🔴 Critical | Budgets not enforced, checker unimplemented     | Critical |
| **Naming**       | ⚠️ Moderate | 158+ files violate single-word rule             | Medium   |

---

## 7. Priority Recommendations

### Critical (Blocks Maintainability)

1. **Complete Orchestrator Refactoring**
   - Migrate to canonical pipeline (`packages/pipeline/`)
   - Extract domain services from routers
   - Reduce files to ≤500 lines

2. **Implement Performance Budget Enforcement**
   - Implement `scripts/check-budgets.ts`
   - Add warmup-based tests for hot paths
   - Gate CI on budget violations

3. **Refactor Over-Mocked Tests**
   - Migrate to dependency injection
   - Replace DB mocks with real fixtures for integration tests
   - Remove top-level `mock.module()` calls

### High Priority (Creates Friction)

4. **Add Missing Test Coverage**
   - Error case tests for all routers
   - Integration tests for critical flows
   - Edge case tests (boundaries, nulls, concurrency)

5. **Implement Naming Checker**
   - Implement `scripts/check-names.ts`
   - Add CI gate
   - Systematic cleanup of violations

6. **Audit and Fix Type Safety**
   - Categorize 704 `any` usages
   - Fix fixable cases (Zod, generics, type guards)
   - Document justified cases

### Medium Priority (Polish)

7. **Consolidate Small Files**
   - Merge related small files in orchestrator
   - Extract only when abstraction is stable

8. **Improve Test Infrastructure**
   - Document mocking patterns (when to use what)
   - Add test coverage reporting
   - Fix flaky tests

---

## 8. Conclusion

ALFRED's **architectural foundation is strong** with clean boundaries and consistent patterns. However, **technical debt has accumulated** in testing (over-mocking), architecture (large files), and enforcement (missing tooling).

**Key Strengths to Preserve:**

- Clean package boundaries (`apps/* → packages/* → packages/type`)
- Comprehensive test infrastructure
- Strong type safety foundation
- Consistent error handling patterns

**Key Weaknesses to Address:**

- Over-mocking in tests (694 `mock.module()` calls)
- Large files violating budgets (11,500+ lines in orchestrator)
- Performance budgets not enforced
- Naming violations (158+ files)

**Verdict:** **Maintainable with systematic cleanup required**. The foundation is solid; the issues are fixable with focused effort. Prioritize enforcement tooling first, then systematic cleanup.

---

## Appendix: Reference Documents

- Architecture Review: `docs/archive/2026-01-19/architecture-code-quality-review.md`
- Orchestrator Fragmentation: `docs/retrospective/orchestrator-fragmentation.md`
- Test Dependency Injection: `docs/architecture/test-dependency-injection.md`
- Concierge Focus ExecPlan: `docs/execplans/concierge-focus.md`
- Testing Standards: `.ruler/05-testing.md`
- System Architecture: `.ruler/47-system-architecture.md`
- Purity and Performance: `.ruler/09-purity-and-performance.md`
