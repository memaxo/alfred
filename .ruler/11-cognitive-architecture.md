# Cognitive Architecture Rules

1. **Pure transitions.** Cognitive state updates are pure functions `transition(state, event)` with no side effects. Emit effects separately and interpret them at the boundary layer.
2. **Single active state.** The cognitive state machine holds exactly one discriminated union at any time (`idle`, `capturing`, `thinking`, `deciding`, `executing`, `reflecting`). Never mix partial states or optional fields.
3. **Event sourcing.** All inputs arrive as typed events (`input`, `timeout`, `feedback`, `interrupt`). Persist the raw events before processing so history can be replayed deterministically.
4. **Knowledge hypergraph.** Facts, relations, insights, and patterns must be stored via the graph repository. Maintain HAMT/interval/B-tree indices to keep queries within the defined budgets.
5. **Performance budgets.** Enforce: transitions `<100 µs`, graph lookups `<1 ms`, fact extraction `<10 ms`, plan generation `<100 ms`, consolidation `<50 ms` amortised. Instrument hotspots before optimising.
6. **Autonomy gradient.** Honour the autonomy bands (read-only ≤0.3, suggest ≤0.5, cautious execute ≤0.7, supervised execute ≤0.9, full ≤1.0). Escalate to policy checks whenever the band changes.
7. **Flows stay pure.** Capture, synthesize, execute, and reflect return data + effects. Never mutate shared state inside a flow; let the orchestrator commit results.
8. **Tool Modularity.** Agent tools (`packages/agent/src/orchestrator/tool/*`) must be split into `definition.ts` (schemas/types), `policy.ts` (security/permissions), and `exec.ts` (runtime logic) when they require custom execution logic beyond a simple function call.
9. **Synthesis fidelity.** `synthesize()` remains async, calls the shared embedder, and must emit contradiction objects, semantic relations, and entity-cluster insights so no caller treats it as a synchronous stub.
10. **Physiological regulation.** The `CognitiveState` includes `Physiology` (energy, boredom, frustration). Updates to physiology must act as homeostatic regulators on `AutonomyGradient` (e.g., high frustration -> lower autonomy).
11. **Brainstem supervision.** A deterministic `Supervisor` monitors loops and process heartbeats using `LoopDetector`. Low entropy (loops) or zombie processes trigger an `interrupt` event, forcing a state transition.
18. **LoopDetector layering.** `LoopDetector` checks for loops in cost-ordered layers: COUNT (O(1)) → TIME (O(1)) → HASH (O(n), exact match) → QUANTIZED (O(n), embedding similarity). Embeddings are the canonical similarity measure; all other checks are cheap prefilters.
19. **Loop detection thresholds.** Default thresholds: `maxTransitions=500`, `stallMs=60000`, `windowSize=8`, `similarityThreshold=0.92`. Override via `LoopConfig` for specific use cases.
20. **Canonical cosineSimilarity.** Use `cosineSimilarity` from `@alfred/embed` for all embedding comparisons. Do not duplicate implementations across packages.
12. **Conflict arbitration.** Multi-agent writes use optimistic concurrency. Merge conflicts must be resolved by spawning an `Arbiter` agent, not by failing the workflow.
13. **Bayesian autonomy.** `AutonomyGradient` carries Beta priors (`alpha`,`beta`), updates them with reliability-weighted evidence plus decay, and derives `level` from the Beta mode with `confidence = 1 - variance`.
14. **Post-update regulation.** Apply physiology multipliers (frustration, energy, boredom) only after the Bayesian autonomy update so the probability math stays pure.
15. **Constraint telemetry.** `meetsConstraints` must always return `{ allowed, reason }` with stable reason codes instead of bare booleans so downstream agents can log or branch deterministically.
16. **Deterministic time.** Cognitive tests shall pass explicit timestamps into helpers (e.g., `initialAutonomy(now)`, `updateAutonomy(now, …)`) rather than patching `Date.now()`.
17. **Reliability clamp.** When autonomy evidence arrives with reliability ≤0, the update must be a no-op for both autonomy level and the Beta prior (tests must assert this).
