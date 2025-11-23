# ExecPlan: Mindscape Confidence Visualization

## Purpose
Enhance the Mindscape UI to visually represent the "freshness" and confidence of knowledge nodes. This allows users to intuitively distinguish between active, high-confidence memories and decaying/stale facts.

## Plan
- [ ] **Data Pipeline Update**: Ensure the `confidence` property from `memory_nodes` is correctly propagated through the API (`packages/api/src/routers/graph.ts`) to the frontend types.
- [ ] **Visual Design**: Define visual treatments for confidence levels:
    - High (0.8 - 1.0): Full opacity, standard saturation.
    - Medium (0.5 - 0.8): Slight transparency (0.9), reduced saturation.
    - Low (< 0.5): Higher transparency (0.6), desaturated/grayscale.
- [ ] **Component Implementation**: Update `apps/web/src/components/mindscape/nodes/shared-lod.tsx` (or individual node components) to apply these styles based on the `data.properties.confidence` value.
- [ ] **Archived State**: Implement a distinct visual state for archived nodes (if they appear in the graph), such as a dashed border or specific "ghost" styling.
- [ ] **Hover/Details**: Update the node details panel/tooltip to explicitly show the confidence score and last updated date.

## Progress
- [ ] Data Pipeline Update
- [ ] Visual Design
- [ ] Component Implementation
- [ ] Archived State
- [ ] Hover/Details

## Surprises & Discoveries
*(To be filled during execution)*

## Decision Log
*(To be filled during execution)*

## Outcomes & Retrospective
*(To be filled upon completion)*
