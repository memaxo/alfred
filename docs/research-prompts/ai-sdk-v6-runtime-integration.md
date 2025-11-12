# Research Prompt: AI SDK v6 Beta Integration for Learning AI Runtime

**Research Target**: Vercel AI SDK v6 Beta  
**Database Stack**: PostgreSQL 16 + pgvector  
**Language**: TypeScript (Bun runtime)  
**Framework Context**: TanStack Start, tRPC, Drizzle ORM

---

## Research Objective

Investigate how to optimally integrate **AI SDK v6 Beta** into a sophisticated AI runtime that composes multiple cognitive subsystems (memory, learning, state management) into a cohesive, self-improving intelligence system. Focus on Vercel-quality patterns, native AI SDK v6 functionality, and production-ready code that leverages the framework's full capabilities rather than working around it.

---

## System Architecture Context

### ALFRED Runtime Architecture

We are building a **personal AI assistant runtime** with these integrated components:

```
┌─────────────────────────────────────────────────────────────┐
│  Runtime Integration Layer (BUILDING THIS)                  │
│                                                              │
│  CoreRuntime:                                               │
│  - Composes cognitive, knowledge, learning, policy          │
│  - Builds execution context from all subsystems             │
│  - Records outcomes for continuous improvement              │
│                                                              │
│  WorkflowRuntime:                                           │
│  - AI SDK v6 streamText() integration                       │
│  - Real-time tool execution with 16 tools                   │
│  - Event normalization and enrichment                       │
│  - Multi-step reasoning with context updates                │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         │              │              │              │
┌────────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
│  Cognitive   │ │ Knowledge  │ │  Learning │ │  Policy   │
│    Core      │ │   Graph    │ │  System   │ │  Engine   │
└──────────────┘ └────────────┘ └───────────┘ └───────────┘
```

### 1. Cognitive Core (State Machine)

**Purpose**: Track AI's reasoning state and attention

**Database Schema**:
```sql
CREATE TABLE cognitive_states (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL, -- 'idle' | 'thinking' | 'deciding' | 'acting' | 'learning' | 'reflecting'
  attention JSONB, -- Current focus areas
  cognitive_load DECIMAL(3,2), -- 0.0 to 1.0
  prediction JSONB, -- What AI predicts will happen
  context JSONB, -- Current working memory
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cognitive_user_current ON cognitive_states(user_id, created_at DESC);
```

**TypeScript Interface**:
```typescript
export type CognitiveState = {
  state: "idle" | "thinking" | "deciding" | "acting" | "learning" | "reflecting";
  attention: {
    primary: string; // Main focus
    secondary: string[]; // Background concerns
    overload: boolean; // Too much to track
  };
  load: number; // 0.0-1.0 cognitive capacity used
  prediction: {
    expectedOutcome: string;
    confidence: number;
    reasoning: string;
  };
  context: Record<string, unknown>; // Working memory
};

export function transition(
  state: CognitiveState, 
  event: CognitiveEvent
): CognitiveState;
```

**Integration Question**: How does AI SDK v6 Beta support injecting cognitive state into the system prompt or tool selection logic? Can we use middleware to update cognitive state after each reasoning step?

### 2. Knowledge Graph (Hypergraph Memory)

**Purpose**: Store facts, relations, patterns as a hypergraph

**Database Schema**:
```sql
-- Nodes: Atomic facts
CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'fact' | 'concept' | 'entity'
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges: Relations between nodes
CREATE TABLE knowledge_edges (
  id UUID PRIMARY KEY,
  from_node UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL, -- 'causes' | 'requires' | 'similar_to' | 'part_of'
  weight DECIMAL(5,4) DEFAULT 1.0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patterns: Higher-order relations extracted from successful workflows
CREATE TABLE knowledge_patterns (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  trigger TEXT NOT NULL, -- What starts this pattern
  actions JSONB NOT NULL, -- Array of actions [{tool, args}]
  outcome TEXT NOT NULL,
  confidence DECIMAL(3,2), -- 0.0 to 1.0
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (HNSW for fast approximate nearest neighbor)
CREATE INDEX ON knowledge_nodes USING hnsw (embedding vector_cosine_ops);

-- Structural queries
CREATE INDEX idx_edges_from ON knowledge_edges(from_node);
CREATE INDEX idx_edges_to ON knowledge_edges(to_node);
CREATE INDEX idx_patterns_user_confidence ON knowledge_patterns(user_id, confidence DESC);
```

**TypeScript Interface**:
```typescript
export type Node = {
  id: string;
  type: "fact" | "concept" | "entity";
  content: string;
  embedding: number[]; // 1536-dim vector
  metadata: Record<string, unknown>;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  type: "causes" | "requires" | "similar_to" | "part_of" | "tool_used";
  weight: number;
  metadata: Record<string, unknown>;
};

export type Pattern = {
  id: string;
  trigger: string; // "deploy to proxmox"
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
  outcome: "success" | "failure";
  confidence: number;
  usageCount: number;
};

export class KnowledgeGraph {
  // Semantic search via pgvector
  async query(params: {
    related_to: string;
    topK?: number;
    threshold?: number;
  }): Promise<Node[]>;
  
  // Structural traversal
  async traverse(params: {
    from: string;
    relation: string;
    depth?: number;
  }): Promise<Node[]>;
  
  // Hybrid: semantic + structural
  async hybridQuery(params: {
    semantic: string;
    structural: { relation: string; depth: number };
  }): Promise<Node[]>;
  
  // Pattern retrieval
  async getPatterns(params: {
    trigger: string;
    minConfidence: number;
  }): Promise<Pattern[]>;
}
```

**Integration Question**: How can AI SDK v6 Beta consume retrieved context (nodes, edges, patterns) to inform tool selection? Should this be in the system prompt, or does v6 have a better native mechanism for "RAG before reasoning"?

### 3. Learning System (Outcome Recording & Pattern Extraction)

**Purpose**: Record every workflow outcome and extract patterns for future improvement

**Database Schema**:
```sql
-- Learning outcomes: prediction vs actual for every workflow
CREATE TABLE learning_outcomes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  run_id UUID NOT NULL,
  domain TEXT NOT NULL, -- 'proxmox' | 'development' | 'productivity'
  requirement TEXT NOT NULL, -- Original user request
  prediction JSONB NOT NULL, -- What AI thought would happen
  actual JSONB NOT NULL, -- What actually happened
  tools_used TEXT[] NOT NULL, -- Array of tool names
  successful BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted patterns (derived from successful outcomes)
CREATE TABLE learning_patterns (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL, -- Regex or semantic pattern
  tool_sequence TEXT[] NOT NULL, -- ['git.pull', 'docker.build', 'router.update']
  confidence DECIMAL(3,2) NOT NULL,
  sample_count INTEGER DEFAULT 1, -- How many outcomes this represents
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Mistakes (for avoiding past errors)
CREATE TABLE learning_mistakes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  why_it_failed TEXT NOT NULL,
  how_to_avoid TEXT NOT NULL,
  occurrences INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_user_domain ON learning_outcomes(user_id, domain, created_at DESC);
CREATE INDEX idx_patterns_user_confidence ON learning_patterns(user_id, confidence DESC);
```

**TypeScript Interface**:
```typescript
export type LearningOutcome = {
  workflowId: string;
  runId: string;
  domain: "proxmox" | "development" | "productivity";
  requirement: string;
  prediction: {
    expectedOutcome: string;
    confidence: number;
    reasoning: string;
  };
  actual: {
    outcome: string;
    toolsCalled: string[];
    durationMs: number;
  };
  successful: boolean;
  errorMessage?: string;
};

export async function recordOutcome(outcome: LearningOutcome): Promise<void>;

export async function extractPatterns(params: {
  domain: string;
  userId: string;
  minSampleSize: number;
}): Promise<Pattern[]>;

export async function analyzeMistakes(params: {
  domain: string;
  userId: string;
  recentOnly?: boolean;
}): Promise<Mistake[]>;

export async function getRecommendations(params: {
  requirement: string;
  domain: string;
  userId: string;
}): Promise<{
  suggestedTools: string[];
  basedOnPatterns: Pattern[];
  avoidMistakes: Mistake[];
}>;
```

**Integration Question**: How does AI SDK v6 Beta support recording tool execution results for learning? Can we hook into `onStepFinish` to capture prediction vs actual? How do we feed learned patterns back into future executions?

### 4. Policy Engine (Security & Autonomy Levels)

**Purpose**: Enforce security boundaries and graduated autonomy

**YAML Policy Example**:
```yaml
policies:
  - id: proxmox_deploy_production
    action: "proxmox.deploy"
    resource:
      type: "deployment"
      attributes:
        environment: "production"
    conditions:
      - autonomy_level >= 0.8
      - mfa_verified = true
      - elevated_token = true
    decision: ALLOW
    obligations:
      - require_biometric
      - audit_log
```

**Integration Question**: How can we pause AI SDK v6 streaming mid-workflow when policy requires biometric confirmation? Does v6 support workflow suspension/resumption?

---

## Specific Research Questions

### A. Context Building & Injection

**Question A1**: What is the optimal way to inject rich context into AI SDK v6 Beta's `streamText()`?

**Current approach** (needs validation):
```typescript
const context = await buildContext(input);

const result = await streamText({
  model: openai("gpt-4o"),
  system: `You are Alfred.
    
    User preferences: ${JSON.stringify(context.preferences)}
    Relevant memories: ${context.memories.map(m => m.content).join("\n")}
    Past patterns: ${context.patterns.map(p => p.description).join("\n")}`,
  messages: convertToModelMessages(uiMessages),
  tools: buildTools(),
});
```

**Alternative approaches to research**:
- Does v6 Beta support structured context injection (not just string concatenation)?
- Can we use `experimental_context` or similar features?
- Should we use function calling to "query knowledge" as a tool, or inject upfront?
- What's the token limit implication of large context injection?

**Question A2**: How do we handle context that changes during execution?

Example: AI uses `git.status` tool and learns repo is dirty. This should update the knowledge graph in real-time and inform subsequent tool calls. Does v6 support this "context evolution" pattern?

### B. Tool Execution & Streaming

**Question B1**: What is the Vercel-recommended pattern for tool execution with side effects?

Our tools have side effects (deploy containers, modify git repos, update databases). Research:
- Best practices for error handling in tools
- How to make tools idempotent
- Retry logic for transient failures
- Progress reporting during long-running tools (Docker builds take minutes)

**Question B2**: How do we stream tool execution progress?

Example: Docker build has multiple steps. We want to stream:
```typescript
{
  type: "tool-progress",
  toolCallId: "abc123",
  step: "Building layer 3/8",
  progress: 0.375
}
```

Does AI SDK v6 Beta support custom event types in the stream? Or should we use `text-delta` for progress updates?

**Question B3**: How do we handle tool chaining and dependencies?

Some tools depend on others:
- `proxmox.deploy` requires `docker.build` to complete first
- `router.update` requires `deployment.id` from previous tool

Research:
- Does v6 handle dependencies automatically via `tool-result` analysis?
- Do we need to implement dependency resolution ourselves?
- Can we use `maxSteps` intelligently for complex workflows?

### C. Learning & Improvement Integration

**Question C1**: How do we capture tool execution outcomes for learning?

**Current approach** (needs validation):
```typescript
const result = await streamText({
  model: openai("gpt-4o"),
  tools: buildTools(),
  onStepFinish: async (step) => {
    // Record prediction (from cognitive state)
    // vs actual (from step.toolResults)
    await learning.record({
      prediction: cognitiveState.prediction,
      actual: step.toolResults,
      successful: !step.error,
    });
  },
});
```

Research:
- Is `onStepFinish` the right hook for learning?
- Can we access intermediate reasoning (chain-of-thought) for analysis?
- How do we correlate tool calls with their results reliably?

**Question C2**: How do we feed learned patterns back into AI decision-making?

After extracting patterns like "git pull → docker build → router update works 95% of the time," how do we influence AI SDK v6 to prefer this sequence?

Options to research:
- Include patterns in system prompt (current approach)
- Use tool selection biasing (if v6 supports it)
- Pre-generate a "plan" based on patterns, then ask AI to execute it
- Fine-tune model on user's successful patterns (long-term)

### D. Real-Time Knowledge Graph Updates

**Question D1**: How do we update the knowledge graph during workflow execution?

Example flow:
1. AI calls `proxmox.listContainers`
2. Result: `[{id: 100, name: "postgres"}]`
3. We want to immediately add to knowledge graph: `Node(postgres) --runs_on--> Node(proxmox-node-1)`
4. This informs subsequent tool calls in the same workflow

Research:
- Can we do this in `onStepFinish` without blocking the stream?
- Should knowledge updates be async (fire-and-forget) or sync (wait before next tool)?
- How do we handle knowledge update failures?

**Question D2**: Should knowledge retrieval be a tool itself?

Instead of pre-loading context, expose:
```typescript
const knowledgeTool = tool({
  name: "query_knowledge",
  description: "Search your memory for relevant information",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().default(5),
  }),
  execute: async ({ query, limit }) => {
    return await knowledge.query({ related_to: query, topK: limit });
  },
});
```

Research pros/cons:
- Pro: AI decides when it needs context (more efficient)
- Pro: Follows AI SDK v6 native tool pattern
- Con: Adds latency (extra LLM call to decide to use tool)
- Con: May not always query when needed

### E. Workflow Suspension & Resumption

**Question E1**: How do we pause AI SDK v6 streaming for user confirmation?

Scenario: AI wants to run `proxmox.deleteContainer`. Policy requires biometric confirmation. We need to:
1. Pause the workflow
2. Request biometric from user
3. Resume if approved, cancel if denied

Research:
- Does v6 Beta support workflow suspension?
- Can we use AbortSignal + resumption tokens?
- How do we persist workflow state during suspension?

**Question E2**: What's the Vercel pattern for long-running workflows?

Our workflows can take 10-30 minutes (building containers, deploying, running tests). Research:
- Timeout handling
- Progress checkpointing
- Partial failure recovery
- Client reconnection after disconnect

### F. Event Normalization & Enrichment

**Question F1**: How do we normalize AI SDK v6 events to our WorkflowEvent schema?

AI SDK v6 emits many event types:
- `text-delta`
- `tool-call`
- `tool-result`
- `step-finish`
- `finish`
- `error`

We need to normalize to our domain events:
```typescript
type WorkflowEvent = 
  | { type: "run"; runId: string; input: WorkflowInput }
  | { type: "thinking"; text: string; cognitiveState: CognitiveState }
  | { type: "tool-call"; id: string; toolName: string; args: unknown }
  | { type: "tool-result"; id: string; result: unknown; updatedContext: unknown }
  | { type: "complete"; outcome: string; learnings: Pattern[] }
  | { type: "error"; message: string; recovery: string };
```

Research:
- Best practices for event transformation
- Should we enrich events with context (cognitive state, knowledge updates)?
- How do we maintain event IDs for correlation?

**Question F2**: Can we add custom metadata to AI SDK v6 events?

We want to attach:
- Cognitive state at time of tool call
- Knowledge nodes used for decision
- Confidence score from learning system

Research if v6 supports `metadata` field or if we need wrapper types.

### G. Performance & Optimization

**Question G1**: How do we optimize context loading for low latency?

Our context building queries multiple systems:
- Preferences (Postgres)
- Knowledge graph (Postgres + vector similarity)
- Cognitive state (Postgres)
- Learning patterns (Postgres)

Target: <100ms total context build time

Research:
- Can we parallelize queries?
- Should we cache context between tool calls in same workflow?
- How do we invalidate cache when context changes?

**Question G2**: What are the token limits and how do we manage them?

With rich context (preferences + memories + patterns + cognitive state), we could exceed context window. Research:
- Token counting in v6 Beta
- Truncation strategies
- Prioritizing recent/relevant context over exhaustive

**Question G3**: How do we minimize latency for interactive conversations?

For assistant mode (vs. workflow mode), we need sub-second responses. Research:
- Streaming best practices
- Minimal context loading for simple queries
- Caching strategies

### H. Testing & Observability

**Question H1**: How do we test AI SDK v6 workflows deterministically?

Research:
- Mocking strategies for `streamText()`
- Fixture-based testing (pre-recorded responses)
- Testing tool execution without live API calls
- Vercel's recommended testing patterns

**Question H2**: What observability does v6 Beta provide?

We need to monitor:
- Token usage per request
- Tool selection decisions (why this tool?)
- Latency breakdown (model time vs tool time)
- Error rates by tool

Research:
- Built-in telemetry in v6
- Integration with OpenTelemetry
- Custom metrics hooks

### I. Migration & Compatibility

**Question I1**: What's changed from AI SDK v4/v5 that affects our architecture?

**Question I2**: How stable is v6 Beta for production use?

We're building for personal use (single user) but still want reliability. Research:
- Known issues in v6 Beta
- Upgrade path from Beta to stable
- Community experience reports

---

## Desired Research Output

### 1. Reference Architecture Document

Provide a **complete reference architecture** showing:
- Optimal package structure for runtime integration
- TypeScript interfaces that leverage v6 native types
- Database schema integration patterns
- Error handling strategies
- Testing approach

### 2. Code Examples (Vercel Quality)

Provide **production-ready code samples** for:

**Example 1**: Context Building & Injection
```typescript
// Show the Vercel-recommended way to build and inject context
export async function buildExecutionContext(...) { ... }
export function createSystemPrompt(context: ExecutionContext): string { ... }
```

**Example 2**: Real-Time Knowledge Graph Updates
```typescript
// Show how to update knowledge during workflow execution
export async function executeWithKnowledgeTracking(...) { ... }
```

**Example 3**: Learning from Outcomes
```typescript
// Show how to record and learn from tool execution
export async function recordOutcome(...) { ... }
export async function extractPatterns(...) { ... }
```

**Example 4**: Workflow Suspension/Resumption
```typescript
// Show how to pause for biometric confirmation
export async function suspendForBiometric(...) { ... }
export async function resumeWorkflow(...) { ... }
```

### 3. Best Practices Document

Provide **Vercel-quality best practices** for:
- System prompt engineering with dynamic context
- Tool definition patterns (naming, schemas, error handling)
- Event streaming and normalization
- Performance optimization
- Testing strategies
- Production deployment checklist

### 4. PostgreSQL + pgvector Integration Patterns

Provide **specific guidance** for:
- Optimal indexes for knowledge graph queries
- Vector similarity search performance
- Transaction management for knowledge updates
- Connection pooling for high-throughput workflows

### 5. Comparison with Alternatives

Compare AI SDK v6 Beta approach vs:
- LangChain (why v6 is better for our use case)
- Custom implementation (what v6 saves us from building)
- Other orchestration frameworks

---

## Success Criteria

Research is successful if it provides:

1. ✅ **Confidence in architecture**: We know v6 Beta can support our cognitive runtime
2. ✅ **Concrete code patterns**: We can copy-paste examples and adapt them
3. ✅ **Performance validation**: We understand latency implications and optimization paths
4. ✅ **Testing strategy**: We know how to test this complex integration
5. ✅ **Production readiness**: We understand v6 Beta stability and gotchas

## Timeline Context

We're starting a **6-week implementation** of the runtime integration layer. This research should inform:
- **Week 1-2**: CoreRuntime implementation
- **Week 3-4**: WorkflowRuntime with real AI SDK v6 streaming
- **Week 5**: Learning loop closure
- **Week 6**: Domain-specific runtimes

The research output will directly influence our implementation decisions.

---

## Additional Context

**Single-user system**: ALFRED is for one user (Jack), so we can:
- Store all user data without isolation concerns
- Learn aggressively without privacy constraints
- Optimize for Jack's specific infrastructure and preferences

**Self-hosted**: Runs on Jack's infrastructure (Proxmox cluster), so we:
- Have full control over deployment
- Can use local models if needed (Faster-Whisper, Piper TTS)
- Don't have multi-tenancy concerns

**Production use case**: This isn't a toy—Jack uses ALFRED daily for:
- Managing Proxmox infrastructure (deploy containers, configure networking)
- Software development (git workflows, Docker builds, code execution)
- Productivity (notes, reminders, timers, focus modes)
- Project management (Linear integration)

The code quality bar is **production-ready, maintainable, observable, testable**.

---

## References to Include in Research

- [AI SDK v6 Beta Documentation](https://sdk.vercel.ai/docs)
- [Vercel AI GitHub Discussions](https://github.com/vercel/ai/discussions)
- [Vercel AI Examples Repository](https://github.com/vercel/ai/tree/main/examples)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Best Practices](https://platform.openai.com/docs/guides/embeddings)

Please prioritize official Vercel AI SDK v6 Beta documentation and examples over third-party resources. We want to follow Vercel's recommended patterns, not fight against the framework.

