# Cognitive Architecture Rules

1. **Pure transitions.** Cognitive state updates are pure functions `transition(state, event)` with no side effects. Emit effects separately and interpret them at the boundary layer.
2. **Single active state.** The cognitive state machine holds exactly one discriminated union at any time (`idle`, `capturing`, `thinking`, `deciding`, `executing`, `reflecting`). Never mix partial states or optional fields.
3. **Event sourcing.** All inputs arrive as typed events (`input`, `timeout`, `feedback`, `interrupt`). Persist the raw events before processing so history can be replayed deterministically.
4. **Knowledge hypergraph.** Facts, relations, insights, and patterns must be stored via the graph repository. Maintain HAMT/interval/B-tree indices to keep queries within the defined budgets.
5. **Performance budgets.** Enforce: transitions `<100 µs`, graph lookups `<1 ms`, fact extraction `<10 ms`, plan generation `<100 ms`, consolidation `<50 ms` amortised. Instrument hotspots before optimising.
6. **Autonomy gradient.** Honour the autonomy bands (read-only ≤0.3, suggest ≤0.5, cautious execute ≤0.7, supervised execute ≤0.9, full ≤1.0). Escalate to policy checks whenever the band changes.
7. **Flows stay pure.** Capture, synthesize, execute, and reflect return data + effects. Never mutate shared state inside a flow; let the orchestrator commit results.
8. **Learning from error.** Every action records `{prediction, actual, error}` and feeds the learning routines. Missing telemetry is treated as a defect.
