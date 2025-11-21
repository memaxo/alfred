# ALFRED Architecture Overview

**Last Updated**: 2025-11-21

## System Vision

ALFRED is a **personal AI assistant** designed for deep single-user personalization across multiple domains. Unlike multi-tenant SaaS products, ALFRED prioritizes learning the user's specific infrastructure, preferences, and workflows to become increasingly valuable over time.

## Core Principles

### 1. Integration Over Isolation
Packages are well-separated but must compose seamlessly. The architecture favors clean interfaces between packages while ensuring they work together as a cohesive intelligence system.

### 2. Learning Over Static Behavior
ALFRED improves through continuous feedback loops. Every interaction informs future behavior through:
- Pattern extraction from successful outcomes
- Mistake analysis and correction
- Preference inference from behavior
- Domain-specific knowledge accumulation

### 3. Context-Aware Execution
Every action considers:
- User preferences (response style, tool choices)
- Past outcomes (what worked, what didn't)
- Domain knowledge (infrastructure topology, code patterns)
- Cognitive state (attention, focus, overload)

### 4. Safe Autonomy
Security boundaries with biometric elevation for high-risk operations. The policy engine enforces graduated autonomy levels with appropriate safeguards, enforced consistently across runtime, API routers, and tools.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  apps/web (TanStack Start) | apps/native (React Native)    │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    API Layer (tRPC)                          │
│  packages/api - Routers, Context, Middleware, Metrics       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│              Runtime Integration Layer                      │
│  packages/runtime - Composes all domain packages            │
│  - CoreRuntime: Context building, outcome recording         │
│  - WorkflowRuntime: AI SDK streaming, tool execution        │
│  - Domain Runtimes: Specialized contexts (Proxmox, Git)     │
└─────────┬───────────────────┬───────────────────┬───────────┘
          │                   │                   │
┌─────────┴─────────┐ ┌───────┴────────┐ ┌───────┴──────────┐
│  Domain Packages  │ │  Tool Packages │ │  Infrastructure  │
│  - cognitive      │ │  - agent       │ │  - db            │
│  - knowledge      │ │    (tools)     │ │  - auth          │
│  - learning       │ │                │ │  - policy        │
│  - rag            │ │                │ │  - metrics       │
└───────────────────┘ └────────────────┘ └──────────────────┘
```

## Package Responsibilities

### Runtime Layer

**`packages/runtime/`** - The conductor that orchestrates all domain packages, implemented per the Phase 3 runtime ExecPlans.

- **CoreRuntime**: Composes cognitive, knowledge, learning, policy
- **WorkflowRuntime**: Executes workflows with real AI SDK streaming
- **ContextBuilder**: Gathers multi-domain context before execution
- **DomainRuntimes**: Specialized contexts (Proxmox, Development, Productivity)

This is the **integration layer** that makes all other packages work together.

### Domain Packages

**`packages/cognitive/`** - Cognitive state management
- State machine (idle, thinking, deciding, acting, learning, reflecting)
- Transitions based on events
- Attention and focus tracking
- Cognitive load management

**`packages/knowledge/`** - Hypergraph memory
- Facts, relations, insights, patterns
- HAMT/interval/B-tree indices
- Semantic queries
- Pattern recognition

**`packages/learning/`** - Self-supervision and improvement
- Outcome recording (prediction vs. actual)
- Pattern extraction from successful workflows
- Mistake analysis and correction
- Confidence scoring

**`packages/rag/`** - Semantic search and retrieval
- Document ingestion and chunking
- Embedding generation (OpenAI)
- pgvector similarity search
- Hybrid search with knowledge graph

**`packages/policy/`** - Security and access control
- YAML-based policy definitions
- PDP (Policy Decision Point) evaluation
- Obligation enforcement (biometric, approval)
- Audit logging

### Tool Packages

**`packages/agent/`** - AI SDK tool definitions and registries
- Assistant tools (note, remind, timer, book, focus, web, handoff, home)
- Orchestrator tools (codex, docker, droid, git, proxmox, router, ticket, web)
- Tool registry wiring for AI SDK v6 and shared helpers (including Linear integration).

### Infrastructure Packages

**`packages/db/`** - Database layer
- Drizzle schemas for all domains
- Repositories (type-safe queries)
- Migrations
- Test harness

**`packages/auth/`** - Authentication and authorization
- Better Auth integration
- Passkey support
- Ed25519 token signing/verification
- JWKS endpoint

**`packages/metrics/`** - Observability
- Prometheus metrics registry
- Performance budgets
- Structured logging

**`packages/type/`** - Shared types
- DTOs for cross-layer communication
- No dependencies (pure contracts)

**`packages/ui/`** - Shared UI components
- Chat component
- Panes (notes, reminders, timers, bookmarks)
- Reusable primitives

### API Layer

**`packages/api/`** - HTTP/tRPC and streaming surface
- Router definitions for all domains (assistant, orchestrator, workflow, voice, graph, etc.)
- Context creation (session + runtime metadata)
- Policy enforcement middleware and autonomy band checks
- Minimal operational guards appropriate for single-user deployment
- Error handling, normalization, and metrics emission

## Data Flow

### Workflow Execution Flow

```
1. User Request
   └→ API Router (packages/api/src/routers/workflow.ts)
       └→ Create durable run in DB
       └→ WorkflowRuntime.execute()
           ├→ CoreRuntime.buildContext()
           │   ├→ Load preferences (packages/db)
           │   ├→ Query knowledge graph (packages/knowledge)
           │   ├→ Get cognitive state (packages/cognitive)
           │   └→ Fetch learnings (packages/learning)
           │
           ├→ AI SDK streamText()
           │   ├→ System prompt with context
           │   ├→ Tool registry (packages/agent)
           │   └→ Stream events
           │
           ├→ For each event:
           │   ├→ Normalize to WorkflowEvent
           │   ├→ Update knowledge graph
           │   ├→ Transition cognitive state
           │   ├→ Persist to DB
           │   └→ Emit to client
           │
           └→ On completion:
               └→ CoreRuntime.recordOutcome()
                   ├→ Record to learning system
                   └→ Update knowledge patterns

2. Client receives stream of WorkflowEvents
   └→ UI renders in real-time
```

### Context Building Flow

```
UserRequest
    ↓
buildContext()
    ├→ User Preferences
    │   └→ db.query(preferences)
    │       └→ { verbosity, autonomy, tool_preferences }
    │
    ├→ Memories (Knowledge Graph)
    │   └→ knowledge.query({ related_to: requirement })
    │       └→ { facts, relations, past_outcomes }
    │
    ├→ Cognitive State
    │   └→ cognitive.getCurrentState()
    │       └→ { state, attention, load, prediction }
    │
    └→ Learnings
        └→ learning.getPatterns({ domain, minConfidence: 0.8 })
            └→ { tool_sequences, common_mistakes, preferences }
    ↓
ExecutionContext
    └→ Used in system prompt + tool selection + post-processing
```

## Critical Integration Points

### 1. Runtime ↔ Domain Packages

The runtime layer is responsible for:
- **Querying** cognitive, knowledge, learning before execution
- **Updating** them during and after execution
- **Composing** their outputs into coherent context

### Runtime Events and Provenance

During workflow execution, the runtime emits a small, well-defined set of `WorkflowEvent` shapes that downstream layers use for persistence, replay, and visualization:

- **`reasoning` events** – carry explicit model thoughts (`text` / `reasoning`) that the API layer converts into reasoning traces. These traces are persisted via `persistReasoning` and later reconstructed into reasoning chains for `workflow.reasoning`.
- **`runtime-context` events** – emitted once per run after context building. The payload includes:
  - `ragDocumentIds` – the set of RAG document IDs that contributed chunks to the execution context.
  - `totalTokens` – approximate token count for code + RAG context.
  - `bundleFileCount` / `bundlePreview` – light metadata about which files were included in the context bundle.

The workflow router listens to these events when `USE_WORKFLOW_RUNTIME=true`:

- It accumulates `reasoning` events into an in-memory array of `{ text, timestamp }` traces for the run.
- It reads `ragDocumentIds` from the first `runtime-context` event.
- On stream completion, it calls a provenance helper that:
  - Invokes `persistReasoning(resource, traces, { executionId, auto, ragDocumentIds })`.
  - Invokes `linkRagProvenanceToReasoning({ runtimeResource: resource, executionId })` to create `explains` edges between RAG documents and reasoning nodes.

Mindscape and graph APIs consume the resulting graph:

- RAG documents appear as `rag_document` nodes under `resource="user"`.
- Runtime reasoning appears as `reasoning` nodes under per-workspace resources.
- Provenance edges appear as `kind="explains"` edges from `rag_document` → `reasoning`, rendered in Mindscape as green, dashed edges and traversable via `graph.runQuery` or the `graph.explainedBy` helper.

### 2. API ↔ Runtime

API routers are thin wrappers:
- Create durable run in DB
- Call runtime.execute()
- Stream events to client
- Handle errors and cleanup

### 3. Tools ↔ Runtime

Tools are registered with AI SDK:
- Runtime provides them to streamText()
- AI SDK decides when to call them
- Runtime normalizes results back to workflow events

### 4. Learning ↔ Knowledge

Learning system feeds the knowledge graph:
- Successful patterns become edges
- Mistakes are marked as anti-patterns
- Confidence scores inform queries

## Key Design Decisions

### Why Runtime Package?

**Problem**: Domain packages (cognitive, knowledge, learning) existed but didn't compose.

**Solution**: Create a dedicated runtime package that orchestrates them.

**Alternatives Considered**:
- Merge packages (rejected - violates single responsibility)
- Keep orchestration in API layer (rejected - wrong abstraction level)

**Benefits**:
- Clean composition without tight coupling
- Testable in isolation
- Clear place for integration logic

### Why Single-User Focus?

**Simplifications**:
- No multi-tenancy complexity
- No rate limiting (user is the only user)
- Aggressive personalization (all data belongs to one person)
- Direct infrastructure access (Jack's Proxmox cluster)

**Enables**:
- Deep learning of user's specific context
- Tight integration with personal infrastructure
- No compromise on privacy (data stays local)

### Why Hypergraph for Memory?

**Alternatives**: Vector DB only, relational DB, graph DB

**Chosen**: Hypergraph (nodes + edges + patterns) with pgvector

**Rationale**:
- Relations matter as much as facts
- Patterns are first-class citizens
- Hybrid search (semantic + structural)
- Native to Postgres (no additional infrastructure)

## Performance Budgets

- Cognitive state transitions: <100µs
- Knowledge graph queries: <1ms
- RAG retrieval: <10ms
- Context building: <100ms
- Workflow step execution: <5 minutes
- Total workflow timeout: 30 minutes (with per-step safeguards enforced in runtime and tools)

## Security Model

### Layers of Protection

1. **Authentication**: Better Auth with passkey
2. **Token Scoping**: Ed25519 tokens with explicit scopes
3. **Policy Enforcement**: PDP middleware on sensitive operations
4. **Biometric Elevation**: High-risk operations require fresh bio-ticket
5. **Audit Logging**: All policy decisions recorded

### Autonomy Levels

- `read` (0.0-0.3): Read-only operations, no state changes
- `low` (0.3-0.5): Safe mutations (create note, set reminder)
- `medium` (0.5-0.7): Potentially impactful (deploy preview)
- `high` (0.7-0.9): Dangerous operations (deploy production, delete data)
- `full` (0.9-1.0): Unrestricted (rarely used)

Higher autonomy requires:
- Elevated token (`elevated: true`)
- MFA via passkey (`mfa: "passkey"`)
- Recent biometric (TTL ≤ 2 minutes)

## Observability

### Metrics (Prometheus)

- Request counts and durations (tRPC, HTTP)
- Workflow execution (runs, events, outcomes)
- Tool calls (counts, durations, success rates)
- Policy decisions (allow, deny, obligation)
- Learning events (patterns extracted, mistakes recorded)
- System health (DB connections, memory, CPU)

### Logging (Structured JSON)

- Errors requiring investigation
- Security events (auth failures, policy denies)
- Performance anomalies
- Debug information (development only)

### Tracing (OpenTelemetry)

- Request flows across packages
- AI SDK streaming performance
- Tool execution latency
- Context building breakdown

## Testing Strategy

### Unit Tests
- Individual package logic
- Pure functions (no side effects)
- Mock external dependencies

### Integration Tests
- API routers with real tRPC client
- Database operations with test DB
- Runtime composition with mocked AI SDK

### End-to-End Tests
- Full workflow execution
- Multi-tool scenarios
- Suspend/resume flows
- Biometric elevation

## Future Architecture Considerations

### When to Extract Packages

Extract when:
- Package exceeds 10 files or 5000 lines
- Clear external value (publishable library)
- Multiple unrelated responsibilities

Don't extract:
- For "clean architecture" alone
- Before proving value
- When it slows iteration

### When to Add Abstraction

Add when:
- Pattern repeats 3+ times
- Clear extension point needed
- Testability improves significantly

Don't add:
- For hypothetical future needs
- Before understanding the domain
- When it obscures intent

### When to Optimize

Optimize when:
- Measurements show budget violations
- User-perceivable latency
- Resource exhaustion risks

Don't optimize:
- Before measuring
- For micro-benchmarks
- At expense of clarity

## Related Documents

- [Package Organization](packages.md) - Detailed package structure
- [Decision Log](decisions.md) - Architecture decision records
- [Runtime Integration Plan](../execplans/runtime-integration.md) - Historical runtime design and implementation details
- [Vector Embedding Hardening](../execplans/vector-dimension-hardening.md) - Embedding schema and performance hardening
- [UI Mindscape Strategy](../strategy/symbiotic-mindscape.md) - Current UI architecture strategy
