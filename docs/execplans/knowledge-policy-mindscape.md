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
  - [x] Implement the "pause/resume" pattern in `packages/api/src/routers/deploy.ts` **and** `packages/api/src/routers/workflow.ts`, plus propagate structured obligation events through the SSE transport and Mindscape UI.
  - [x] Share a `createWorkflowSuspension` helper (metrics + timeout) across TRPC + SSE routes and emit `resumeEvents` metadata so clients know which `workflow.resume` event to deliver.
  - [x] Add workflow suspension cleanup worker + Mindscape obligation dialog that surfaces reason/metadata and new `withObligationRetry` client helper for TRPC flows.
- [x] **Part 3: Mindscape Visualization**
  - [x] Create `ConceptNode` component in `apps/web`.
  - [x] Implement `trpc.knowledge.visualize` to extract entities and return visualization data.
  - [x] Add "Visualize Knowledge" action to Mindscape Command Palette.
  - [x] Spawn `concept` nodes from graph traversal when entity facts are encountered.
  - [x] Extract shared constants (`SPAWN_RADIUS`) to `config/mindscape.ts`.
  - [x] Extract `parseEntityFactLabel` utility to `@alfred/knowledge/entity`.
  - [x] Optimize entity fact queries with SQL-level JSON filtering.
  - [x] Add comprehensive test coverage including edge cases.

## Surprises & Discoveries

- **Memory backend quirk**: `MemoryRunRegistry.unregister` is synchronous, so chaining `.catch()` explodes in Bun. We now wrap unregister calls in try/catch everywhere we reuse the pattern.
- **SSE parity**: The TanStack SSE route needed the same obligation-handling semantics as the TRPC router; otherwise Mindscape could never resume a cautious execution. Implementing the shared helper exposed test gaps that are now covered.
- **TanStack start + route test collision**: Running Playwright against the dev server trips the route generator on files under `apps/web/src/routes/api/__tests__`. Until we move those tests elsewhere or add an ignore glob, e2e runs must mock the workflow stream via the global harness instead of hitting those files directly.

## Decision Log

- 2025-11-26 — `requirePolicy` now accepts `handleObligations: "passThrough"`, allowing routers (deploy, cognitive, workflow, SSE route) to control whether obligations short-circuit or emit structured payloads.
- 2025-11-26 — Mindscape listens for `workflow-event` `type: "obligation"` and surfaces the biometric dialog, reusing the shared `useObligationResume` hook.
- 2025-11-27 — Suspensions are centralized via `createWorkflowSuspension` so every transport emits `{ obligations, resumeEvents }`, records metrics, and auto-cancels stale runs after the timeout worker fires.
- 2025-11-27 — Clients now use `withObligationRetry` + the enriched dialog (reason + metadata) so PRECONDITION failures automatically trigger elevation before retrying critical TRPC mutations.

## Outcomes & Retrospective

- Implemented `trpc.knowledge.visualize` to extract entities via `@alfred/knowledge`, persist them, and return a bounded concept subgraph (`packages/api/src/routers/knowledge.ts`).
- Wired Mindscape Command Palette action “Visualize Knowledge” to call the procedure and spawn concept nodes + edges (`apps/web/src/config/actions.ts`, `apps/web/src/components/mindscape/command-palette.tsx`).
- Updated Mindscape traversal to auto-render entity facts as `concept` nodes when expanding the graph (`apps/web/src/hooks/use-mindscape-traversal.ts`).

## Context and Orientation

- **Knowledge**: `packages/knowledge/src/extractor.ts` contains the logic to be upgraded. It currently uses simple regexes.
- **Policy**: `packages/api/src/routers/deploy.ts` contains TODOs for obligations. `requirePolicy` is in `packages/api/src/gate.ts` (implied).
- **Mindscape**: `apps/web/src/components/mindscape` contains the canvas and nodes. We need to add a new node type for knowledge concepts.

## Plan of Work

### 1. Knowledge Extraction (`packages/knowledge`)

We will introduce `compromise` as a lightweight NLP dependency to handle NER and basic sentence parsing.

- **Edit**: `packages/knowledge/package.json` to add dependencies.
- **Edit**: `packages/knowledge/src/extractor.ts` to import and use `compromise`.
- **Goal**: `extract("Elon Musk founded SpaceX in 2002")` should return:
  - Entities: "Elon Musk" (Person), "SpaceX" (Org), "2002" (Date).
  - Relation: (Elon Musk) -> [founded] -> (SpaceX).

### 2. Policy Enforcement (`packages/api`)

We need a standard way to tell the client "I need you to do X before I proceed".

- **Edit**: `packages/api/src/gate.ts` (or wherever `requirePolicy` is defined).
- **Edit**: `packages/api/src/routers/deploy.ts` to implement the check.
- **Mechanism**: Throw a `TRPCError` with code `PRECONDITION_FAILED` (or `FORBIDDEN`) and a custom `cause` or `message` payload containing the obligation details (`{ type: "biometric", reason: "deployment_promotion" }`).
- **Client**: The UI (Mindscape) handles this error by showing the Biometric Dialog, then retrying the request with the proof.

### 3. Mindscape Visualization (`apps/web`)

We will treat Knowledge as a first-class citizen in the Mindscape.

- **Create**: `apps/web/src/components/mindscape/nodes/concept-node.tsx`.
- **Update**: `apps/web/src/store/mindscape.ts` to support `concept` nodes.
- **Update**: `apps/web/src/components/mindscape/canvas.tsx` to register the node type.
- **Logic**: When a user "inspects" a Note or inputs text, we can trigger extraction, persist it to the Graph, and then spawn `ConceptNodes` linked to the source.

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

- Label (Concept Name)
- Type (Entity Type: Person, Org, etc.)
- Confidence score (visualized as opacity or ring)

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
