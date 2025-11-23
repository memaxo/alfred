# Cognitive Architecture Rules

1. **Pure transitions.** Cognitive state updates are pure functions `transition(state, event)` with no side effects. Emit effects separately and interpret them at the boundary layer.
2. **Single active state.** The cognitive state machine holds exactly one discriminated union at any time (`idle`, `capturing`, `thinking`, `deciding`, `executing`, `reflecting`). Never mix partial states or optional fields.
3. **Event sourcing.** All inputs arrive as typed events (`input`, `timeout`, `feedback`, `interrupt`). Persist the raw events before processing so history can be replayed deterministically.
4. **Knowledge hypergraph.** Facts, relations, insights, and patterns must be stored via the graph repository. Maintain HAMT/interval/B-tree indices to keep queries within the defined budgets.
5. **Performance budgets.** Enforce: transitions `<100 µs`, graph lookups `<1 ms`, fact extraction `<10 ms`, plan generation `<100 ms`, consolidation `<50 ms` amortised. Instrument hotspots before optimising.
6. **Autonomy gradient.** Honour the autonomy bands (read-only ≤0.3, suggest ≤0.5, cautious execute ≤0.7, supervised execute ≤0.9, full ≤1.0). Escalate to policy checks whenever the band changes.
7. **Flows stay pure.** Capture, synthesize, execute, and reflect return data + effects. Never mutate shared state inside a flow; let the orchestrator commit results.
8. **Tool Modularity.** Agent tools (`packages/agent/src/orchestrator/tool/*`) must be split into `definition.ts` (schemas/types), `policy.ts` (security/permissions), and `exec.ts` (runtime logic) when they require custom execution logic beyond a simple function call.
10. **Physiological regulation.** The `CognitiveState` includes `Physiology` (energy, boredom, frustration). Updates to physiology must act as homeostatic regulators on `AutonomyGradient` (e.g., high frustration -> lower autonomy).
11. **Brainstem supervision.** A deterministic `Supervisor` monitors semantic entropy and process heartbeats. Low entropy (loops) or zombie processes must trigger an `interrupt` event, forcing a state transition.
12. **Conflict arbitration.** Multi-agent writes use optimistic concurrency. Merge conflicts must be resolved by spawning an `Arbiter` agent, not by failing the workflow.
