# Topic-Based Graph Filtering

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will enable users to **filter the Mindscape** by domain topics. As the Knowledge Graph grows, it becomes noisy. Users need to be able to say "Show me only my Coding knowledge" or "Hide Politics". This transforms the Mindscape from a "dump" into a curated workspace.

## Progress

- [ ] **Backend: Query Update**
  - [ ] Update `packages/api/src/routers/graph.ts` input schema to accept `topics: string[]`.
  - [ ] Modify the Datalog engine (`packages/knowledge/src/query.ts`) or SQL query builder to filter nodes by `properties->'topics'`.
- [ ] **Frontend: UI Controls**
  - [ ] Update `MindscapeCanvas` (`apps/web`) to hold `activeTopics` state.
  - [ ] Create a "Topic Filter" component (multiselect dropdown or toggle list) in the Mindscape control panel.
- [ ] **Integration**
  - [ ] Wire the frontend state to the `trpc.graph.runQuery` hook.
  - [ ] Verify nodes appear/disappear based on selection.

## Surprises & Discoveries

_(Populate during execution)_

## Decision Log

- **Default State**: "All Topics" are visible by default. Filtering is subtractive.

## Outcomes & Retrospective

_(Populate during execution)_

## Plan of Work

### 1. Backend

Update `graphRouter` to handle `topics` filter. Since we use Datalog for complex queries but SQL for basic retrieval, we need to ensure the filter applies to the retrieval step.
For `runQuery` (which often just fetches nodes), we'll add a SQL `WHERE` clause: `jsonb_path_exists(properties, '$.topics ? (@ == "coding")')`.

### 2. Frontend

Add a `TopicFilter` component to the top-right panel in `MindscapeCanvas`.

## Concrete Steps

1.  Update `graph.ts` router.
2.  Update `MindscapeCanvas` state.
3.  Implement `TopicFilter` UI.
