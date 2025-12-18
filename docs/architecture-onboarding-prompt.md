# ALFRED Architecture Onboarding Prompt

## Task

Create a comprehensive architecture report for ALFRED that enables a senior architect to quickly understand the cognitive, neural, learning, memory, runtime, and frontend integration architecture. The report should balance technical depth with clarity, focusing on how ALFRED learns, forgets, remembers, operates autonomously, prioritizes tasks, and implements both explicit and implicit learning mechanisms.

## Audience

**Target:** Senior architect joining the project who needs to:
- Understand the cognitive architecture deeply
- Review learning mechanisms (explicit and implicit)
- Evaluate memory systems (storage, retrieval, decay)
- Assess autonomy and decision-making systems
- Understand task prioritization and workflow orchestration
- Grasp the integration between cognitive, knowledge, learning, and runtime layers

**Constraints:**
- Limited time for onboarding (report should be digestible in 2-3 hours)
- Needs actionable technical details, not marketing fluff
- Must understand both high-level design and key implementation patterns
- Should identify architectural strengths and potential concerns

## Report Structure

### 1. Executive Summary (1-2 pages)
- **What ALFRED is**: Personal AI assistant with cognitive architecture, not a chatbot
- **Core differentiators**: Event-sourced cognitive state, hypergraph memory, Bayesian autonomy, self-supervision
- **Architecture philosophy**: Pure functions at core, side effects at boundaries, performance budgets, single-user focus
- **Key architectural decisions**: Why hypergraph over vector-only, why event-sourcing, why Bayesian autonomy

### 2. Cognitive Architecture Deep Dive (3-4 pages)

#### 2.1 State Machine Design
- **Event-sourced state machine**: Pure transitions, event persistence, snapshot hydration
- **State types**: `idle`, `capturing`, `thinking`, `deciding`, `executing`, `reflecting`
- **Key files**: `packages/cognitive/src/state.ts`, `packages/cognitive/src/transition.ts`
- **Performance budget**: <100µs per transition (enforced with metrics)
- **Diagram**: State transition graph showing all states and valid transitions

#### 2.2 Physiology System
- **Components**: Energy, boredom, frustration metrics
- **Homeostatic regulation**: How physiology affects autonomy levels
- **Key files**: `packages/cognitive/src/state.ts` (Physiology type), `packages/cognitive/src/logic/autonomy.ts`
- **Pattern**: Pure functions that compute physiology updates based on events

#### 2.3 Autonomy Gradient
- **Bayesian Beta prior**: Alpha/beta parameters track success/failure history
- **Autonomy bands**: 
  - Read-only (0.0-0.3)
  - Suggest (0.3-0.5)
  - Cautious execute (0.5-0.7)
  - Supervised execute (0.7-0.9)
  - Full (0.9-1.0)
- **Evidence types**: Success, failure, feedback, override
- **Reliability weighting**: How evidence reliability affects updates
- **Decay mechanism**: Autonomy decays over time without evidence
- **Key files**: `packages/cognitive/src/logic/autonomy.ts`
- **Diagram**: Autonomy update flow showing Beta prior updates, evidence weighting, physiology multipliers

#### 2.4 Brainstem Supervisor
- **Purpose**: Monitors semantic entropy and process heartbeats
- **Loop detection**: Low entropy triggers interrupt events
- **Zombie detection**: Missing heartbeats trigger recovery
- **Key files**: `packages/cognitive/src/flows.ts` (Supervisor logic)

#### 2.5 Cognitive Loop Integration
- **Runtime integration**: How `runCognitiveLoop` orchestrates state transitions
- **Event flow**: Input → Load state → Apply transition → Persist event → Emit effects
- **Key files**: `packages/runtime/src/cognitive.ts` (if exists) or integration points
- **Diagram**: Sequence diagram showing cognitive loop execution

### 3. Learning System Architecture (2-3 pages)

#### 3.1 Self-Supervision
- **Outcome recording**: Prediction vs. actual comparison
- **Error calculation**: How prediction errors are quantified
- **Pattern extraction**: How successful workflows become patterns
- **Key files**: `packages/learning/src/self_supervision.ts`
- **Pattern**: Pure function `supervise(event)` returns knowledge updates

#### 3.2 Mistake Analysis
- **Mistake ledger**: How failures are recorded and analyzed
- **Correction mechanisms**: How mistakes inform future decisions
- **Key files**: `packages/learning/src/mistake_ledger.ts`
- **Integration**: How mistakes feed back into autonomy updates

#### 3.3 Explicit Learning
- **User feedback**: Direct feedback mechanisms (`cognitive.feedback` endpoint)
- **Preference inference**: How user behavior informs preferences
- **Key files**: `packages/api/src/routers/cognitive.ts` (feedback endpoint)

#### 3.4 Implicit Learning
- **Outcome observation**: Learning from workflow results without explicit feedback
- **Pattern recognition**: Extracting patterns from successful sequences
- **Confidence scoring**: How learning confidence is calculated
- **Integration points**: How learning feeds into knowledge graph and cognitive state

### 4. Memory System Architecture (3-4 pages)

#### 4.1 Hypergraph Structure
- **Node types**: Facts, relations, insights, patterns
- **Content addressing**: HAMT-based deduplication
- **Key files**: `packages/knowledge/src/hypergraph.ts`
- **Diagram**: Hypergraph structure showing node types and relationships

#### 4.2 Storage and Retrieval
- **Indices**: HAMT, interval trees, B-trees, R-trees for different query types
- **Query types**: Semantic (vector), structural (graph traversal), hybrid
- **Performance budgets**: <1ms for graph lookups, <10ms for fact extraction
- **Key files**: `packages/knowledge/src/query.hot.ts`, `packages/knowledge/src/indices/*.ts`
- **Diagram**: Query flow showing index selection and retrieval paths

#### 4.3 Active Recall Reinforcement
- **Touch mechanism**: Nodes accessed get confidence boosts
- **Recency weighting**: Recent access increases relevance
- **Key files**: `packages/knowledge/src/hypergraph.ts` (touch logic)

#### 4.4 Memory Decay
- **Decay model**: Confidence decreases over time without access
- **Safety rails**: Decay limit, confidence floor prevent complete forgetting
- **Bulk operations**: Efficient decay updates via SQL `UPDATE ... FROM (VALUES ...)`
- **Key files**: `packages/knowledge/src/persist.ts` (decay logic)
- **Metrics**: `memory_nodes_decayed_total`, `memory_nodes_pruned_total`
- **Diagram**: Decay timeline showing confidence curves

#### 4.5 Memory Integration
- **Context building**: How memory feeds into workflow context
- **Provenance**: How RAG documents link to reasoning nodes
- **Key files**: `packages/runtime/src/context.ts` (context building)

### 5. Runtime Architecture (2-3 pages)

#### 5.1 Runtime Layer Purpose
- **Orchestration**: Composes cognitive, knowledge, learning packages
- **Separation of concerns**: Pure domain logic vs. runtime coordination
- **Key files**: `packages/runtime/src/*.ts`

#### 5.2 Workflow Execution
- **AI SDK v6 integration**: How `streamText` orchestrates tool calls
- **Event normalization**: Converting AI SDK events to `WorkflowEvent`
- **Context building**: Multi-domain context assembly before execution
- **Key files**: `packages/runtime/src/workflow.ts`, `packages/api/src/routers/workflow.ts`
- **Diagram**: Workflow execution flow from request to completion

#### 5.3 Context Building
- **Sources**: User preferences, knowledge graph, cognitive state, learnings
- **Assembly**: How context is composed and passed to AI SDK
- **Caching**: `RuntimeContext.scanContext` for cache handoff
- **Key files**: `packages/runtime/src/context.ts`

#### 5.4 Outcome Recording
- **Success/failure tracking**: How outcomes feed into learning system
- **Knowledge updates**: How successful patterns become graph edges
- **Key files**: `packages/runtime/src/core.ts` (outcome recording)

### 6. Frontend Integration (2 pages)

#### 6.1 Streaming Architecture
- **AI SDK v6 hooks**: `useChat`, `useAssistantStream` for real-time updates
- **Event types**: `StreamEvent` discriminated unions
- **Key files**: `apps/web/src/hooks/*.ts`, `packages/ui/src/chat/*.ts`

#### 6.2 Cognitive State Visualization
- **Mindscape**: Graph visualization of knowledge and cognitive state
- **Voice integration**: OrbNode visualization with VAD levels
- **Key files**: `apps/web/src/routes/mindscape.tsx`

#### 6.3 State Synchronization
- **Optimistic updates**: How UI handles streaming updates
- **Error handling**: Error boundaries and retry mechanisms
- **Key files**: `apps/web/src/components/chat-container.tsx`

### 7. Notable Code Patterns (2-3 pages)

#### 7.1 Pure Function Pattern
- **Core principle**: Domain logic is pure (no side effects)
- **Examples**: `applyTransition`, `supervise`, `updateAutonomy`
- **Benefits**: Testability, performance, determinism

#### 7.2 Event Sourcing Pattern
- **Implementation**: All state changes via events
- **Persistence**: `cognitive_events` table with snapshots
- **Replay**: Deterministic state reconstruction
- **Key files**: `packages/cognitive/src/state.ts`, `packages/db/src/schema/cognitive.ts`

#### 7.3 Boundary Pattern
- **Separation**: Pure core vs. impure boundaries
- **Boundaries**: Routers, repos, schedulers handle I/O
- **Examples**: `packages/api/src/routers/*.ts` (boundaries), `packages/cognitive/src/*.ts` (pure)

#### 7.4 Performance Budget Pattern
- **Enforcement**: Metrics track budget violations
- **Hot paths**: `.hot.ts` suffix for performance-critical files
- **Examples**: `packages/cognitive/src/transition.ts`, `packages/knowledge/src/query.hot.ts`

#### 7.5 Type Safety Pattern
- **Branded types**: `Timestamp`, `Confidence`, `Autonomy` prevent mixing
- **Discriminated unions**: State machine states, event types
- **Zero `any`**: Strict typing throughout (except JSONB `as any` pattern)

### 8. Key Architecture Decisions (2-3 pages)

#### 8.1 Why Hypergraph Over Vector-Only?
- **Rationale**: Relations matter as much as facts
- **Benefits**: Structural queries, pattern recognition, hybrid search
- **Trade-offs**: More complex than pure vector DB

#### 8.2 Why Event Sourcing?
- **Rationale**: Deterministic replay, audit trail, temporal queries
- **Benefits**: Debugging, learning from history, state reconstruction
- **Trade-offs**: Storage overhead, snapshot complexity

#### 8.3 Why Bayesian Autonomy?
- **Rationale**: Probabilistic reasoning matches uncertainty in real-world decisions
- **Benefits**: Confidence intervals, reliability weighting, natural decay
- **Trade-offs**: More complex than simple counters

#### 8.4 Why Single-User Focus?
- **Rationale**: Enables aggressive personalization, no multi-tenancy overhead
- **Benefits**: Deep learning, direct infrastructure access, privacy
- **Trade-offs**: Not scalable to multiple users (by design)

#### 8.5 Why Pure Functions at Core?
- **Rationale**: Performance, testability, composability
- **Benefits**: Hot paths meet budgets, easy to test, predictable
- **Trade-offs**: More function parameters (no dependency injection)

### 9. Integration Points (1-2 pages)

#### 9.1 Cognitive ↔ Knowledge
- **How**: Cognitive state queries knowledge graph for context
- **When**: During context building, after execution
- **Key files**: `packages/runtime/src/context.ts`

#### 9.2 Learning ↔ Knowledge
- **How**: Successful patterns become graph edges, mistakes marked as anti-patterns
- **When**: After outcome recording
- **Key files**: `packages/learning/src/self_supervision.ts`, `packages/knowledge/src/hypergraph.ts`

#### 9.3 Cognitive ↔ Learning
- **How**: Autonomy updates use learning evidence, mistakes affect autonomy
- **When**: During autonomy updates, after mistake detection
- **Key files**: `packages/cognitive/src/logic/autonomy.ts`, `packages/learning/src/mistake_ledger.ts`

#### 9.4 Runtime ↔ All Domains
- **How**: Runtime orchestrates all domain packages
- **When**: During workflow execution, context building, outcome recording
- **Key files**: `packages/runtime/src/*.ts`

### 10. Performance Characteristics (1 page)

#### 10.1 Budgets
- Cognitive transitions: <100µs
- Graph lookups: <1ms
- Fact extraction: <10ms
- Context building: <100ms
- Plan generation: <100ms

#### 10.2 Hot Paths
- Files with `.hot.ts` suffix
- Zero-allocation patterns in hot loops
- Reused buffers, no array spreading

#### 10.3 Metrics
- Prometheus metrics for all budgets
- `cognitive_budget_exceeded` warnings
- Performance regression detection

### 11. Testing Strategy (1 page)

#### 11.1 Unit Tests
- Pure functions tested in isolation
- Deterministic time injection (no `Date.now()` patching)
- Key files: `packages/cognitive/test/*.test.ts`

#### 11.2 Integration Tests
- Runtime composition with mocked AI SDK
- Database operations with test DB
- Key files: `packages/runtime/test/*.test.ts`

#### 11.3 E2E Tests
- Full workflow execution
- Suspend/resume flows
- Key files: `apps/web/test/*.test.ts`

## Diagram Requirements

Create the following diagrams (Mermaid format preferred):

1. **Cognitive State Machine**: State transition graph
2. **Autonomy Update Flow**: Beta prior updates, evidence weighting, physiology multipliers
3. **Cognitive Loop Sequence**: Input → Load → Transition → Persist → Effects
4. **Hypergraph Structure**: Node types and relationships
5. **Query Flow**: Index selection and retrieval paths
6. **Memory Decay Timeline**: Confidence curves over time
7. **Workflow Execution Flow**: Request → Context → AI SDK → Events → Outcome
8. **Learning Integration**: How learning feeds into knowledge and cognitive systems
9. **Runtime Architecture**: How runtime orchestrates domain packages
10. **Frontend Streaming**: How UI consumes cognitive and workflow events

## Code References

Include specific file paths and line numbers for:
- Key type definitions
- Critical algorithms
- Integration points
- Performance-critical code

## Formatting Guidelines

- Use clear section headings
- Include code snippets (max 10 lines) for illustrative patterns
- Use bullet points for lists
- Bold key terms on first mention
- Include "See also" cross-references between sections
- Add "Key Takeaway" boxes for critical insights

## Deliverable

A single markdown document (`docs/architecture/cognitive-architecture-report.md`) that:
- Is 15-20 pages when rendered
- Includes all required diagrams
- Provides actionable technical details
- Balances depth with clarity
- Enables a senior architect to understand and evaluate the system

## Success Criteria

The report succeeds if a senior architect can:
1. Understand how ALFRED's cognitive architecture differs from standard chatbots
2. Explain how learning works (explicit and implicit)
3. Describe memory storage, retrieval, and decay mechanisms
4. Evaluate autonomy decision-making and constraint checking
5. Identify integration points between cognitive, knowledge, learning, and runtime
6. Assess architectural strengths and potential concerns
7. Navigate the codebase confidently using provided file references
