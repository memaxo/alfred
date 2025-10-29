# Cognitive Architecture

## First Principles

The entire system is a pure function from events to cognitive state. No frameworks, no indirection, just domain types and transformations.

```typescript
System = (Event[]) → CognitiveState
```

## Core Architecture

### 1. Cognitive State Machine

The system exists in exactly one state at any time:

```typescript
type CognitiveState = 
  | { _: "idle" }
  | { _: "capturing"; input: string; confidence: number }
  | { _: "thinking"; about: string; depth: number; paths: Path[] }
  | { _: "deciding"; options: Decision[]; criteria: Criteria; weights: number[] }
  | { _: "executing"; plan: Plan; step: number; auto: Autonomy }
  | { _: "reflecting"; outcome: Outcome; prediction: string; error: number }
```

State transitions are pure functions with no side effects:

```typescript
transition: (state: CognitiveState, event: Event) → CognitiveState
```

### 2. Event Stream

All system inputs are events:

```typescript
type Event = 
  | { _: "input"; content: string; source: Source; ts: number }
  | { _: "timeout"; deadline: number }
  | { _: "feedback"; expected: string; actual: string }
  | { _: "interrupt"; reason: string; priority: number }
```

### 3. Knowledge Hypergraph

Knowledge is a content-addressed hypergraph:

```typescript
type Knowledge = 
  | { _: "fact"; content: string; confidence: number; source: string }
  | { _: "relation"; from: NodeId; to: NodeId; kind: RelationType; weight: number }
  | { _: "insight"; derived: NodeId[]; conclusion: string; confidence: number }
  | { _: "pattern"; examples: NodeId[]; rule: string; accuracy: number }
```

#### Indexing Strategy

Four specialized indices for O(1) to O(log n) operations:

1. **HAMT (Hash Array Mapped Trie)**: Content addressing and deduplication
2. **IntervalTree**: Temporal queries and time-based relationships  
3. **RTree**: Spatial/semantic similarity queries
4. **BTree**: Ordered traversal and range queries

### 4. Cognitive Flows

Four fundamental flows, each a pure function:

#### Capture Flow
```typescript
capture: (input: string, context: Context) → { 
  facts: Fact[], 
  confidence: number,
  ambiguities: string[]
}
```

#### Synthesis Flow  
```typescript
synthesize: (facts: Fact[], knowledge: Graph) → {
  insights: Insight[],
  connections: Relation[],
  contradictions: Conflict[]
}
```

#### Execution Flow
```typescript
execute: (plan: Plan, state: WorldState) → {
  actions: Action[],
  effects: Effect[],
  deviations: Deviation[]
}
```

#### Reflection Flow
```typescript
reflect: (expected: Outcome, actual: Outcome) → {
  errors: Error[],
  lessons: Lesson[],
  updates: KnowledgeUpdate[]
}
```

## Autonomy Model

Autonomy is continuous, not discrete:

```typescript
type Autonomy = {
  level: number  // 0.0 to 1.0
  confidence: number  // Bayesian probability
  evidence: Evidence[]
  constraints: Constraint[]
}

// Bayesian update on each decision
updateAutonomy: (prior: Autonomy, outcome: Outcome) → Autonomy
```

### Autonomy Gradient

- **0.0-0.3**: Read-only observation
- **0.3-0.5**: Suggest actions, await confirmation  
- **0.5-0.7**: Execute with rollback capability
- **0.7-0.9**: Execute with post-hoc review
- **0.9-1.0**: Full autonomy with learning

## Memory Architecture

### Working Memory (Hot)
```typescript
type WorkingMemory = {
  focus: Focus  // Current attention
  stack: Frame[]  // Execution stack
  buffer: Fact[]  // Recent facts, capped at 7±2
}
```

### Long-term Memory (Cold)
```typescript
type LongTermMemory = {
  graph: KnowledgeGraph
  index: Index<NodeId, Node>
  embeddings: Map<NodeId, Vector>
}
```

### Memory Pressure
```typescript
// When buffer exceeds capacity, consolidate
consolidate: (buffer: Fact[], graph: Graph) → {
  compressed: Knowledge[],
  evicted: NodeId[]
}
```

## Performance Constraints

Every operation has a budget:

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| State transition | < 100μs | 95th percentile |
| Knowledge query | < 1ms | 99th percentile |
| Fact extraction | < 10ms | 95th percentile |
| Plan generation | < 100ms | 95th percentile |
| Memory consolidation | < 50ms | Amortized |

## Implementation Patterns

### Pure Functional Core
```typescript
// No classes, no this, no mutation
const think = (state: Thinking, event: Event): CognitiveState => {
  const thoughts = generateThoughts(state.about, state.depth)
  const evaluated = thoughts.map(t => ({ 
    thought: t, 
    score: evaluate(t, state.context) 
  }))
  const best = evaluated.sort((a, b) => b.score - a.score)[0]
  
  return best.score > threshold
    ? { _: "deciding", options: expandOptions(best.thought), criteria: defaultCriteria, weights: [] }
    : { _: "idle" }
}
```

### Effect Handling
```typescript
// Effects at the boundaries only
type Effect = 
  | { _: "store"; key: string; value: unknown }
  | { _: "fetch"; url: string }
  | { _: "emit"; event: string; data: unknown }

// Pure function returns effects
const step = (state: CognitiveState, event: Event): [CognitiveState, Effect[]] => {
  const newState = transition(state, event)
  const effects = deriveEffects(state, newState)
  return [newState, effects]
}

// Interpreter executes effects
const interpret = async (effects: Effect[]): Promise<void> => {
  for (const effect of effects) {
    await execute(effect)
  }
}
```

### Composition Without Coupling
```typescript
// Functions compose naturally
const pipeline = (input: string): Outcome =>
  reflect(
    execute(
      plan(
        synthesize(
          capture(input)
        )
      )
    )
  )
```

## Testing Strategy

### Property-Based Testing
```typescript
property("State machine always progresses", 
  forAll(genState(), genEvent(), (state, event) => {
    const next = transition(state, event)
    return next !== state || state._ === "idle"
  })
)
```

### Performance Testing
```typescript
benchmark("State transition", () => {
  const state = { _: "thinking", about: "test", depth: 3 }
  const event = { _: "timeout", deadline: Date.now() }
  return transition(state, event)
}, { budget: 100 }) // microseconds
```

## Evolution Mechanism

The system improves through prediction error:

```typescript
type Learning = {
  prediction: Outcome
  actual: Outcome  
  error: number
  gradient: Knowledge[]
}

learn: (history: Learning[]) → KnowledgeUpdate[]
```

Every decision generates a prediction. Every outcome generates error. Every error generates learning.

## Philosophical Underpinnings

1. **Simplicity**: Complexity emerges from simple rules, not complex code
2. **Purity**: Side effects only at system boundaries  
3. **Measurement**: What isn't measured doesn't improve
4. **Composition**: Small functions that compose > large frameworks
5. **Learning**: Every interaction teaches something

*The architecture is the implementation. The implementation is the architecture.*
