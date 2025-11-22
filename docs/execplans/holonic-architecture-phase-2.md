# ExecPlan: Emergent Graph Classification (Systemic Purity)

**Status**: Proposed
**Goal**: Replace explicit classification (Regex/Vectors) with Graph Topology.

## Core Concept
Instead of labeling input text as "Coding" using a classifier, we rely on the **Knowledge Graph** structure.
1.  **Anchor Nodes**: The graph is seeded with immutable concepts: `Concept:Coding`, `Concept:Security`, `Concept:Politics`.
2.  **Proximity**: If a user mentions "React", and the graph contains `(React) --[is_a]--> (Library) --[related_to]--> (Concept:Coding)`, then the topic is "Coding".
3.  **Emergence**: Classification "emerges" from the relationships, not from a pre-trained model or rigid keyword list.

## Architecture

### 1. Removal of Sidecars
- **Delete**: `packages/knowledge/src/classifier.ts` (Vector Model).
- **Delete**: `packages/knowledge/src/taxonomy.ts` (Regex List).
- **Refactor**: `packages/knowledge/src/extractor.ts` becomes purely syntactic (Entities/Relations only), synchronous, and fast.

### 2. Graph Seeding (The "Memory")
We need a mechanism to bootstrap the graph with common knowledge so "React" isn't just a random string.
- **New Module**: `packages/knowledge/src/ontology.ts`
- **Function**: `seedOntology()` runs on startup (idempotent).
- **Data**: Minimal set of triples.
  - `("React", "is_a", "Frontend Library")`
  - `("Frontend Library", "related_to", "Concept:Coding")`
  - `("CVE", "is_a", "Vulnerability")`
  - `("Vulnerability", "related_to", "Concept:Security")`

### 3. Entity Resolution (The "Link")
When `extractor.ts` finds "React" in user text:
- It produces a `Fact` node: "User likes React".
- It produces an entity string: "React".
- **Integration Point**: `GraphStore` (or `LearningWorker`) must resolve "React" to the existing graph node ID.
- **Edge Creation**: Create edge `(Fact Node) --[mentions]--> (React Node)`.

### 4. Context Query (The "Intelligence")
Replce `adapter.ts` logic with a Graph Query.
- **Input**: Recent messages -> Extract Entities ("React").
- **Query**: `graph.findPath({ from: "React", to: ["Concept:Coding", "Concept:Security"], maxDepth: 3 })`.
- **Result**: Path found to `Concept:Coding`.
- **Action**: Activate "Coding Persona".

## Implementation Steps

1.  **Clean Up**: Remove `classifier` and `taxonomy`. Revert `extractor` to sync.
2.  **Ontology**: Create `ontology.ts` and seed script.
3.  **Resolution**: Update `packages/agent/assistant/src/graphstore.ts` to perform **Entity Linking** (fuzzy match label to existing nodes).
4.  **Traversal**: Implement `findNearestConcept` in `packages/db/repo/graph.ts` (optimized SQL query).
5.  **Adaptation**: Update `assistant.ts` router to use the graph query instead of `adapter.ts`.

## Benefits
- **Purity**: No "magic lists". Knowledge is data, not code.
- **Learning**: If the user teaches ALFRED "Bun is a runtime", and ALFRED knows "Runtimes are Coding", ALFRED *learns* that "Bun" implies "Coding" without a code update.
- **Performance**: Regex/Vectors run on *every* message. Graph query runs only when adaptation is needed (and is efficiently indexed).

## Risks
- **Cold Start**: System is dumb until the graph is seeded.
- **Entity Ambiguity**: "React" (verb) vs "React" (noun). The graph needs disambiguation context (future work).

## Verification
- **Test**: `scripts/test-emergent-behavior.ts`.
- **Scenario**:
    1.  Seed `(Python) -> (Coding)`.
    2.  Input: "I love Python".
    3.  Verify: "Coding Persona" activates.
