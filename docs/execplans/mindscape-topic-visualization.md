# Mindscape Topic Visualization

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will surface the newly extracted **Domain Topics** (Coding, AI, Security, etc.) directly in the Mindscape UI. This allows users to instantly see how ALFRED has classified their knowledge.

Specifically, we will upgrade the `ConceptNode` component to render colorful, icon-rich badges for each detected topic found in the node's data.

## Progress

- [ ] **Schema Update**
    - [ ] Verify `mindscape.schemas.ts` supports `topics: string[]` on `knowledgeNodeDataSchema` and `conceptNodeDataSchema`. (It likely needs adding).
    - [ ] Update `store/mindscape.ts` types if inference doesn't auto-update.
- [ ] **Component Upgrade (`ConceptNode`)**
    - [ ] Create a `TopicBadge` component that maps domain strings ("coding", "ai") to specific Tailwind colors and Lucide icons.
    - [ ] Update `apps/web/src/components/mindscape/nodes/concept-node.tsx` to render these badges.
- [ ] **Integration**
    - [ ] Ensure `KnowledgeNode` also displays these topics (as they share the underlying graph data structure).
- [ ] **Verification**
    - [ ] Run the Mindscape component test.
    - [ ] Manual verification (via `bun dev`) instructions.

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

- **Visuals**: We will use specific color coding:
    - Coding: Blue/Indigo (`bg-blue-500`)
    - Security: Red/Rose (`bg-red-500`)
    - AI: Violet/Purple (`bg-violet-500`)
    - General: Gray/Slate

## Outcomes & Retrospective

*(Populate during execution)*

## Context and Orientation

-   **Source**: `packages/agent/src/orchestrator/learning-worker.ts` saves `topics` into the `properties` JSON of graph nodes.
-   **Graph Router**: `packages/api/src/routers/graph.ts` returns these properties.
-   **Frontend**: `apps/web/src/components/mindscape/canvas.tsx` hydrates nodes.

## Plan of Work

### 1. Schema Update
Edit `apps/web/src/store/mindscape.schemas.ts` to add `topics: z.array(z.string()).optional()` to `knowledgeNodeDataSchema` and `conceptNodeDataSchema`.

### 2. UI Component
Create a mapping of domains to styles.
```tsx
const TOPIC_STYLES = {
  coding: { icon: Code, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  cybersecurity: { icon: ShieldAlert, color: "text-rose-400 border-rose-400/30 bg-rose-400/10" },
  // ...
}
```

### 3. Render
In `ConceptNode`, map `data.topics` to these badges.

## Concrete Steps

1.  Update schemas.
2.  Update `concept-node.tsx`.
3.  Update `knowledge-node.tsx`.
4.  Run component tests.
