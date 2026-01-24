# ALFRED Technical Debt Audit

**Date:** 2026-01-19  
**Scope:** Deprecated code, unimplemented features, legacy patterns, placeholder code

---

## Executive Summary

ALFRED has **significant technical debt** in three critical areas:

1. **Legacy Orchestrator Migration** - 11,500+ lines of deprecated orchestrator code needs migration to canonical pipeline
2. **Unimplemented Enforcement Tooling** - Critical checkers (`check-names.ts`, `check-budgets.ts`) are TODO stubs
3. **Dead Code & Placeholders** - Deprecated routers, placeholder auth functions, incomplete runtime features

**Total Debt Areas:** 8 major categories  
**Estimated Effort:** 3-6 months of focused refactoring  
**Risk Level:** 🔴 **High** - Blocks maintainability and feature velocity

---

## 1. Legacy Orchestrator Migration (CRITICAL)

### 1.1 Deprecated `runPlanV6` Function

**Location:** `packages/agent/src/workflow/runner.ts:165-610`  
**Status:** 🔴 **Deprecated, still in use**  
**Size:** 445 lines of deprecated code

**Evidence:**

```typescript
/**
 * @deprecated Use WorkflowRuntime from @alfred/runtime instead.
 * This runner will be removed in v2.0.0 after runtime integration is complete.
 */
export function runPlanV6(...)
```

**Impact:**

- Still imported and used in some routers
- Migration guide exists but migration incomplete
- Blocks removal of legacy code
- Creates confusion about which runtime to use

**Migration Status:**

- ✅ New runtime exists (`packages/runtime/`)
- ⚠️ Migration partially complete
- ❌ Old runner still referenced

**Action Required:**

1. Audit all imports of `runPlanV6`
2. Complete migration to `@alfred/runtime`
3. Remove deprecated function after migration verified

---

### 1.2 Orchestrator Fragmentation

**Location:** `packages/runtime/src/orchestrator/`, `packages/runtime/src/workflow/`  
**Status:** 🔴 **11,500+ lines needing refactoring**  
**Size:** 35+ files, 11,500+ lines

**Numbers:**

```
orchestrator/     19 files    7,870 lines
workflow/         12 files    2,500+ lines
phases/            4 files    1,200+ lines
─────────────────────────────────────────
Total             35+ files   11,500+ lines
```

**Documented In:** `docs/retrospective/orchestrator-fragmentation.md`

**Issues:**

1. **Feature Accretion** - Features bolted on without architectural consideration
2. **Premature Extraction** - 35+ small files (< 50 lines) increase cognitive load
3. **Overlapping Directories** - Unclear boundaries between `orchestrator/`, `workflow/`, `phases/`

**Migration Target:** Canonical pipeline (`packages/pipeline/`)

**Migration Status:**

- ✅ Pipeline architecture complete
- 🔴 **11 features not ported** (per `docs/implementation/pipeline-feature-port.md`)

**Missing Features:**
| Feature | Status | Complexity |
|---------|--------|------------|
| Resume/Suspend | 🔴 Not Started | High |
| Event Replay | 🔴 Not Started | Medium |
| State Hydration | 🔴 Not Started | Medium |
| Stuck Detection | 🔴 Not Started | Low |
| Escalation Handling | 🔴 Not Started | Low |
| Agent Retries | 🔴 Not Started | Medium |
| Review Fixer Loop | 🔴 Not Started | Medium |
| Wave Abort Logic | 🔴 Not Started | Low |
| TrackerContext | 🔴 Not Started | Low |
| ReviewGate | 🔴 Not Started | Low |
| Context Caching | 🔴 Not Started | Low |
| Cost Tracking | 🔴 Not Started | Low |

**Action Required:**

1. Prioritize critical features (Resume/Suspend, Event Replay)
2. Port features incrementally to pipeline
3. Remove legacy orchestrator after migration complete

---

## 2. Unimplemented Enforcement Tooling (CRITICAL)

### 2.1 Performance Budget Checker

**Location:** `scripts/check-budgets.ts`  
**Status:** 🔴 **TODO stub, not implemented**  
**Impact:** Performance regressions can slip in unnoticed

**Evidence:**

```typescript
// scripts/check-budgets.ts:86-94
function checkBudgets(): Violation[] {
  const violations: Violation[] = [];
  // TODO: [Phase 3] Implement actual measurement
  return violations;
}
```

**Rules Exist:** `.ruler/09-purity-and-performance.md` defines budgets:

- `<100 µs`: State transitions, normalizations
- `<1 ms`: Graph lookups, redaction, validation
- `<10 ms`: Fact extraction, context building
- `<100 ms`: Plan generation, complex queries

**Status:**

- ✅ Budgets documented
- ✅ Instrumentation exists (`@alfred/metrics/performance`)
- ❌ **No automated validation**
- ❌ **No CI enforcement**

**Action Required:**

1. Implement `check-budgets.ts` using `@alfred/test-kit/src/performance/budget.ts`
2. Add warmup-based tests for hot paths
3. Gate CI: `bun run check:budgets` fails on violations
4. Verify existing `.hot.ts` files meet budgets

---

### 2.2 Naming Convention Checker

**Location:** `scripts/check-names.ts`  
**Status:** ⚠️ **Partially implemented, not enforced**  
**Impact:** 158+ files violate single-word naming rule

**Evidence:**

- File exists and has implementation logic
- Not integrated into CI
- Not blocking violations

**Violations:**

- Multi-word filenames: `workflow-server.ts`, `runtime-fixture.ts`, `ai-adapter.ts`
- Snake_case scripts: `stt_server.py`, `download_models.py`
- Compound exports: `MayaTTSProcess`, `STTPool`, `TTSPool`

**Action Required:**

1. Complete implementation (AST parsing for identifiers)
2. Add CI gate: `bun run check:names` fails on violations
3. Systematic cleanup of 158+ violations
4. Document exceptions (e.g., `.integration.test.ts`)

---

## 3. Dead Code & Placeholders

### 3.1 Deprecated Todo Router

**Location:** `packages/api/src/routers/todo.ts`  
**Status:** 🔴 **Deprecated, all endpoints throw errors**  
**Size:** 72 lines of dead code

**Evidence:**

```typescript
/**
 * Deprecated: use `task.*` routes backed by `assistant_tasks`.
 */
export const todoRouter = router({
  getAll: authedProcedure.query(() => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "todo_deprecated_use_task",
    });
  }),
  // ... all endpoints throw same error
});
```

**Impact:**

- Router registered but non-functional
- Confusing for developers
- Takes up space in router registry

**Action Required:**

1. Remove router from registry (`packages/api/src/routers/index.ts`)
2. Delete `todo.ts` file
3. Update any remaining references to use `task.*` routes

---

### 3.2 Placeholder Auth Functions

**Location:** `packages/auth/src/auth.ts`, `packages/auth/src/key.ts`  
**Status:** 🔴 **Dead code, throw "Not implemented"**  
**Impact:** Confusing codebase, potential import errors

**Evidence:** (from `docs/security/auth-review.md:198-218`)

```typescript
// packages/auth/src/auth.ts - DEAD CODE
export function createAuth() {
  throw new Error("Not implemented");
}

// packages/auth/src/key.ts - DEAD CODE
export async function loadKeys(): Promise<KeyPair> {
  throw new Error("Not implemented");
}
```

**Status:** Files may have been deleted (not found in current codebase), but documented as debt

**Action Required:**

1. Verify files exist or were already deleted
2. If exist: Delete or implement properly
3. Audit imports to ensure no references

---

### 3.3 Deprecated Rerank Module

**Location:** `packages/rag/src/rerank.ts`  
**Status:** ⚠️ **Deprecated, re-exports for backwards compatibility**  
**Size:** 31 lines

**Evidence:**

```typescript
/**
 * @deprecated Use @alfred/rerank instead. This module re-exports for backwards compatibility.
 */
```

**Impact:**

- Low risk (just re-export)
- Creates confusion about which module to use
- Should be removed after migration period

**Action Required:**

1. Audit all imports of `@alfred/rag/rerank`
2. Migrate to `@alfred/rerank`
3. Remove deprecated re-export after migration

---

### 3.4 Deprecated Edge Functionality

**Location:** `apps/web/src/hooks/use-visible-edges.ts:26-32`  
**Status:** ⚠️ **Deprecated, returns empty array**  
**Size:** 7 lines

**Evidence:**

```typescript
/**
 * @deprecated Edge functionality removed in new type system
 */
export function useVisibleEdges(): never[] {
  return [];
}
```

**Action Required:**

1. Remove deprecated function
2. Update any remaining references
3. Clean up unused imports

---

## 4. Incomplete Runtime Features

### 4.1 Runtime Placeholders

**Location:** `packages/runtime/src/core.ts:190-225`  
**Status:** 🔴 **Placeholder implementations, not integrated**  
**Impact:** Runtime emits placeholder events, not real functionality

**Evidence:** (from `docs/execplans/runtime/runtime-integration-code-review.md:1039-1063`)

**Missing Integrations:**

1. **Context Gathering** - `core.ts:190-192` emits placeholder, no real context
2. **AI SDK Streaming** - `core.ts:199-203` emits placeholder, no AI planning
3. **Tool Execution** - `core.ts:210-214` emits placeholder, no tool calls
4. **Report Generation** - `core.ts:221-225` emits placeholder

**Status:** Documented TODOs, not blocking Phase 3.3, but incomplete

**Action Required:**

1. Integrate `gatherCodeContext` and `gatherWebContext` from `@alfred/agent`
2. Use AISDKAdapter in plan/act phases
3. Integrate tool registry from `@alfred/agent/v6`
4. Generate summary report

---

## 5. Test Infrastructure Debt

### 5.1 Over-Mocking (694 `mock.module()` calls)

**Location:** 221 test files across codebase  
**Status:** ⚠️ **Significant technical debt**  
**Impact:** Tests verify mocks, not real code; flaky tests

**Evidence:**

- 694 `mock.module()` calls across 221 files
- Module cache pollution causing flaky tests
- Tests mock implementation details instead of boundaries

**Documented In:** `docs/reports/code-quality-review-2026.md` Section 1.1

**Action Required:**

1. Migrate to dependency injection (pattern documented)
2. Replace DB mocks with real fixtures for integration tests
3. Remove top-level `mock.module()` calls causing cache pollution

---

### 5.2 Test Isolation Problems

**Location:** Multiple test files  
**Status:** ⚠️ **Tests require flags or isolation**  
**Impact:** Flaky tests, slow CI

**Examples:**

- `packages/api/test/assistant.router.test.ts` - Requires `RUN_ASSISTANT_ROUTER_TESTS=1`
- `packages/api/test/voice.streaming.integration.test.ts` - Fails when run alongside other tests

**Action Required:**

1. Refactor to dependency injection
2. Use `ALFRED_TEST_ISOLATE_FILES=1` only when necessary
3. Fix shared state issues

---

## 6. Security Debt

### 6.1 Test Session Header Not Gated

**Location:** `packages/api/src/context.ts:90-108`  
**Status:** 🔴 **Security risk if deployed**  
**Impact:** Attackers could forge sessions

**Evidence:** (from `docs/security/auth-review.md:179-192`)

```typescript
function parseTestSession(headers: Headers): AuthSession | null {
  const value = headers.get(TEST_SESSION_HEADER);
  // No check for NODE_ENV or VITE_TEST_MODE
  if (!value) return null;
  // ... parses and returns session
}
```

**Action Required:**

1. Gate behind `VITE_TEST_MODE` check
2. Verify not enabled in production
3. Add security test

---

### 6.2 No Biometric Bypass for Development

**Location:** `packages/auth/src/biometric.ts`, `packages/api/src/routers/token.ts`  
**Status:** ⚠️ **Development friction**  
**Impact:** Blocks development without passkey

**Action Required:**

1. Implement `BIO_AUTH_BYPASS` environment variable
2. Document usage in development guide
3. Ensure not enabled in production

---

## 7. Documentation Debt

### 7.1 Unimplemented Tooling Documented as Current

**Location:** Multiple docs  
**Status:** ⚠️ **Documentation drift**  
**Impact:** Confusing for developers

**Examples:**

- `scripts/check-names.ts` documented but not enforced
- `scripts/check-budgets.ts` documented but TODO stub
- Rules say "enforced" but tooling missing

**Action Required:**

1. Mark unimplemented tooling as "planned" not "current"
2. Update rules to reflect actual state
3. Quarterly rule audit to prevent drift

---

### 7.2 Deprecated ExecPlans Not Archived

**Location:** `docs/execplans/episodic-dreaming.md`  
**Status:** ⚠️ **Deprecated but not archived**  
**Impact:** Confusing for new contributors

**Evidence:**

```markdown
**Status**: Deprecated (removed)
**Goal**: (Removed) Synthesize heuristic "intuitions" from past failures during idle time.
```

**Action Required:**

1. Move deprecated ExecPlans to `docs/execplans/archive/`
2. Add deprecation notice at top
3. Keep as historical record only

---

## 8. Architecture Debt

### 8.1 Large Files Violating Budgets

**Location:** Multiple packages  
**Status:** 🔴 **Critical**  
**Impact:** Hard to maintain, violates architectural rules

**Violations:**

- `packages/runtime/src/orchestrator/agent.ts` - **1,231 lines** (exceeds 500-line budget)
- `packages/runtime/src/orchestrator/waves.ts` - **609 lines**
- `packages/runtime/src/workflow/orchestrator.ts` - **549 lines**

**Documented In:** `docs/reports/code-quality-review-2026.md` Section 2.1

**Action Required:**

1. Complete Concierge Focus refactoring (in progress)
2. Extract domain services from routers
3. Enforce architectural budgets in CI

---

### 8.2 Premature File Extraction

**Location:** `packages/runtime/src/orchestrator/`  
**Status:** ⚠️ **35+ small files increase cognitive load**  
**Impact:** Hard to navigate, unclear abstractions

**Examples:**

- `agents.ts` - 38 lines (too small)
- `convert.ts` - 43 lines (could be inline)
- `flatten.ts` - 27 lines (1 function)

**Action Required:**

1. Merge related small files
2. Extract only when abstraction is stable (≥100 lines)
3. Document file purpose

---

## Priority Recommendations

### Critical (Blocks Maintainability)

1. **Complete Orchestrator Migration**
   - Port 11 missing features to canonical pipeline
   - Remove deprecated `runPlanV6` after migration
   - Consolidate 35+ small files

2. **Implement Enforcement Tooling**
   - Implement `scripts/check-budgets.ts`
   - Complete `scripts/check-names.ts` and add CI gate
   - Enforce architectural budgets

3. **Remove Dead Code**
   - Delete deprecated `todo.ts` router
   - Remove placeholder auth functions (if exist)
   - Clean up deprecated re-exports

### High Priority (Creates Friction)

4. **Complete Runtime Integration**
   - Integrate context gathering
   - Integrate AI SDK streaming
   - Integrate tool execution
   - Generate real reports

5. **Fix Test Infrastructure**
   - Migrate over-mocked tests to DI
   - Fix test isolation problems
   - Add missing test coverage

6. **Fix Security Issues**
   - Gate test session header behind `VITE_TEST_MODE`
   - Add biometric bypass for development
   - Verify production security

### Medium Priority (Polish)

7. **Archive Deprecated Docs**
   - Move deprecated ExecPlans to archive
   - Mark unimplemented tooling as "planned"
   - Quarterly rule audit

8. **Consolidate Small Files**
   - Merge related small files in orchestrator
   - Extract only when abstraction is stable
   - Document file purpose

---

## Debt Summary by Category

| Category                | Debt Items                      | Estimated Effort | Priority    |
| ----------------------- | ------------------------------- | ---------------- | ----------- |
| **Legacy Migration**    | 11 features + deprecated runner | 2-3 months       | 🔴 Critical |
| **Enforcement Tooling** | 2 unimplemented checkers        | 2-4 weeks        | 🔴 Critical |
| **Dead Code**           | 4 deprecated modules            | 1-2 weeks        | 🔴 Critical |
| **Runtime Integration** | 4 placeholder features          | 1-2 months       | ⚠️ High     |
| **Test Infrastructure** | Over-mocking, isolation         | 1-2 months       | ⚠️ High     |
| **Security**            | 2 security issues               | 1-2 weeks        | ⚠️ High     |
| **Documentation**       | Drift, deprecated docs          | 1 week           | ⚠️ Medium   |
| **Architecture**        | Large files, extraction         | Ongoing          | ⚠️ Medium   |

**Total Estimated Effort:** 3-6 months of focused refactoring

---

## Conclusion

ALFRED has **significant technical debt** that blocks maintainability and feature velocity. The three critical areas are:

1. **Legacy Orchestrator** - 11,500+ lines needing migration (highest priority)
2. **Enforcement Tooling** - Missing checkers allow violations to accumulate
3. **Dead Code** - Deprecated modules create confusion

**Key Actions:**

- Complete orchestrator migration to canonical pipeline
- Implement enforcement tooling (`check-budgets.ts`, `check-names.ts`)
- Remove dead code and placeholders
- Fix test infrastructure (over-mocking, isolation)

**Risk:** Without addressing these debts, the codebase will become increasingly difficult to maintain and extend. Prioritize critical items first, then systematic cleanup.

---

## Appendix: Reference Documents

- Orchestrator Fragmentation: `docs/retrospective/orchestrator-fragmentation.md`
- Pipeline Feature Port: `docs/implementation/pipeline-feature-port.md`
- Runtime Integration Review: `docs/execplans/runtime/runtime-integration-code-review.md`
- Security Review: `docs/security/auth-review.md`
- Code Quality Review: `docs/reports/code-quality-review-2026.md`
- Architecture Review: `docs/archive/2026-01-19/architecture-code-quality-review.md`
