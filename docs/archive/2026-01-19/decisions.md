# Architecture Decision Records

Historical log of major architectural decisions and their rationale.

## Format

```
## [ADR-NNNN] Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Deciders**: Names

### Context
What situation led to this decision?

### Decision
What did we decide?

### Consequences
What are the implications (positive and negative)?

### Alternatives Considered
What other options were evaluated and why were they rejected?
```

---

## [ADR-0001] Create Dedicated Runtime Package

**Date**: 2025-01-15  
**Status**: Accepted  
**Deciders**: Jack

### Context

ALFRED has excellent separation of concerns with packages for cognitive state, knowledge graph, learning, policy, etc. However, these packages don't actually compose into workflows. The workflow runner (`packages/api/src/workflow/runner.ts`) emits placeholder events instead of using real AI SDK streaming with domain package integration.

The "integration gap" prevents ALFRED from being an actual integrated intelligence system. Every feature (RAG, Linear, UI, Voice) assumes workflows can query knowledge, use cognitive state, and learn from outcomes—but none of this works.

### Decision

Create `packages/runtime/` as a dedicated composition layer that orchestrates all domain packages. The runtime package will:

1. **CoreRuntime**: Compose cognitive, knowledge, learning, policy into cohesive context
2. **WorkflowRuntime**: Execute workflows with real AI SDK streaming
3. **ContextBuilder**: Gather multi-domain context before execution
4. **DomainRuntimes**: Specialized contexts (Proxmox, Development, Productivity)

API routers become thin wrappers that call `runtime.execute()` and stream events.

### Consequences

**Positive**:

- ✅ All packages actually work together
- ✅ Clear place for integration logic
- ✅ Testable composition in isolation
- ✅ Unlocks all blocked features (RAG, Linear, UI, Voice)
- ✅ Maintains clean package boundaries

**Negative**:

- ❌ Adds another package (11 → 12)
- ❌ Requires restructuring agent package
- ❌ 6-week implementation timeline
- ❌ All future work blocks on this

**Trade-offs Accepted**:

- Slower short-term velocity for correct long-term architecture
- More abstraction before full feature set proves value
- Commitment to specific composition pattern

### Alternatives Considered

**Alternative 1: Merge domain packages into single "core" package**

- ❌ Violates single responsibility principle
- ❌ Creates tight coupling
- ❌ Harder to test individual pieces
- ❌ Loses extensibility

**Alternative 2: Keep integration in API layer**

- ❌ Wrong abstraction level (HTTP concerns mixed with domain logic)
- ❌ Duplicates integration logic across routers
- ❌ Hard to test without HTTP layer

**Alternative 3: Add integration to each domain package**

- ❌ Circular dependencies (cognitive needs knowledge needs learning needs cognitive)
- ❌ Violates dependency inversion principle
- ❌ No single source of truth for composition

**Why Runtime Package Wins**:

- Proper abstraction layer (between domain and API)
- Single responsibility: compose packages
- Testable without HTTP or AI SDK
- Clear extension point for domain-specific runtimes

---

## [ADR-0002] Restructure Agent Package

**Date**: 2025-01-15  
**Status**: Accepted  
**Deciders**: Jack

### Context

Current structure has confusing naming:

- `packages/agent/orchestrator/tool/` contains **tools**, not **orchestration logic**
- Orchestration logic lives in `packages/api/src/workflow/runner.ts` (wrong place)
- "Orchestrator" means both "tool collection" and "workflow execution"

After creating runtime package, orchestration logic moves there. Agent package should only contain tool definitions.

### Decision

Restructure agent package:

**Before**:

```
packages/agent/
├── src/orchestrator/
│   ├── tool/           # Tools for orchestration
│   └── linear.ts       # Helper
└── assistant/src/tool/ # Tools for assistant
```

**After**:

```
packages/agent/
├── src/
│   ├── tools/
│   │   ├── assistant/    # Personal assistant tools
│   │   └── orchestrator/ # Orchestration tools
│   ├── helpers/
│   │   └── linear.ts     # Helpers
│   └── registry.ts       # Tool registration
```

### Consequences

**Positive**:

- ✅ Clear naming (tools are in `tools/`)
- ✅ No confusion about where orchestration logic lives
- ✅ Easier to find tools
- ✅ Better package documentation

**Negative**:

- ❌ Breaks all imports across codebase
- ❌ Requires updating ~50 import statements
- ❌ Risk of missing imports in manual migration

**Mitigation**:

- Use `sed` or global find/replace for mechanical changes
- Run full test suite to catch broken imports
- Do in Phase 5 (after runtime is stable)

### Alternatives Considered

**Alternative 1: Keep current structure**

- ❌ Perpetuates naming confusion
- ❌ Doesn't reflect actual purpose after runtime addition

**Alternative 2: Create separate packages for assistant and orchestrator tools**

- ❌ Over-fragmentation (2 packages that always change together)
- ❌ More complexity for little benefit

---

## [ADR-0003] Single-User Architecture

**Date**: 2024-12 (original design)  
**Status**: Accepted  
**Deciders**: Jack

### Context

Most AI assistant products target multi-tenant SaaS with thousands of users. This requires:

- Rate limiting per user
- Data isolation
- Multi-tenancy patterns
- Compromise on personalization depth

ALFRED is a **personal assistant for one user** (Jack). This fundamentally changes architectural priorities.

### Decision

Design for single-user from the ground up:

1. **No rate limiting** - User is the only user
2. **Aggressive personalization** - All data belongs to one person
3. **Direct infrastructure access** - No abstraction over Jack's Proxmox cluster
4. **Deep learning** - Can learn specific preferences without privacy concerns
5. **No multi-tenancy** - Simplifies everything

### Consequences

**Positive**:

- ✅ Simpler architecture (no tenant isolation)
- ✅ Better performance (no rate limit checks)
- ✅ Deeper personalization (learn everything about Jack's context)
- ✅ Privacy by design (data never leaves Jack's infrastructure)
- ✅ Faster iteration (no need to generalize early)

**Negative**:

- ❌ Not a SaaS product (can't sell to others)
- ❌ Hard to extract and open-source (too personalized)
- ❌ Some design patterns not applicable to multi-user systems

**Trade-offs Accepted**:

- Not building a product for the market
- Optimizing for Jack's specific needs
- Willing to hardcode Jack's infrastructure details

### Alternatives Considered

**Alternative: Build multi-tenant from the start**

- ❌ Premature generalization
- ❌ Slows down iteration
- ❌ Compromises on personalization depth
- ❌ Adds complexity that may never be needed

---

## [ADR-0004] Hypergraph for Memory

**Date**: 2024-12 (original design)  
**Status**: Accepted  
**Deciders**: Jack

### Context

Need a memory system that can store:

- Facts (Jack's Proxmox cluster has 3 nodes)
- Relations (Node 1 runs the Postgres database)
- Patterns (Deployments to preview environment usually succeed)
- Semantic similarity (for retrieval)

### Decision

Use hypergraph (nodes + edges + patterns) backed by PostgreSQL with pgvector:

1. **Nodes**: Atomic facts
2. **Edges**: Relations between facts (with types and metadata)
3. **Patterns**: Higher-order relations (extracted from successful workflows)
4. **Vectors**: Embeddings for semantic search (pgvector)

Query interface supports both:

- **Structural queries**: "Find all nodes connected to X via relation Y"
- **Semantic queries**: "Find facts similar to this query"
- **Hybrid queries**: Combine both for best results

### Consequences

**Positive**:

- ✅ Relations are first-class (not just vector similarity)
- ✅ Patterns can be queried explicitly
- ✅ Native to Postgres (no additional infrastructure)
- ✅ Flexible schema (can evolve with learning)

**Negative**:

- ❌ More complex than pure vector DB
- ❌ Requires careful index management
- ❌ Query optimization is harder

### Alternatives Considered

**Alternative 1: Pure vector database (Pinecone, Weaviate)**

- ❌ Loses structural information
- ❌ Everything becomes "find similar vectors"
- ❌ Hard to represent "X caused Y" or "A always follows B"

**Alternative 2: Graph database (Neo4j)**

- ❌ Additional infrastructure to maintain
- ❌ No native vector support
- ❌ Overkill for single-user use case

**Alternative 3: Relational DB only**

- ❌ Semantic search requires complex joins
- ❌ Hard to represent arbitrary relations
- ❌ Doesn't leverage modern LLM capabilities

---

## [ADR-0005] AI SDK v6 for Tool Execution

**Date**: 2024-12 (original design)  
**Status**: Accepted  
**Deciders**: Jack

### Context

Need to execute tools based on LLM reasoning. Options:

1. Custom tool execution loop
2. LangChain/LangGraph
3. Mastra
4. AI SDK v6

### Decision

Use Vercel AI SDK v6 for tool execution:

```typescript
const result = await streamText({
  model: openai("gpt-4o"),
  tools: buildTools(),
  messages,
  maxSteps: 10,
});

for await (const event of result.fullStream) {
  // Real streaming with tool calls
}
```

### Consequences

**Positive**:

- ✅ Production-ready, well-maintained
- ✅ Native TypeScript support
- ✅ Streaming by default
- ✅ Tool execution built-in
- ✅ Provider-agnostic (easy to switch models)

**Negative**:

- ❌ Opinionated patterns (can't customize deeply)
- ❌ Framework coupling (hard to extract)

### Alternatives Considered

**Alternative 1: Custom loop**

- ❌ Reinventing the wheel
- ❌ Weeks of work for basic functionality
- ❌ Hard to maintain

**Alternative 2: LangChain**

- ❌ Python-first (Node.js support is second-class)
- ❌ Heavy abstraction layer
- ❌ Complex API

**Alternative 3: Mastra**

- ❌ Early-stage (less mature than AI SDK)
- ❌ More opinionated about workflow patterns
- ❌ Removed after evaluation (see ADR-0006)

---

## [ADR-0006] Remove Mastra Dependency

**Date**: 2025-01 (removed)  
**Status**: Superseded by ADR-0005  
**Deciders**: Jack

### Context

Initially used Mastra for workflow orchestration. After evaluation, found:

- Too opinionated about workflow structure
- AI SDK v6 provides same functionality with less abstraction
- Added complexity without clear benefit

### Decision

Remove Mastra entirely, use AI SDK v6 directly.

See: `.agent/plans/mastra-removal-plan.md` for migration details.

### Consequences

**Positive**:

- ✅ Simpler dependency tree
- ✅ More direct control over workflows
- ✅ Easier to reason about execution

**Negative**:

- ❌ Lost some workflow abstractions (need to rebuild)

---

## [ADR-0007] TanStack Start for Web Framework

**Date**: 2024-12 (original design)  
**Status**: Accepted  
**Deciders**: Jack

### Context

Need a modern React framework for the web interface. Requirements:

- File-based routing
- SSR support
- tRPC integration
- TypeScript-first

### Decision

Use TanStack Start (successor to TanStack Router).

### Consequences

**Positive**:

- ✅ Type-safe routing
- ✅ Excellent tRPC integration
- ✅ Loader/action patterns for data fetching
- ✅ SSR with streaming

**Negative**:

- ❌ Newer framework (less ecosystem)
- ❌ Some rough edges (beta software)

### Alternatives Considered

**Alternative: Next.js**

- ❌ App Router complexity
- ❌ Vercel lock-in
- ❌ Less type-safe routing

---

## Template for Future Decisions

## [ADR-NNNN] Title

**Date**: YYYY-MM-DD  
**Status**: Proposed | Accepted  
**Deciders**: Names

### Context

[Describe the forces at play: technical, political, social, project-level. What is making this decision necessary?]

### Decision

[What is the decision? Use active voice: "We will..."]

### Consequences

**Positive**:

- ✅ Benefit 1
- ✅ Benefit 2

**Negative**:

- ❌ Cost 1
- ❌ Cost 2

**Trade-offs Accepted**:

- Thing we're giving up for this benefit

### Alternatives Considered

**Alternative 1: [Name]**

- ❌ Why rejected
- ❌ Why rejected

**Alternative 2: [Name]**

- ❌ Why rejected

---

## Decision Principles

When making architectural decisions:

1. **Start with the problem**: Clearly articulate what's forcing the decision
2. **Document alternatives**: Show what was considered and why it was rejected
3. **Accept trade-offs explicitly**: Every decision has costs
4. **Leave a paper trail**: Future maintainers need context
5. **Use active voice**: "We decided X" not "X was decided"
6. **Update when superseded**: Mark old decisions as deprecated with references

## Related Documents

- [Architecture Overview](overview.md)
- [Package Organization](packages.md)
- [PRD](../alfred-prd.md)
