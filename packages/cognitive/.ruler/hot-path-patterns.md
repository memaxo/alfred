# Hot Path Performance Patterns

## Core Principle

Cognitive transitions must execute within µs budgets. Use `performance.now()` for measurement and Prometheus histograms for observability.

## Rules

1. **Transition timing.** Wrap `applyTransition` core logic with `performance.now()` timers. Record duration to Prometheus histogram `cognitive_transition_duration` with labels `{from_state, to_state, event_type}`.

2. **Budget enforcement.** Transitions must complete <100 µs. Log warnings when budget exceeded. Budget breaches are defects in CI.

3. **No allocations in transitions.** Reuse objects, avoid spreading arrays, prefer `for` loops.

4. **Pure transition function.** `applyTransition` must return new state and autonomy. Never emit side effects. Emit effects at boundary layer.

5. **Timestamp injection.** Event objects must include timestamps. Transitions extract timestamps from events, never call `Date.now()` internally.

6. **Deterministic tests.** Pass explicit timestamps to test helpers: `initialAutonomy(now)`, `applyTransition(state, autonomy, { _: "input", ts: now, ... })`. Never patch `Date.now()`.

7. **Performance tests.** Every hot path ships a warmup-based test that fails when average runtime exceeds budget. Use `withBudget` helper from `@alfred/metrics/performance`.

## See Also

- `.ruler/09-purity-and-performance.md` in root for budget enforcement patterns
