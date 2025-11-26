# Phase 5: Knowledge Extraction, Policy Enforcement, and Graph Visualization

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

This phase addresses three critical areas to deepen ALFRED's intelligence and security:

1.  **Real Knowledge Ingress**: We will replace the placeholder extraction logic in `packages/knowledge` with robust NLP (using `compromise`) to enable actual fact/relation extraction from text. This turns "dumb" text into a queryable Hypergraph.
2.  **Policy Enforcement (Obligations)**: We will implement the security mechanism where high-stakes actions (like `deploy.promote`) pause to request "obligations" (like biometric auth) from the user, rather than just failing. This enables the "Cautious Execute" autonomy band.
3.  **Mindscape Visualization**: We will extend the Mindscape canvas to visualize the Knowledge Graph. Users will be able to see concepts (facts/entities) and their relations as nodes and edges, making the "brain" of the assistant visible and navigable.

## Progress

- [x] **Part 1: Knowledge Extraction**
    - [x] Install `compromise` in `@alfred/knowledge`.
    - [x] Implement `extractEntities` using `compromise` (People, Places, Organizations).
    - [x] Implement `extractRelations` using sentence structure analysis.
    - [x] Implement `detectContradiction` using antonym dictionaries and negation analysis.
    - [x] Implement `extractTemporal` using `chrono-node` (if permissible) or robust regex expansion.
- [ ] **Part 2: Policy Enforcement**
    - [x] Define `Obligation` type in `@alfred/type` (if missing) or `@alfred/auth`.
    - [x] Update `requirePolicy` middleware to detect missing obligations.
    - [x] Create `TRPCError` subclass or metadata pattern for `OBLIGATION_REQUIRED`.
    - [ ] Implement the "pause/resume" pattern in `packages/api/src/routers/deploy.ts` as the reference implementation.
- [ ] **Part 3: Mindscape Visualization**
    - [ ] Create `ConceptNode` component in `apps/web`.
    - [ ] Create `RelationEdge` component (if standard edges aren't enough).
    - [ ] Implement `trpc.knowledge.visualize` (or similar) to fetch graph neighborhood.
    - [ ] Add "Visualize Knowledge" action to Mindscape (e.g., via Command Palette or context menu on text notes).

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

*(Populate during execution)*

## Outcomes & Retrospective

*(Populate during execution)*

## Context and Orientation

-   **Knowledge**: `packages/knowledge/src/extractor.ts` contains the logic to be upgraded. It currently uses simple regexes.
-   **Policy**: `packages/api/src/routers/deploy.ts` contains TODOs for obligations. `requirePolicy` is in `packages/api/src/gate.ts` (implied).
-   **Mindscape**: `apps/web/src/components/mindscape` contains the canvas and nodes. We need to add a new node type for knowledge concepts.

## Plan of Work

### 1. Knowledge Extraction (`packages/knowledge`)
We will introduce `compromise` as a lightweight NLP dependency to handle NER and basic sentence parsing.
-   **Edit**: `packages/knowledge/package.json` to add dependencies.
-   **Edit**: `packages/knowledge/src/extractor.ts` to import and use `compromise`.
-   **Goal**: `extract("Elon Musk founded SpaceX in 2002")` should return:
    -   Entities: "Elon Musk" (Person), "SpaceX" (Org), "2002" (Date).
    -   Relation: (Elon Musk) -> [founded] -> (SpaceX).

### 2. Policy Enforcement (`packages/api`)
We need a standard way to tell the client "I need you to do X before I proceed".
-   **Edit**: `packages/api/src/gate.ts` (or wherever `requirePolicy` is defined).
-   **Edit**: `packages/api/src/routers/deploy.ts` to implement the check.
-   **Mechanism**: Throw a `TRPCError` with code `PRECONDITION_FAILED` (or `FORBIDDEN`) and a custom `cause` or `message` payload containing the obligation details (`{ type: "biometric", reason: "deployment_promotion" }`).
-   **Client**: The UI (Mindscape) handles this error by showing the Biometric Dialog, then retrying the request with the proof.

### 3. Mindscape Visualization (`apps/web`)
We will treat Knowledge as a first-class citizen in the Mindscape.
-   **Create**: `apps/web/src/components/mindscape/nodes/concept-node.tsx`.
-   **Update**: `apps/web/src/store/mindscape.ts` to support `concept` nodes.
-   **Update**: `apps/web/src/components/mindscape/canvas.tsx` to register the node type.
-   **Logic**: When a user "inspects" a Note or inputs text, we can trigger extraction, persist it to the Graph, and then spawn `ConceptNodes` linked to the source.

## Concrete Steps

### Step 1: Knowledge Setup
```bash
cd packages/knowledge
bun add compromise
# If we want temporal parsing
bun add chrono-node
```

### Step 2: Policy Reference Implementation
In `packages/api/src/routers/deploy.ts`:
```typescript
// Inside promote mutation
if (needsApproval) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "obligation_required",
    cause: { type: "biometric", ... }
  });
}
```

### Step 3: Mindscape Concept Node
Create a node that displays:
-   Label (Concept Name)
-   Type (Entity Type: Person, Org, etc.)
-   Confidence score (visualized as opacity or ring)
```typescript
// concept-node.tsx
export function ConceptNode({ data }: NodeProps<ConceptNodeData>) {
  return (
    <div className="concept-node ...">
      <span className="text-xs uppercase text-muted">{data.entityType}</span>
      <div className="font-bold">{data.label}</div>
    </div>
  )
}
```
