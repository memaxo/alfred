# 10 Questions About the ALFRED Codebase

These questions probe the core architectural decisions, design patterns, and implementation details that make ALFRED work. Answering them demonstrates deep understanding of the system's intelligence, safety, and performance characteristics.

## 1. Cognitive State Machine & Event Sourcing

**Question:** How does ALFRED's cognitive state machine use event sourcing to maintain deterministic state transitions, and what are the performance implications of replaying events vs. using snapshots for fast hydration?

**Key Areas to Explore:**
- Event sourcing implementation in `packages/cognitive/`
- Snapshot strategy and frequency
- Event replay performance budgets (<100 µs transitions)
- How events feed into the learning system
- State machine transitions: `idle → thinking → deciding → acting → reflecting`

## 2. Hypergraph Memory Architecture

**Question:** Why did ALFRED choose a hypergraph structure over a simple vector database for knowledge storage, and how does the graph topology enable pattern recognition and emergent intelligence?

**Key Areas to Explore:**
- Hypergraph implementation in `packages/knowledge/`
- Node/edge types: facts, relations, insights, patterns
- Query performance budgets (<1 ms lookups)
- How graph structure enables relationship-aware retrieval
- Integration with RAG for semantic search

## 3. Worktree Isolation & Parallel Execution

**Question:** How does ALFRED use Git worktrees to enable parallel agent execution without file contention, and what mechanisms prevent race conditions when multiple agents modify the same repository?

**Key Areas to Explore:**
- Worktree creation and management in `packages/agent/src/environment/worktree.ts`
- Wave-based dependency graph execution
- Conflict detection and resolution via Arbiter
- How worktrees integrate with Docker containers for sandboxing
- Performance implications of worktree overhead

## 4. Policy Engine & Autonomy Gradient

**Question:** How does the policy engine enforce graduated autonomy levels (0.0-1.0) with biometric elevation for high-risk operations, and how is this enforced consistently across runtime, API routers, and tools?

**Key Areas to Explore:**
- Policy Decision Point (PDP) in `packages/policy/`
- Autonomy bands: read-only (≤0.3), suggest (≤0.5), cautious execute (≤0.7), supervised execute (≤0.9), full (1.0)
- Biometric elevation flow via Better Auth
- Token scopes and `elevated`/`mfa` claims
- How obligations (e.g., `requireBio`) suspend workflows

## 5. Pure Function Boundaries & Side Effects

**Question:** How does ALFRED maintain strict separation between pure functions (cognitive state, knowledge graph, learning) and side effects (database writes, network calls), and what benefits does this provide for testing and reasoning about behavior?

**Key Areas to Explore:**
- Pure function implementations in domain packages
- Boundary layers: `packages/api/`, `packages/db/`, `packages/runtime/`
- Context threading pattern for passing state
- How this enables deterministic testing without mocks
- Performance optimization opportunities in pure functions

## 6. Learning System & Self-Supervision

**Question:** How does ALFRED's learning system extract patterns from successful outcomes, analyze mistakes, and infer preferences from behavior, and how does this feedback loop improve future execution?

**Key Areas to Explore:**
- Self-supervision implementation in `packages/learning/`
- Mistake ledger and error analysis
- Pattern extraction from workflow outcomes
- Preference inference from user behavior
- Memory decay and reinforcement mechanisms

## 7. Performance Budgets & Hot Paths

**Question:** What are ALFRED's performance budgets for critical paths (state transitions <100 µs, graph lookups <1 ms, plan generation <100 ms), and how are these enforced and measured?

**Key Areas to Explore:**
- Performance instrumentation in `packages/metrics/`
- Hot path identification and optimization
- Zero-allocation requirements in hot loops
- How budgets guide architectural decisions
- Measurement and alerting infrastructure

## 8. AI SDK v6 Streaming & Tool Execution

**Question:** How does ALFRED use AI SDK v6's streaming capabilities to execute workflows with tool chaining, durable state, suspend/resume, and conflict resolution, and how does this integrate with the cognitive loop?

**Key Areas to Explore:**
- Workflow runtime in `packages/runtime/src/orchestrator/`
- Tool registry in `packages/agent/src/orchestrator/tool/`
- Stream event types and normalization
- Suspend/resume for obligations (biometric elevation)
- How tool results feed back into cognitive state

## 9. Voice Processing Architecture

**Question:** How does ALFRED's voice system support real-time bidirectional streaming with VAD-driven interruptibility (barge-in), and how does it handle local model fallbacks (Faster-Whisper STT, Piper TTS) vs. OpenAI APIs?

**Key Areas to Explore:**
- Voice provider selection via `VOICE_PROVIDER` env var
- Process pool management for Python subprocesses
- IPC protocol (JSON lines over stdin/stdout)
- Device detection (MPS, ROCm, CUDA, CPU)
- Streaming support and latency budgets (<100ms STT, <300ms TTS)

## 10. Linear Integration & Agent Activities

**Question:** How does ALFRED function as a first-class Linear agent by automatically emitting progress updates during workflow execution, and how does it handle the 10-second acknowledgment requirement and retry logic?

**Key Areas to Explore:**
- Linear helper module in `packages/agent/src/orchestrator/linear.ts`
- Agent Activities API integration
- Non-blocking activity emissions (fire-and-forget)
- Exponential backoff retry logic via `p-retry`
- Webhook handler for Linear events

---

## How to Use These Questions

These questions are designed to:
- **Onboard new developers**: Answering them provides comprehensive understanding of ALFRED's architecture
- **Code reviews**: Use them to verify architectural understanding before approving changes
- **Documentation gaps**: Identify areas where documentation needs improvement
- **Architecture discussions**: Guide technical design decisions and trade-offs
- **Interview preparation**: Demonstrate deep knowledge of the system

Each question requires understanding multiple packages and their integration patterns, reflecting ALFRED's philosophy that intelligence emerges from composition, not isolation.
