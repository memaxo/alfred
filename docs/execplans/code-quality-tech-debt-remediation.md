# ExecPlan: Code Quality and Technical Debt Remediation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows the format specified in `.agent/PLANS.md` and addresses all issues identified in `docs/reports/code-quality-review-2026.md` and `docs/reports/technical-debt-audit-2026.md`.

## Purpose / Big Picture

After completing this ExecPlan, ALFRED will have eliminated major technical debt, enforced code quality standards automatically, and established a maintainable foundation for future development. Developers will see immediate feedback when code violates architectural budgets, naming conventions, or performance requirements. The codebase will be free of deprecated code, over-mocked tests will be refactored to use dependency injection, and the legacy orchestrator will be fully migrated to the canonical pipeline.

Observable outcomes include: running `bun run check:names` and `bun run check:budgets` in CI will fail builds on violations; deprecated routers and functions will be removed; test suites will run faster and more reliably without module cache pollution; and the canonical pipeline will handle all workflow execution with complete feature parity to the legacy orchestrator.

## Progress

- [ ] Phase 1: Enforcement Tooling Foundation
  - [ ] Implement `scripts/check-budgets.ts` with performance measurement
  - [ ] Complete `scripts/check-names.ts` implementation with AST parsing
  - [ ] Add CI gates for both checkers
  - [ ] Verify existing `.hot.ts` files meet budgets
- [ ] Phase 2: Dead Code Removal
  - [ ] Remove deprecated `todo.ts` router
  - [ ] Remove placeholder auth functions (if exist)
  - [ ] Remove deprecated rerank re-export
  - [ ] Remove deprecated edge functionality
  - [ ] Archive deprecated ExecPlans
- [ ] Phase 3: Test Infrastructure Refactoring
  - [ ] Migrate `assistant.router.test.ts` to dependency injection
  - [ ] Replace `mock-db-client.ts` with real DB fixtures for integration tests
  - [ ] Fix test isolation problems (remove flags, fix shared state)
  - [ ] Add missing error case tests for routers
  - [ ] Add integration tests for critical flows
- [ ] Phase 4: Legacy Orchestrator Migration
  - [ ] Port Resume/Suspend to canonical pipeline
  - [ ] Port Event Replay to canonical pipeline
  - [ ] Port State Hydration to canonical pipeline
  - [ ] Port remaining 8 features to canonical pipeline
  - [ ] Remove deprecated `runPlanV6` function
  - [ ] Consolidate small orchestrator files
- [ ] Phase 5: Runtime Integration Completion
  - [ ] Integrate context gathering in runtime
  - [ ] Integrate AI SDK streaming in runtime
  - [ ] Integrate tool execution in runtime
  - [ ] Implement report generation in runtime
- [ ] Phase 6: Architecture Cleanup
  - [ ] Extract domain services from large routers
  - [ ] Reduce router files to ≤500 lines
  - [ ] Merge related small files in orchestrator
  - [ ] Enforce architectural budgets in CI
- [ ] Phase 7: Security Fixes
  - [ ] Gate test session header behind `VITE_TEST_MODE`
  - [ ] Add biometric bypass for development
  - [ ] Verify production security
- [ ] Phase 8: Type Safety and Naming Cleanup
  - [ ] Audit and categorize 704 `any` usages
  - [ ] Fix fixable type safety issues
  - [ ] Systematic cleanup of 158+ naming violations
  - [ ] Document justified exceptions

## Surprises & Discoveries

_(To be filled during execution)_

## Decision Log

_(To be filled during execution)_

## Outcomes & Retrospective

_(To be filled upon completion)_

## Context and Orientation

ALFRED is a Better-T-Stack monorepo orchestrated by Turborepo and Bun workspaces. The codebase delivers the ALFRED assistant across web and native clients with a shared backend stack. Key packages include `packages/api` (tRPC routers), `packages/runtime` (workflow execution), `packages/pipeline` (canonical pipeline architecture), `packages/agent` (agent implementations), and `packages/db` (Drizzle schema and repos).

The codebase has accumulated technical debt in several areas. The legacy orchestrator (`packages/runtime/src/orchestrator/`) contains 11,500+ lines across 35+ files that need migration to the canonical pipeline (`packages/pipeline/`). Enforcement tooling exists as TODO stubs (`scripts/check-budgets.ts`, `scripts/check-names.ts`) but is not implemented. Test infrastructure suffers from over-mocking (694 `mock.module()` calls) causing flaky tests. Dead code includes deprecated routers, placeholder functions, and incomplete runtime features.

The canonical pipeline is a stage-based orchestrator that emits events and uses observers for cross-cutting concerns. It replaces the legacy orchestrator's monolithic approach with a modular, testable architecture. The pipeline has stages for init, context, plan, schedule, execute, review, learn, and summarize. Observers handle persistence, integrations, and metrics.

Test infrastructure uses Bun's test runner with `mock.module()` for module mocking. However, `mock.module()` is process-global and permanent, causing cache pollution when tests run together. The recommended pattern is dependency injection via tRPC context, documented in `docs/architecture/test-dependency-injection.md`.

Performance budgets are defined in `.ruler/09-purity-and-performance.md`: `<100 µs` for state transitions, `<1 ms` for graph lookups, `<10 ms` for fact extraction, `<100 ms` for plan generation. Hot paths are marked with `.hot.ts` suffix and should have instrumentation via `@alfred/metrics/performance`.

Naming conventions require single lowercase words for files, directories, and exported symbols. Exceptions exist for framework files (`_layout.tsx`), test files (`.test.ts`, `.integration.test.ts`), and generated outputs. The checker should validate these rules using AST parsing.

## Plan of Work

This ExecPlan is organized into eight phases that build upon each other. Phase 1 establishes enforcement tooling that prevents future violations. Phase 2 removes dead code to reduce confusion. Phase 3 refactors test infrastructure to improve reliability. Phase 4 migrates the legacy orchestrator to the canonical pipeline. Phase 5 completes runtime integration. Phase 6 cleans up architecture violations. Phase 7 fixes security issues. Phase 8 addresses type safety and naming violations.

Each phase is independently verifiable and can be implemented incrementally. The phases are designed to be idempotent: running steps multiple times should not cause issues. Validation steps are included after each phase to ensure correctness.

### Phase 1: Enforcement Tooling Foundation

The first phase implements the enforcement checkers that will prevent future violations. This includes implementing `scripts/check-budgets.ts` to measure hot path performance and validate budgets, completing `scripts/check-names.ts` with AST parsing for identifier validation, adding CI gates for both checkers, and verifying existing `.hot.ts` files meet their documented budgets.

The budget checker will use `@alfred/test-kit/src/performance/budget.ts` utilities to measure function execution times. It will scan for `.hot.ts` files, identify functions with performance budgets, run warmup iterations, measure average execution time, and compare against documented budgets. Violations will be reported with file paths, function names, measured times, and budget limits.

The naming checker will use AST parsing (via `@babel/parser` or similar) to validate file names, directory names, exported symbols, and function parameters against the single-word rule. It will allow documented exceptions (framework files, test files, generated outputs) and report violations with file paths, line numbers, and suggested fixes.

Both checkers will be integrated into CI via GitHub Actions workflows. They will run in the lint job and fail the build on violations. Local developers can run `bun run check:names` and `bun run check:budgets` before committing.

### Phase 2: Dead Code Removal

The second phase removes deprecated code that creates confusion. This includes removing the deprecated `todo.ts` router (all endpoints throw errors), removing placeholder auth functions if they exist, removing the deprecated rerank re-export after verifying no imports remain, removing deprecated edge functionality, and archiving deprecated ExecPlans to `docs/execplans/archive/`.

Before removing code, we audit all imports to ensure no references remain. We update any remaining references to use the replacement APIs. We verify tests still pass after removal. We document the removal in changelog or migration notes.

The `todo.ts` router is deprecated in favor of `task.*` routes. We search for imports of `todoRouter` or references to `todo.*` endpoints, update them to use `task.*` routes, remove the router from `packages/api/src/routers/index.ts`, and delete `packages/api/src/routers/todo.ts`.

The rerank module re-exports `@alfred/rerank/cohere` for backwards compatibility. We search for imports of `@alfred/rag/rerank`, update them to use `@alfred/rerank` directly, and remove the re-export from `packages/rag/src/rerank.ts`.

### Phase 3: Test Infrastructure Refactoring

The third phase refactors over-mocked tests to use dependency injection and fixes test isolation problems. This includes migrating `packages/api/test/assistant.router.test.ts` to dependency injection, replacing `mock-db-client.ts` with real DB fixtures for integration tests, fixing test isolation problems by removing flags and fixing shared state, adding missing error case tests for routers, and adding integration tests for critical flows.

The dependency injection pattern is documented in `docs/architecture/test-dependency-injection.md`. Routers define a `RouterDeps` interface with injectable dependencies. Dependencies are injected via `ctx.deps` instead of direct imports. Tests create mock deps and pass them to `createTestCaller({ deps: mockDeps })`.

For integration tests, we use real DB fixtures via `@alfred/test-kit` utilities. We create ephemeral schemas, run tests in transactions, and clean up after each test. This ensures tests verify real integration boundaries rather than mocks.

Test isolation problems are fixed by removing top-level `mock.module()` calls that cause cache pollution. We move mocks into test functions or use dependency injection. We remove flags like `RUN_ASSISTANT_ROUTER_TESTS=1` and ensure tests can run together without conflicts.

### Phase 4: Legacy Orchestrator Migration

The fourth phase migrates the legacy orchestrator to the canonical pipeline. This is the largest phase and includes porting 11 features: Resume/Suspend, Event Replay, State Hydration, Stuck Detection, Escalation Handling, Agent Retries, Review Fixer Loop, Wave Abort Logic, TrackerContext, ReviewGate, Context Caching, and Cost Tracking.

The migration guide is documented in `docs/implementation/pipeline-feature-port.md`. Each feature is ported incrementally: we identify the current implementation in the legacy orchestrator, create the equivalent in the canonical pipeline (either as a stage enhancement or observer), write tests for the new implementation, verify feature parity, and remove the legacy code.

Resume/Suspend is the most critical feature. It requires creating `PipelineReconstructor` class in `packages/pipeline/src/reconstruct.ts`, adding `context:set` events to the event stream, implementing `resume()` method in `PipelineRunner`, and creating `CheckpointObserver` to persist state after each stage.

After all features are ported, we remove the deprecated `runPlanV6` function from `packages/agent/src/workflow/runner.ts`. We verify all imports are updated, run full test suite, and document the migration completion.

We consolidate small files in `packages/runtime/src/orchestrator/` by merging related files (e.g., `hydrate.ts` and `resume.ts`). We extract only when abstraction is stable (≥100 lines or complete abstraction).

### Phase 5: Runtime Integration Completion

The fifth phase completes runtime integration by replacing placeholder implementations with real functionality. This includes integrating context gathering (`gatherCodeContext`, `gatherWebContext` from `@alfred/agent`), integrating AI SDK streaming (using `AISDKAdapter` in plan/act phases), integrating tool execution (tool registry from `@alfred/agent/v6`), and implementing report generation.

The placeholders are in `packages/runtime/src/core.ts` at lines 190-225. We replace each placeholder with the real implementation, write tests to verify functionality, and ensure the runtime emits real events instead of placeholders.

Context gathering uses `gatherCodeContext` and `gatherWebContext` from `@alfred/agent`. We integrate these into the context stage, ensure context is properly formatted for the pipeline, and verify context is included in events.

AI SDK streaming uses `AISDKAdapter` which wraps AI SDK v6 `streamText` and `generateObject`. We integrate this into the plan and act stages, ensure streaming events are properly emitted, and verify tool calls are handled correctly.

Tool execution uses the tool registry from `@alfred/agent/v6`. We integrate tool execution into the act stage, ensure tool calls are properly executed, and verify tool results are included in events.

Report generation creates a summary of workflow execution. We implement report generation in the summarize stage, ensure reports include key metrics and outcomes, and verify reports are persisted.

### Phase 6: Architecture Cleanup

The sixth phase cleans up architecture violations by extracting domain services from large routers, reducing router files to ≤500 lines, merging related small files, and enforcing architectural budgets in CI.

Large routers include `packages/api/src/routers/plan.ts` (896 lines), `packages/api/src/routers/voice.ts` (629 lines), `packages/api/src/routers/workflow.ts` (500+ lines). We extract business logic into domain services in `packages/api/src/services/`, keep routers thin (only request validation, permission checks, service delegation), and ensure services are testable independently.

We merge related small files in `packages/runtime/src/orchestrator/` (e.g., `agents.ts`, `convert.ts`, `flatten.ts`). We extract only when abstraction is stable (≥100 lines or complete abstraction).

We add architectural budget enforcement to CI by running `packages/api/test/architecture.godfiles.test.ts` in the boundaries job, tightening budgets to true targets (≤500 lines), and failing CI on violations.

### Phase 7: Security Fixes

The seventh phase fixes security issues identified in `docs/security/auth-review.md`. This includes gating the test session header behind `VITE_TEST_MODE`, adding biometric bypass for development, and verifying production security.

The test session header is in `packages/api/src/context.ts:90-108`. We add a check for `VITE_TEST_MODE` environment variable, return null if not in test mode, and verify the check is effective.

Biometric bypass adds `BIO_AUTH_BYPASS` environment variable for development. We implement the bypass in `packages/auth/src/biometric.ts`, document usage in development guide, and ensure it's not enabled in production.

We verify production security by checking environment variables are not set, running security tests, and documenting security practices.

### Phase 8: Type Safety and Naming Cleanup

The eighth phase addresses type safety gaps and naming violations. This includes auditing and categorizing 704 `any` usages (justified vs fixable), fixing fixable type safety issues (using `unknown` + type guards, Zod validation, generics), systematic cleanup of 158+ naming violations, and documenting justified exceptions.

We audit `any` usages by searching the codebase, categorizing each usage as justified (JSONB, mocks, external APIs) or fixable, creating a tracking issue for fixable cases, and fixing them incrementally.

We fix fixable cases by replacing `coerceRecord()` with Zod schema validation, narrowing `any` in hot paths, migrating legacy tool interface to generics, and adding comments to justified cases.

We systematically clean up naming violations by prioritizing voice scripts (already documented), then test utilities, then core packages. We update files incrementally, verify tests pass, and document exceptions.

## Concrete Steps

### Phase 1: Enforcement Tooling Foundation

**Step 1.1: Implement `scripts/check-budgets.ts`**

    cd /Users/jackmazac/Development/alfred
    Read `scripts/check-budgets.ts` to understand current structure
    Read `@alfred/test-kit/src/performance/budget.ts` to understand utilities
    Read `.ruler/09-purity-and-performance.md` to understand budget definitions
    Implement budget measurement logic:
      - Scan for `.hot.ts` files
      - Parse function comments for budget annotations (e.g., `@budget <100µs`)
      - Run warmup iterations (10 iterations)
      - Measure average execution time (100 iterations)
      - Compare against budget
      - Report violations
    Add CLI interface: `bun run check:budgets [--fix]`
    Test with existing `.hot.ts` files:
      - `packages/cognitive/src/transition.ts`
      - `packages/knowledge/src/query.hot.ts`
    Verify output shows violations or "All budgets met"

**Step 1.2: Complete `scripts/check-names.ts`**

    Read `scripts/check-names.ts` to understand current implementation
    Read `.ruler/01-naming-conventions.md` to understand rules
    Implement AST parsing for identifiers:
      - Use `@babel/parser` or `typescript` compiler API
      - Parse TypeScript files
      - Extract exported symbols, function parameters, class names
      - Validate against single-word rule
      - Allow documented exceptions (framework files, test files)
    Add CLI interface: `bun run check:names [--fix]`
    Test with known violations:
      - `packages/voice/scripts/*_*.py`
      - `packages/test-kit/src/**/*-*.ts`
    Verify output shows violations with file paths and line numbers

**Step 1.3: Add CI Gates**

    Read `.github/workflows/ci.yml` to understand CI structure
    Add `check:names` and `check:budgets` to lint job:
      - Run `bun run check:names` before linting
      - Run `bun run check:budgets` after typecheck
      - Fail job on violations
    Test locally: `bun run check:names && bun run check:budgets`
    Commit changes and verify CI runs checkers

**Step 1.4: Verify Existing Hot Paths**

    Run `bun run check:budgets` on codebase
    Review violations for existing `.hot.ts` files
    Fix any violations that exceed budgets
    Document any justified exceptions

### Phase 2: Dead Code Removal

**Step 2.1: Remove Deprecated Todo Router**

    Search for imports of `todoRouter` or `todo.*` endpoints:
      `rg "todoRouter|todo\." packages/ apps/`
    Update any references to use `task.*` routes
    Remove router from `packages/api/src/routers/index.ts`:
      - Find `todoRouter` import
      - Remove from router registry
    Delete `packages/api/src/routers/todo.ts`
    Run tests: `bun test packages/api/test/`
    Verify no test failures related to todo router

**Step 2.2: Remove Placeholder Auth Functions**

    Check if `packages/auth/src/auth.ts` and `packages/auth/src/key.ts` exist:
      `ls packages/auth/src/auth.ts packages/auth/src/key.ts`
    If they exist, search for imports:
      `rg "from.*auth.*auth|from.*auth.*key" packages/ apps/`
    If no imports, delete files
    If imports exist, implement functions or update imports
    Run tests: `bun test packages/auth/test/`
    Verify no test failures

**Step 2.3: Remove Deprecated Rerank Re-export**

    Search for imports of `@alfred/rag/rerank`:
      `rg "@alfred/rag/rerank" packages/ apps/`
    Update imports to use `@alfred/rerank` directly
    Remove re-export from `packages/rag/src/rerank.ts`
    Run tests: `bun test packages/rag/test/`
    Verify no test failures

**Step 2.4: Remove Deprecated Edge Functionality**

    Read `apps/web/src/hooks/use-visible-edges.ts`
    Search for imports of `useVisibleEdges`:
      `rg "useVisibleEdges" apps/web/`
    Remove function if no imports
    Update imports if they exist
    Run tests: `bun test apps/web/src/`
    Verify no test failures

**Step 2.5: Archive Deprecated ExecPlans**

    Read `docs/execplans/episodic-dreaming.md`
    Move to `docs/execplans/archive/episodic-dreaming.md`
    Add deprecation notice at top if not present
    Search for other deprecated ExecPlans:
      `rg "@deprecated|Deprecated|deprecated" docs/execplans/`
    Move deprecated plans to archive directory

### Phase 3: Test Infrastructure Refactoring

**Step 3.1: Migrate `assistant.router.test.ts` to Dependency Injection**

    Read `packages/api/test/assistant.router.test.ts`
    Read `docs/architecture/test-dependency-injection.md` for pattern
    Read `packages/api/src/routers/assistant.ts` to understand router structure
    Define `AssistantRouterDeps` interface with injectable dependencies:
      - `generateText: (input) => Promise<GenerateResult>`
      - `handoffExecute: (input) => Promise<HandoffResult>`
    Update router to accept deps via `ctx.deps`
    Update test to create mock deps and pass to `createTestCaller({ deps })`
    Remove top-level `mock.module()` calls
    Remove `RUN_ASSISTANT_ROUTER_TESTS=1` flag requirement
    Run tests: `bun test packages/api/test/assistant.router.test.ts`
    Verify tests pass without flags

**Step 3.2: Replace `mock-db-client.ts` with Real DB Fixtures**

    Read `packages/api/test/utils/mock-db-client.ts`
    Read `@alfred/test-kit` utilities for DB fixtures
    Create integration test file: `packages/api/test/integration/assistant.integration.test.ts`
    Use real DB with ephemeral schema:
      - Create schema before tests
      - Run tests in transactions
      - Clean up after tests
    Migrate tests that need real DB to integration test file
    Keep unit tests with mocks for fast execution
    Run tests: `bun test packages/api/test/integration/`
    Verify integration tests pass

**Step 3.3: Fix Test Isolation Problems**

    Read `packages/api/test/voice.streaming.integration.test.ts`
    Identify shared state causing isolation problems
    Move `mock.module()` calls into test functions or use DI
    Remove `RUN_VOICE_STREAMING_TESTS=1` flag requirement
    Run tests together: `bun test packages/api/test/`
    Verify tests pass without isolation flags

**Step 3.4: Add Missing Error Case Tests**

    For each router in `packages/api/src/routers/`:
      - Read router file
      - Identify missing error cases:
        - Invalid input rejection
        - Permission failures
        - Network timeout handling
        - Partial failure recovery
      - Add tests for missing cases
    Run tests: `bun test packages/api/test/`
    Verify error case tests pass

**Step 3.5: Add Integration Tests for Critical Flows**

    Identify critical flows:
      - Workflow execution (router → pipeline → persistence)
      - Voice pipeline (router → STT → TTS → streaming)
      - Agent execution (router → workspace → Docker)
    Create integration test files for each flow
    Write end-to-end tests that verify integration boundaries
    Run tests: `bun test packages/api/test/integration/`
    Verify integration tests pass

### Phase 4: Legacy Orchestrator Migration

**Step 4.1: Port Resume/Suspend to Canonical Pipeline**

    Read `docs/implementation/pipeline-feature-port.md` Section 1
    Read `packages/runtime/src/workflow/reconstruct.ts` for current implementation
    Read `packages/runtime/src/orchestrator/resume.ts` and `suspend.ts`
    Create `packages/pipeline/src/reconstruct.ts`:
      - Define `PipelineSnapshot` interface
      - Implement `PipelineReconstructor` class
      - Add `reduce()` method to fold events into snapshot
      - Add `reconstruct()` method to rebuild from events
    Add `context:set` event to `packages/pipeline/src/events.ts`
    Emit `context:set` on `ctx.set()` in `packages/pipeline/src/runner.ts`
    Implement `resume()` method in `PipelineRunner`:
      - Restore context from snapshot
      - Skip stages up to `lastCompletedStage`
      - Continue from next stage
    Create `CheckpointObserver` in `packages/pipeline/src/observers/checkpoint.ts`:
      - Persist snapshot after each stage
      - Enable resume capability
    Write tests for resume/suspend functionality
    Run tests: `bun test packages/pipeline/test/`
    Verify resume/suspend works correctly

**Step 4.2: Port Remaining Features**

    For each remaining feature (Event Replay, State Hydration, etc.):
      - Read migration guide section from `docs/implementation/pipeline-feature-port.md`
      - Read current implementation in legacy orchestrator
      - Port to canonical pipeline (stage enhancement or observer)
      - Write tests
      - Verify feature parity
    Run full test suite: `bun test packages/pipeline/test/ packages/runtime/test/`
    Verify all features work correctly

**Step 4.3: Remove Deprecated `runPlanV6` Function**

    Search for imports of `runPlanV6`:
      `rg "runPlanV6|from.*workflow.*runner" packages/ apps/`
    Update all imports to use `@alfred/runtime` instead
    Remove function from `packages/agent/src/workflow/runner.ts`
    Run tests: `bun test packages/agent/test/`
    Verify no test failures

**Step 4.4: Consolidate Small Orchestrator Files**

    Read `docs/retrospective/orchestrator-fragmentation.md` for file list
    Merge related small files:
      - `hydrate.ts` + `resume.ts` → `resume.ts`
      - `agents.ts` + `convert.ts` → `agents.ts`
      - `flatten.ts` + `suspend.ts` → `suspend.ts`
    Update imports in files that reference merged files
    Run tests: `bun test packages/runtime/test/`
    Verify no test failures

### Phase 5: Runtime Integration Completion

**Step 5.1: Integrate Context Gathering**

    Read `packages/runtime/src/core.ts:190-192` placeholder
    Read `@alfred/agent` for `gatherCodeContext` and `gatherWebContext`
    Replace placeholder with real context gathering:
      - Call `gatherCodeContext` for code-related requirements
      - Call `gatherWebContext` for web-related requirements
      - Format context for pipeline consumption
    Emit real context events instead of placeholders
    Write tests to verify context gathering
    Run tests: `bun test packages/runtime/test/`
    Verify context events contain real data

**Step 5.2: Integrate AI SDK Streaming**

    Read `packages/runtime/src/core.ts:199-203` placeholder
    Read `@alfred/agent` for `AISDKAdapter`
    Replace placeholder with real AI SDK streaming:
      - Use `AISDKAdapter` in plan phase
      - Use `AISDKAdapter` in act phase
      - Emit streaming events properly
    Write tests to verify AI SDK streaming
    Run tests: `bun test packages/runtime/test/`
    Verify streaming events are emitted

**Step 5.3: Integrate Tool Execution**

    Read `packages/runtime/src/core.ts:210-214` placeholder
    Read `@alfred/agent/v6` for tool registry
    Replace placeholder with real tool execution:
      - Register tools from `@alfred/agent/v6`
      - Execute tool calls in act phase
      - Emit tool result events
    Write tests to verify tool execution
    Run tests: `bun test packages/runtime/test/`
    Verify tool execution works correctly

**Step 5.4: Implement Report Generation**

    Read `packages/runtime/src/core.ts:221-225` placeholder
    Implement report generation:
      - Summarize workflow execution
      - Include key metrics and outcomes
      - Format report for persistence
    Emit report events instead of placeholders
    Write tests to verify report generation
    Run tests: `bun test packages/runtime/test/`
    Verify reports are generated correctly

### Phase 6: Architecture Cleanup

**Step 6.1: Extract Domain Services from Large Routers**

    Read `packages/api/src/routers/plan.ts` (896 lines)
    Identify business logic that can be extracted:
      - Intent classification
      - Complexity classification
      - Trace generation
    Create domain service: `packages/api/src/services/plan.ts`
    Move business logic to service
    Update router to call service methods
    Ensure router is ≤500 lines
    Run tests: `bun test packages/api/test/plan.*.test.ts`
    Verify tests pass

    Repeat for `voice.ts` and `workflow.ts` routers

**Step 6.2: Merge Related Small Files**

    Read `packages/runtime/src/orchestrator/` directory
    Identify related small files to merge:
      - `agents.ts` (38 lines) + `convert.ts` (43 lines) → `agents.ts`
      - `flatten.ts` (27 lines) + `suspend.ts` (33 lines) → `suspend.ts`
    Merge files, update imports
    Run tests: `bun test packages/runtime/test/`
    Verify no test failures

**Step 6.3: Enforce Architectural Budgets in CI**

    Read `packages/api/test/architecture.godfiles.test.ts`
    Tighten budgets to true targets (≤500 lines)
    Add to CI boundaries job
    Run locally: `bun test packages/api/test/architecture.godfiles.test.ts`
    Verify test fails on violations
    Fix violations or document exceptions

### Phase 7: Security Fixes

**Step 7.1: Gate Test Session Header**

    Read `packages/api/src/context.ts:90-108`
    Add `VITE_TEST_MODE` check:
      - Return null if `VITE_TEST_MODE !== "true"`
      - Only parse header in test mode
    Update tests to set `VITE_TEST_MODE=true`
    Run tests: `bun test packages/api/test/`
    Verify test session header only works in test mode

**Step 7.2: Add Biometric Bypass for Development**

    Read `packages/auth/src/biometric.ts`
    Add `BIO_AUTH_BYPASS` environment variable check
    Implement bypass logic for development
    Document usage in `docs/guides/development.md`
    Verify bypass is not enabled in production
    Run tests: `bun test packages/auth/test/`
    Verify bypass works in development mode

**Step 7.3: Verify Production Security**

    Check environment variables are not set in production
    Run security tests
    Document security practices in `docs/security/`

### Phase 8: Type Safety and Naming Cleanup

**Step 8.1: Audit `any` Usages**

    Search for `any` usages:
      `rg ": any|as any" packages/ apps/ --type ts --type tsx`
    Categorize each usage:
      - Justified: JSONB, mocks, external APIs
      - Fixable: Can use `unknown` + type guards, Zod, generics
    Create tracking document: `docs/reports/any-usage-audit.md`
    Document each usage with category and fix plan

**Step 8.2: Fix Fixable Type Safety Issues**

    Start with high-impact fixes:
      - Replace `coerceRecord()` with Zod schema validation
      - Narrow `any` in hot paths (`packages/knowledge/src/query.hot.ts`)
      - Migrate legacy tool interface to generics
    Add comments to justified cases explaining necessity
    Run typecheck: `bun run typecheck`
    Verify no new type errors

**Step 8.3: Systematic Naming Cleanup**

    Run `bun run check:names` to get violation list
    Prioritize cleanup:
      1. Voice scripts (already documented)
      2. Test utilities (`test-kit`, `api/test/utils`)
      3. Core packages (prioritize hot paths)
    Fix violations incrementally:
      - Rename files/directories
      - Update imports
      - Verify tests pass
    Document exceptions in `.ruler/01-naming-conventions.md`

## Validation and Acceptance

After completing each phase, run the following validation steps:

**Phase 1 Validation:**
Run `bun run check:names` and verify it reports violations or "All checks passed"
Run `bun run check:budgets` and verify it reports violations or "All budgets met"
Verify CI runs both checkers and fails on violations
Check that existing `.hot.ts` files meet their budgets

**Phase 2 Validation:**
Run `bun test packages/api/test/` and verify no test failures
Search for removed code and verify no imports remain
Verify deprecated ExecPlans are archived

**Phase 3 Validation:**
Run `bun test packages/api/test/` and verify all tests pass without flags
Run tests together and verify no isolation problems
Verify test execution time improves (fewer mocks)
Check test coverage increases for error cases

**Phase 4 Validation:**
Run `bun test packages/pipeline/test/` and verify all features work
Run `bun test packages/runtime/test/` and verify no test failures
Verify deprecated `runPlanV6` is removed
Check orchestrator file count decreases (consolidation)

**Phase 5 Validation:**
Run `bun test packages/runtime/test/` and verify runtime emits real events
Check runtime events contain real data (not placeholders)
Verify context gathering, AI SDK streaming, tool execution, and report generation work

**Phase 6 Validation:**
Run `bun test packages/api/test/architecture.godfiles.test.ts` and verify routers ≤500 lines
Check domain services are testable independently
Verify CI enforces architectural budgets

**Phase 7 Validation:**
Run `bun test packages/api/test/` and verify test session header only works in test mode
Verify biometric bypass works in development mode
Check production security is verified

**Phase 8 Validation:**
Run `bun run typecheck` and verify no new type errors
Run `bun run check:names` and verify violations decrease
Check `any` usage count decreases
Verify justified exceptions are documented

**Final Acceptance:**
All phases complete successfully
All tests pass
CI enforces code quality standards
Codebase is free of major technical debt
Documentation is up to date

## Idempotence and Recovery

All phases are designed to be idempotent. Running steps multiple times should not cause issues. If a step fails halfway:

**For Phase 1-2 (Tooling and Dead Code):**
Re-run the step. Tooling is additive and dead code removal is safe to repeat.

**For Phase 3 (Test Infrastructure):**
Tests can be run multiple times. If a test fails, fix the issue and re-run.

**For Phase 4 (Orchestrator Migration):**
Migration is incremental. If a feature port fails, fix the issue and continue with the next feature. Legacy code remains until migration is complete.

**For Phase 5 (Runtime Integration):**
Integration is additive. If a placeholder replacement fails, fix the issue and continue.

**For Phase 6-8 (Architecture, Security, Type Safety):**
Changes are incremental and safe to repeat. If a change fails, revert and fix.

If you need to rollback:
Use git to revert changes: `git revert <commit>`
Re-run tests to verify rollback
Document rollback reason in Decision Log

## Artifacts and Notes

_(To be filled during execution with transcripts, diffs, and snippets that prove success)_

## Interfaces and Dependencies

**New Interfaces:**

In `scripts/check-budgets.ts`, define:
function checkBudgets(): Violation[]
interface Violation { file: string; function: string; measured: number; budget: number; }

In `scripts/check-names.ts`, define:
function checkNames(): Violation[]
interface Violation { file: string; line: number; type: "file" | "symbol" | "param"; message: string; }

In `packages/pipeline/src/reconstruct.ts`, define:
interface PipelineSnapshot { runId: string; lastCompletedStage: StageName | null; contextEntries: Array<[string, unknown]>; timestamp: number; }
class PipelineReconstructor { reduce(snapshot: PipelineSnapshot, event: PipelineEvent): PipelineSnapshot; reconstruct(events: Iterable<PipelineEvent>): PipelineSnapshot; }

In `packages/pipeline/src/events.ts`, add:
type PipelineEvent = ... | { type: "context:set"; key: string; value: unknown; }

In `packages/api/src/services/plan.ts`, define:
export class PlanService { classifyIntent(input: string): Promise<IntentResult>; classifyComplexity(intent: IntentResult): ComplexityLevel; generateTrace(steps: TraceStep[]): Trace; }

**Dependencies:**

- `@alfred/test-kit/src/performance/budget.ts` - Performance measurement utilities
- `@babel/parser` or `typescript` - AST parsing for naming checker
- `@alfred/agent` - Context gathering, AI SDK adapter, tool registry
- `@alfred/runtime` - Runtime implementation (replaces deprecated runner)
- `@alfred/pipeline` - Canonical pipeline (replaces legacy orchestrator)

**External Tools:**

- Bun test runner for all tests
- GitHub Actions for CI enforcement
- TypeScript compiler for type checking
