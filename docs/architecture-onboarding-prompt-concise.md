# ALFRED Architecture Onboarding Prompt (Concise)

You are tasked with creating a comprehensive architecture report for ALFRED, a personal AI assistant with a sophisticated cognitive architecture. Your audience is a senior architect who needs to quickly understand how ALFRED learns, remembers, forgets, operates autonomously, and prioritizes tasks.

## Your Task

Create a 15-20 page markdown report (`docs/architecture/cognitive-architecture-report.md`) that explains:

1. **Cognitive Architecture**: Event-sourced state machine with physiology (energy/boredom/frustration), Bayesian autonomy gradient, brainstem supervisor, and pure state transitions (<100µs budget)

2. **Learning System**: Both explicit (user feedback) and implicit (outcome observation) learning mechanisms, self-supervision from prediction errors, mistake analysis, and pattern extraction

3. **Memory System**: Hypergraph structure (facts/relations/insights/patterns), active recall reinforcement, memory decay with safety rails, hybrid retrieval (semantic + structural), and integration with cognitive state

4. **Autonomy & Decision-Making**: Bayesian Beta priors for autonomy levels, evidence weighting, reliability decay, constraint checking, and how autonomy bands (read-only → suggest → cautious → supervised → full) are enforced

5. **Runtime Integration**: How the runtime layer orchestrates cognitive, knowledge, and learning packages, context building, workflow execution via AI SDK v6, and outcome recording

6. **Frontend Integration**: Streaming architecture, cognitive state visualization (Mindscape), and real-time UI updates

## Key Focus Areas

**For Cognitive Architecture:**
- Explain the event-sourced state machine (states: idle, capturing, thinking, deciding, executing, reflecting)
- Detail how physiology regulates autonomy (energy/boredom/frustration → autonomy multipliers)
- Describe Bayesian autonomy updates (Beta prior, evidence types, reliability weighting, decay)
- Show how the brainstem supervisor detects loops and zombie processes
- Include the cognitive loop integration (`runCognitiveLoop`)

**For Learning:**
- Distinguish explicit learning (user feedback via `cognitive.feedback`) from implicit learning (outcome observation)
- Explain self-supervision: how prediction errors become knowledge updates
- Detail mistake analysis: how failures are recorded and inform future decisions
- Show pattern extraction: how successful workflows become reusable patterns
- Describe confidence scoring and how learnings feed into autonomy updates

**For Memory:**
- Explain hypergraph structure (HAMT content addressing, node types, relations)
- Detail active recall: how accessed nodes get confidence boosts
- Describe memory decay: confidence decreases over time, safety rails prevent complete forgetting
- Show retrieval mechanisms: semantic (vector), structural (graph traversal), hybrid queries
- Explain integration: how memory feeds into context building and cognitive state

**For Autonomy:**
- Explain autonomy bands and when each is used
- Detail evidence types (success, failure, feedback, override) and reliability weighting
- Describe constraint checking (`meetsConstraints` returns `{ allowed, reason }`)
- Show how physiology multipliers are applied after Bayesian updates
- Explain policy integration: how autonomy levels trigger policy checks

## Required Diagrams (Mermaid format)

1. Cognitive state machine transition graph
2. Autonomy update flow (Beta prior → evidence → physiology multipliers)
3. Cognitive loop sequence diagram (input → load → transition → persist → effects)
4. Hypergraph structure (node types and relationships)
5. Query flow (index selection and retrieval)
6. Memory decay timeline (confidence curves)
7. Workflow execution flow (request → context → AI SDK → events → outcome)
8. Learning integration (how learning feeds knowledge and cognitive systems)
9. Runtime architecture (orchestration of domain packages)
10. Frontend streaming (UI consumption of events)

## Code References

Include specific file paths and line numbers for:
- Key type definitions: `packages/cognitive/src/state.ts`, `packages/knowledge/src/hypergraph.ts`
- Critical algorithms: `packages/cognitive/src/logic/autonomy.ts`, `packages/learning/src/self_supervision.ts`
- Integration points: `packages/runtime/src/context.ts`, `packages/api/src/routers/workflow.ts`
- Performance-critical code: `packages/cognitive/src/transition.ts`, `packages/knowledge/src/query.hot.ts`

## Notable Patterns to Highlight

1. **Pure Function Pattern**: Domain logic is pure (no side effects), boundaries handle I/O
2. **Event Sourcing**: All state changes via events, deterministic replay
3. **Performance Budgets**: Enforced with metrics, `.hot.ts` suffix for critical paths
4. **Type Safety**: Branded types (`Timestamp`, `Confidence`, `Autonomy`), discriminated unions
5. **Boundary Pattern**: Routers/repos/schedulers handle side effects, core stays pure

## Key Architecture Decisions to Explain

1. **Why hypergraph over vector-only?** Relations matter as much as facts, enables structural queries
2. **Why event sourcing?** Deterministic replay, audit trail, temporal queries
3. **Why Bayesian autonomy?** Probabilistic reasoning matches real-world uncertainty
4. **Why single-user focus?** Enables aggressive personalization, no multi-tenancy overhead
5. **Why pure functions at core?** Performance, testability, composability

## Report Structure

1. **Executive Summary** (1-2 pages): What ALFRED is, core differentiators, architecture philosophy
2. **Cognitive Architecture Deep Dive** (3-4 pages): State machine, physiology, autonomy, supervisor, loop
3. **Learning System Architecture** (2-3 pages): Self-supervision, mistake analysis, explicit/implicit learning
4. **Memory System Architecture** (3-4 pages): Hypergraph, storage/retrieval, active recall, decay
5. **Runtime Architecture** (2-3 pages): Orchestration, workflow execution, context building, outcomes
6. **Frontend Integration** (2 pages): Streaming, visualization, state sync
7. **Notable Code Patterns** (2-3 pages): Pure functions, event sourcing, boundaries, budgets, types
8. **Key Architecture Decisions** (2-3 pages): Rationale for major choices
9. **Integration Points** (1-2 pages): How domains connect
10. **Performance Characteristics** (1 page): Budgets, hot paths, metrics
11. **Testing Strategy** (1 page): Unit, integration, E2E approaches

## Success Criteria

The report succeeds if a senior architect can:
- Understand how ALFRED's cognitive architecture differs from standard chatbots
- Explain how learning works (explicit and implicit)
- Describe memory storage, retrieval, and decay mechanisms
- Evaluate autonomy decision-making and constraint checking
- Identify integration points between cognitive, knowledge, learning, and runtime
- Assess architectural strengths and potential concerns
- Navigate the codebase confidently using provided file references

## Formatting

- Use clear section headings
- Include code snippets (max 10 lines) for illustrative patterns
- Use bullet points for lists
- Bold key terms on first mention
- Include "See also" cross-references
- Add "Key Takeaway" boxes for critical insights

Begin by exploring the codebase structure, then create the comprehensive report with all required sections and diagrams.
