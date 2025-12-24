# Purity and Performance

## Core Principle

Performance emerges from simplicity, not complexity. Pure functions eliminate side effects, enable optimization, and reduce cognitive load. Every hot path must be pure; every pure function must meet its budget.

## Rules

1. **Pure by default.** Functions that transform data must be pure (no side effects, deterministic outputs). Side effects belong at boundaries (routers, schedulers, DB repos). If a function reads from or writes to external state, it belongs in a boundary layer, not a core transformation.

   **Layer map (pure → impure):**
   - Pure: `packages/cognitive/`, `packages/knowledge/src/graph/`, flow functions, state transitions, validators, normalizers
   - Boundary: `packages/api/src/routers/`, `packages/db/src/repos/`, schedulers, CLI entry points
   - Never mix: A single function must not both transform data AND perform I/O

2. **Performance budgets.** Hot-path functions must declare and meet budgets:
   - `<100 µs`: State transitions, normalizations, pure transforms
   - `<1 ms`: Graph lookups, redaction, validation
   - `<10 ms`: Fact extraction, context building
   - `<100 ms`: Plan generation, complex queries
   - `<16 ms`: UI render cycles (60fps)

   Instrument with `@alfred/metrics/performance` before optimizing. Budget breaches are defects.

3. **Zero allocations in hot loops.** Reuse buffers, avoid spreading arrays, prefer `for` loops over `map`/`filter` when performance matters. Profile allocations before optimizing.

4. **No dependency injection.** Pass dependencies as direct imports, not `deps` objects. Pure functions take data, return data. Callbacks (e.g., `onComplete`) are permitted.

5. **Avoid premature abstraction.** Prefer direct function calls over interfaces, factories, or strategy patterns. Write direct implementations first; extract only when duplication exceeds 80% (rule 12).

6. **Defaults over configuration.** Hardcode sensible defaults (timeouts, limits, retries). Only expose configuration when the default fails in practice. Single-user apps don't need feature flags for core functionality.

7. **Measure before optimizing.** Use `withBudget()` to instrument suspected hotspots. Optimize only when measurements exceed budgets. Pure functions often outperform complex optimizations.

8. **Boundary isolation.** Routers, schedulers, and repos handle persistence, metrics, and side effects. Core logic (runners, flows, transitions) stays pure. Test pure functions in isolation; test boundaries with integration tests.

9. **No type suppressions.** Avoid `@ts-expect-error`, `@ts-ignore`, and `@ts-nocheck` unless absolutely necessary (e.g., test mocks). Type errors indicate real problems—fix the root cause:
   - Use proper type assertions (`as Type`) only after runtime validation
   - Create helper functions with explicit return types
   - Validate schemas before type assertions
   - Prefer helper functions over inline suppressions

10. **Code quality thresholds.**
    - Function length: max 50 lines (hot paths: 30 lines)
    - File size: max 500 lines
    - Test coverage: min 80% for repos, 60% for routers
    - Type coverage: 100% (no `any` except JSONB `as any`)

11. **Performance budget enforcement.** Budget breaches are defects. CI should fail on:
    - Functions exceeding declared budgets
    - Test coverage below thresholds
    - Type suppressions (except documented exceptions)

12. **Code duplication threshold.** When two or more functions or files share >80% identical code, extract shared logic into a reusable function or utility. Duplication above this threshold indicates missing abstraction and increases maintenance burden. Measure duplication by comparing line counts and structure similarity.

13. **Hot modules are real.** Files ending in `.hot.ts` must contain a production-ready fast path; delete or rename any placeholder instead of shipping a stub.

14. **Instrument cognitive hot paths.** `applyTransition`, `updatePhysiology`, `updateAutonomy`, and `calculateError` must wrap their core logic with `performance.now()` timers, record Prometheus histograms, and emit `cognitive_budget_exceeded` warnings whenever they exceed their microsecond budgets.

15. **Expose metrics.** Export cognitive metric registries (e.g., `cognitiveMetricsRegistry`) from package entrypoints and ensure the global metrics server registers them for scraping.

16. **Budget tests.** Every new or modified hot path ships a deterministic warmup-based test that fails when the measured average runtime exceeds the documented budget.
17. **Timestamp injection.** Cognitive state factories and transition helpers must receive timestamps (and other time inputs) from their callers—never call `Date.now()` or similar inside the pure constructors.
18. **Explicit autonomy inputs.** Autonomy helpers (`initialAutonomy`, `updateAutonomy`, constraint checks) must expose timestamp, evidence, and physiology arguments so tests can supply deterministic values; no hidden global reads.
