# ALFRED Codebase Architecture & Code Quality Review

**Date:** 2025-01-27  
**Reviewer:** Senior Engineering Assessment  
**Scope:** Architecture decisions, code quality, maintainability

---

## Executive Summary

ALFRED demonstrates strong architectural discipline with clean package boundaries, consistent error handling, and thoughtful single-user design. However, **naming convention violations are widespread** (158+ files), **performance budgets are documented but not enforced**, and **type safety has gaps** (704 `any` usages, though many justified). The codebase shows signs of active refactoring (deprecated `runPlanV6`, placeholder scripts) that should be completed. Overall: **solid foundation with technical debt requiring systematic cleanup**.

---

## Strengths

### Architecture & Boundaries

- **Clean package boundaries**: Dependency graph respects `apps/* → packages/* → packages/type` with no circular dependencies. Vite externalization properly prevents server code leakage (`apps/web/vite.config.ts:140-149`).
- **Layered pipeline**: Clear separation of `DB → repo → API → app` is consistently followed (`packages/db/src/repo/*`, `packages/api/src/routers/*`).
- **Single-user design**: Architecture correctly reflects personal assistant context—no multi-tenancy overhead, sensible defaults, minimal ceremony.

### Error Handling

- **Consistent error conversion**: `toTRPCError()` utility (`packages/api/src/utils/error.ts`) is used consistently across routers, properly handling biometric and codex timeout cases.
- **Graceful degradation**: Service initialization checks availability (`isDbAvailable()`, `isUvAvailable()`) before starting dependent services (`packages/api/src/init.ts:68-107`).

### Security

- **Token system**: Ed25519 token issuance with proper TTL (300s default), scope validation, and MFA/elevation claims (`packages/auth/src/token.ts:65-100`).
- **Secure subprocess spawning**: Uses `spawnWithSecureCwd()` with file descriptor handles to prevent TOCTOU attacks (per `.ruler/03-security.md`).

### Type Safety (Partial)

- **Strict TypeScript**: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` enabled (`tsconfig.base.json:16-18`).
- **Minimal suppressions**: Only 21 `@ts-expect-error`/`@ts-ignore` instances across 6 files, mostly justified (Vite types, test mocks).

### Testing Infrastructure

- **Comprehensive test patterns**: Integration tests use real fixtures (`@alfred/test-kit`), E2E tests use ephemeral ports, proper cleanup patterns.
- **Test coverage**: Cognitive, knowledge, and runtime packages have extensive test suites.

---

## Concerns (Prioritized)

### Critical (Blocks Maintainability)

#### 1. **Naming Convention Violations: 158+ Files**

**Location**: `packages/**/*-*.ts` (158 files), `packages/voice/scripts/*_*.py`, test files

**Violations**:

- Multi-word filenames: `workflow-server.ts`, `runtime-fixture.ts`, `ai-adapter.ts`, `history-context.ts`
- Snake_case scripts: `stt_server.py`, `download_models.py`, `test_voice.py`
- Compound exports: `MayaTTSProcess`, `STTPool`, `TTSPool`, `IPCBridge` (per `docs/execplans/voice-naming-compliance.md`)

**Impact**:

- Violates core rule `.ruler/01-naming-conventions.md` ("single lowercase word")
- Creates cognitive dissonance between rules and reality
- `scripts/check-names.ts` exists but is unimplemented (TODO comments)

**Recommendation**:

1. Implement `scripts/check-names.ts` with AST parsing
2. Fix violations in batches: voice scripts first (documented in ExecPlan), then test utilities, then core packages
3. Add CI gate: `bun run check:names` fails on violations

**Files to prioritize**:

- `packages/voice/scripts/*` (already documented in ExecPlan)
- `packages/test-kit/src/**/*-*.ts` (test infrastructure)
- `packages/api/test/utils/*-*.ts` (test helpers)

---

#### 2. **Performance Budgets Not Enforced**

**Location**: `scripts/check-budgets.ts` (unimplemented), `.ruler/09-purity-and-performance.md` (rules exist)

**Problem**:

- Budget checker is a TODO stub (`scripts/check-budgets.ts:86-94`)
- Rules state "Budget breaches are defects" but CI doesn't enforce
- Hot paths (`transition.hot.ts`, `query.hot.ts`) have instrumentation but no automated validation

**Impact**:

- Performance regressions can slip in unnoticed
- `.hot.ts` files may not actually meet budgets
- Rules document expectations that aren't verified

**Evidence**:

```typescript
// scripts/check-budgets.ts:86-94
function checkBudgets(): Violation[] {
  const violations: Violation[] = [];
  // TODO: [Phase 3] Implement actual measurement
  return violations;
}
```

**Recommendation**:

1. Implement `check-budgets.ts` using `@alfred/test-kit/src/performance/budget.ts` utilities
2. Add warmup-based tests for hot paths (per rule 16)
3. Gate CI: `bun run check:budgets` fails on violations
4. Verify existing `.hot.ts` files meet budgets: `packages/cognitive/src/transition.ts`, `packages/knowledge/src/query.hot.ts`

---

#### 3. **Type Safety Gaps: 704 `any` Usages**

**Location**: 162 files across packages

**Analysis**: Many are justified (JSONB columns, Drizzle limitations), but some are avoidable:

**Justified**:

- Drizzle JSONB: `packages/db/src/schema/assistant.ts:28` (`export const tasks: any`)
- Test mocks: `packages/api/test/**/*.test.ts`
- External API types: `packages/agent/src/v6.ts:44` (`execute: (...args: any[])`)

**Questionable**:

- `packages/api/src/routers/workflow.ts:99` (`coerceRecord(val: unknown): Record<string, unknown>`) - could use Zod
- `packages/knowledge/src/query.hot.ts` - some `any` in hot paths could be narrowed
- Tool execution: `packages/agent/src/v6.ts:44` - legacy tool interface uses `any[]`

**Impact**:

- Reduces type safety benefits
- Makes refactoring riskier
- Some `any` in hot paths could be performance-critical

**Recommendation**:

1. Audit `any` usages: categorize as "justified" (JSONB, mocks) vs "fixable"
2. Fix fixable cases: use `unknown` + type guards, Zod validation, proper generics
3. Document justified cases: add comments explaining why `any` is necessary
4. Target: reduce non-justified `any` by 50% in next quarter

---

### Significant (Creates Friction)

#### 4. **Dead Code & Deprecated Patterns**

**Location**:

- `packages/agent/src/workflow/runner.ts:165-605` (`runPlanV6` marked `@deprecated`)
- `packages/auth/src/auth.ts`, `packages/auth/src/key.ts` (placeholder functions throwing "Not implemented")
- `scripts/check-names.ts`, `scripts/check-budgets.ts` (unimplemented TODOs)

**Impact**:

- Confusing for new contributors
- Risk of accidental use of deprecated code
- Placeholder files suggest incomplete implementation

**Recommendation**:

1. Remove deprecated `runPlanV6` after confirming migration to `@alfred/runtime` is complete
2. Delete or implement placeholder auth files (`auth.ts`, `key.ts`)
3. Either implement or remove placeholder scripts (`check-names.ts`, `check-budgets.ts`)

---

#### 5. **Module-Level Side Effects**

**Location**: `packages/api/src/index.ts:2-4`

**Problem**:

```typescript
import { initApiServices } from "./init";
initApiServices(); // Side effect at module level
```

**Impact**:

- Makes testing harder (services initialize on import)
- Can cause issues in test environments
- Violates "pure by default" principle

**Recommendation**:

- Remove auto-initialization from `index.ts`
- Require explicit `initApiServices()` call in server entry points (`apps/web/src/server/bootstrap.ts`)
- Document initialization requirement in package README

---

#### 6. **Inconsistent Error Context**

**Location**: Various tRPC routers

**Problem**: Some routers include rich context in errors, others return generic messages. `toTRPCError()` accepts `defaultMessage` but usage varies.

**Example**:

```typescript
// Good: packages/api/src/routers/workflow.ts
catch (error) {
  throw toTRPCError(error, "workflow_execution_failed");
}

// Could be better: some routers use generic "unknown_error"
```

**Recommendation**:

- Standardize error messages: use domain-specific prefixes (`workflow_*`, `rag_*`, `voice_*`)
- Add error context helpers: `toTRPCError(error, "workflow_execution_failed", { runId, userId })`
- Document error message conventions in `.ruler/16-error-handling.md`

---

#### 7. **Test File Naming Inconsistency**

**Location**: Mix of `.test.ts` and `.spec.ts`, some integration tests use `.integration.test.ts`

**Problem**:

- `.ruler/01-naming-conventions.md` allows both `.test.ts` and `.spec.ts`
- No guidance on when to use which
- Integration tests use `.integration.test.ts` (multi-word, but allowed?)

**Impact**:

- Inconsistent project structure
- Unclear conventions for new tests

**Recommendation**:

- Standardize on `.test.ts` for unit tests, `.integration.test.ts` for integration tests
- Update `.ruler/01-naming-conventions.md` to clarify test naming
- Consider allowing `.integration.test.ts` as exception (integration is a compound concept)

---

### Minor (Polish Items)

#### 8. **Documentation Drift**

**Location**: `.ruler/` rules vs actual practice

**Examples**:

- Rules say "no dependency injection" but some packages use callback patterns that resemble DI
- Rules say "single-word names" but 158+ files violate
- `scripts/check-names.ts` and `scripts/check-budgets.ts` are documented but unimplemented

**Recommendation**:

- Quarterly rule audit: verify rules match practice
- Update rules when practice diverges (or fix practice)
- Mark unimplemented tooling as "planned" not "current"

---

#### 9. **Unused Exports**

**Location**: Various packages

**Problem**: Some packages export symbols that aren't imported elsewhere (need verification with tooling).

**Recommendation**:

- Add `ts-prune` or similar to detect unused exports
- Remove or mark as `@internal` if intentionally unused

---

#### 10. **Migration Filenames**

**Location**: `packages/db/src/migrations/*.sql`

**Problem**: Some migrations use multi-word descriptions (e.g., `0012_evals.sql` is fine, but check others).

**Recommendation**:

- Audit migration filenames for single-word compliance
- Rename if needed (migrations are idempotent)

---

## Architecture Diagram Assessment

**Stated Architecture**: `DB → repo → API → app` with strict package boundaries

**Reality**: ✅ **Matches stated architecture**

**Evidence**:

- Package boundaries respected: no `packages/*` importing from `apps/*`
- Layered structure clear: `packages/db/src/repo/*` → `packages/api/src/routers/*` → `apps/web/src/routes/*`
- Vite externalization prevents server code leakage (`apps/web/vite.config.ts:140-149`)

**Gaps**:

- Some packages import from `@alfred/runtime` (e.g., `packages/api/src/init.ts:18`) - but `runtime` is a leaf package, so this is acceptable
- Internal package imports sometimes use barrel files instead of relative paths (per rule 12)

**Verdict**: Architecture is **well-implemented** with minor deviations that don't break boundaries.

---

## Rule Compliance Audit

| Rule                | Compliance          | Violations                                                                                                  |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Single-word naming  | ⚠️ **Partial**      | 158+ files with hyphens (`workflow-server.ts`, `runtime-fixture.ts`). Voice scripts use snake_case.         |
| Package boundaries  | ✅ **Good**         | No `packages/*` importing from `apps/*`. Some internal barrel file imports.                                 |
| Type safety         | ⚠️ **Partial**      | 704 `any` usages (many justified). 21 type suppressions (mostly justified).                                 |
| Performance budgets | ❌ **Not enforced** | Rules exist, `check-budgets.ts` is unimplemented. Hot paths instrumented but not validated.                 |
| Error handling      | ✅ **Good**         | Consistent `toTRPCError()` usage. Some inconsistency in error message context.                              |
| Pure functions      | ✅ **Good**         | Cognitive/knowledge packages are pure. Boundary layers handle side effects.                                 |
| Test coverage       | ✅ **Good**         | Comprehensive test suites. Integration tests use real fixtures.                                             |
| Security            | ✅ **Good**         | Token system solid. Secure subprocess spawning. Some concerns documented in `docs/security/auth-review.md`. |
| Documentation       | ⚠️ **Partial**      | Rules comprehensive but some drift from practice. Unimplemented tooling documented as current.              |

**Overall Compliance**: **~75%** - Strong on architecture/security, weak on naming/budget enforcement.

---

## Recommendations

### Priority 1: Implement Enforcement Tooling

1. **Implement `scripts/check-names.ts`**: Parse AST, detect naming violations, fail CI
2. **Implement `scripts/check-budgets.ts`**: Measure hot paths, validate budgets, fail CI
3. **Add CI gates**: `bun run check:names && bun run check:budgets` in pre-commit/CI

**Impact**: Prevents future violations, enables systematic cleanup

---

### Priority 2: Systematic Naming Cleanup

1. **Phase 1**: Fix voice scripts (already documented in ExecPlan)
2. **Phase 2**: Fix test utilities (`test-kit`, `api/test/utils`)
3. **Phase 3**: Fix core packages (prioritize hot paths)
4. **Document exceptions**: Update rules to clarify when multi-word is acceptable (e.g., `.integration.test.ts`)

**Impact**: Restores rule credibility, reduces cognitive load

---

### Priority 3: Type Safety Audit

1. **Categorize `any` usages**: Justified (JSONB, mocks) vs fixable
2. **Fix fixable cases**: Use `unknown` + guards, Zod, generics
3. **Document justified cases**: Add comments explaining necessity
4. **Target**: 50% reduction in non-justified `any` in Q1

**Impact**: Improves refactoring safety, catches bugs earlier

---

### Priority 4: Remove Dead Code

1. **Delete deprecated `runPlanV6`**: After confirming migration complete
2. **Delete or implement placeholders**: `packages/auth/src/auth.ts`, `key.ts`
3. **Clean up unimplemented scripts**: Either implement or remove

**Impact**: Reduces confusion, clarifies current state

---

### Priority 5: Documentation Sync

1. **Quarterly rule audit**: Verify rules match practice
2. **Mark unimplemented tooling**: "Planned" not "Current"
3. **Clarify test naming**: Update rules to specify `.test.ts` vs `.spec.ts`

**Impact**: Prevents future drift, improves onboarding

---

## Conclusion

ALFRED's architecture is **solid and well-implemented**. Package boundaries are clean, error handling is consistent, and security practices are sound. The main issues are **enforcement gaps** (naming rules exist but aren't enforced, performance budgets aren't validated) and **technical debt** (naming violations, dead code, type safety gaps).

**Key Strengths to Preserve**:

- Clean package boundaries and layered architecture
- Consistent error handling patterns
- Strong security model (tokens, secure spawning)
- Comprehensive test infrastructure

**Key Weaknesses to Address**:

- Implement enforcement tooling (`check-names.ts`, `check-budgets.ts`)
- Systematic naming cleanup (158+ violations)
- Type safety audit (reduce non-justified `any`)
- Remove dead code and placeholders

**Verdict**: **Maintainable with systematic cleanup**. The foundation is strong; the issues are fixable with focused effort. Prioritize enforcement tooling first, then systematic cleanup.

---

## Appendix: File References

### Critical Issues

- Naming violations: `packages/**/*-*.ts` (158 files), `packages/voice/scripts/*_*.py`
- Budget enforcement: `scripts/check-budgets.ts` (unimplemented)
- Type safety: 704 `any` usages across 162 files

### Architecture Evidence

- Package boundaries: `apps/web/vite.config.ts:140-149` (externalization)
- Layered structure: `packages/db/src/repo/*`, `packages/api/src/routers/*`
- Error handling: `packages/api/src/utils/error.ts` (`toTRPCError`)

### Dead Code

- Deprecated: `packages/agent/src/workflow/runner.ts:165` (`runPlanV6`)
- Placeholders: `packages/auth/src/auth.ts`, `key.ts`
- Unimplemented: `scripts/check-names.ts`, `scripts/check-budgets.ts`
