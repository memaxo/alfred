# Explicit Feedback Loop (Correction)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will give users the power to **correct** ALFRED's semantic classification. If the system incorrectly tags "Sourdough" as "Coding" (due to a vector hallucination), the user can right-click the badge and remove it. This improves the graph quality and feeds back into the system (potentially).

## Progress

- [ ] **Backend: Mutation**
    - [ ] Create `trpc.graph.updateNodeTopics` mutation in `packages/api/src/routers/graph.ts`.
    - [ ] Logic: Update the `properties` column in Postgres.
- [ ] **Frontend: Interaction**
    - [ ] Update `ConceptNode` and `KnowledgeNode` to support interaction on badges.
    - [ ] Implement a context menu (or "X" button on hover) for `TopicBadge`.
    - [ ] Wire the "Remove" action to the mutation.
- [ ] **Testing**
    - [ ] Verify that removing a topic persists after refresh.

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

- **Scope**: Phase 1 is "Correction" (removing/adding tags). We are *not* yet implementing "Negative Training" (updating the vector classifier itself), as that is complex. We are just fixing the DB record.

## Outcomes & Retrospective

*(Populate during execution)*

## Plan of Work

### 1. Backend
Add `updateTopics` mutation.
```typescript
updateTopics: authedProcedure
  .input(z.object({ nodeId: z.string(), topics: z.array(z.string()) }))
  .mutation(...)
```

### 2. Frontend
Make `TopicBadge` interactive.
On click/hover -> Show "Remove".
On remove -> Call mutation -> Optimistic UI update.

## Concrete Steps

1.  Add mutation to `graph.ts`.
2.  Update `TopicBadge` in `concept-node.tsx` to be interactive.
