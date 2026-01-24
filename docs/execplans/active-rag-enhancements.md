# ExecPlan: Active RAG Enhancements (Trace, Telemetry, Fallback)

## Purpose

Enhance the "Active RAG" system by adding visual feedback ("Context Trace"), improving observability (Telemetry), and increasing intelligence ("Deep RAG" fallback). This transforms the feature from a background optimization into a user-facing cognitive aid.

## 1. "Context Trace" Visualization (Delighter)

**Goal**: Visually highlight graph edges that contributed to the active context, reinforcing the connection between the Mindscape and the Chat.

### Architecture

- **Store**: Add `highlightedEdgeIds` (Set<string>) to `useMindscapeStore`.
- **Hook**: Update `useFocusedContext` to extract edge IDs from the RAG result (`nodes.map(n => n.id)`) and update the store.
- **Component**: Update `LivingEdge.tsx` to react to `highlightedEdgeIds`.
  - **Visual Style**: Use a distinct "Cognitive Pulse" (Indigo/Blue) to differentiate from standard "Activity" (White/Biolum).
  - **Animation**: A slow, steady flow (`flow-slow`) to indicate persistent context, vs the rapid `flow` of active transmission.

### Implementation Steps

1.  **Store**: Update `apps/web/src/store/mindscape.ts` to add `highlightedEdgeIds` and `setHighlightedEdges(ids: string[])`.
2.  **Hook**: In `useFocusedContext`, when `ragQuery.data` arrives:
    - Extract `edges` from the response.
    - Call `setHighlightedEdges(edgeIds)`.
    - Clear edges when focus is lost or query invalidates.
3.  **Component**: Update `LivingEdge.tsx`:
    - Subscribe to `highlightedEdgeIds`.
    - If highlighted, apply `stroke-indigo-400` and `strokeWidth: 1.5`.

## 2. Telemetry & Efficacy (Observability)

**Goal**: Measure the "Hit Rate" of semantic vs. structural retrieval and monitor latency.

### Metrics Plan

- `graph_rag_hits_total`: Counter with labels `source="vector"`, `source="graph"`.
- `graph_rag_empty_total`: Counter for zero-result queries.
- `graph_context_duration_seconds`: Histogram for the `kind="context"` query path.

### Implementation Steps

1.  **API**: Update `packages/api/src/metrics.ts` to export new metrics.
2.  **Router**: In `packages/api/src/routers/graph.ts` (`runQuery`):
    - Increment `graph_rag_hits_total` based on `ragResult.nodes.length` and `graphNodes.length`.
    - If both are 0, increment `graph_rag_empty_total`.
    - Measure duration specifically for `kind="context"`.

## 3. "Deep RAG" Fallback (Intelligence)

**Goal**: Ensure "Leaf Nodes" (nodes with few direct connections) still receive structural context by looking deeper in the graph.

### Logic

- If `1-hop` traversal returns < `MIN_STRUCTURAL_CONTEXT` (e.g., 3 items):
  - Trigger a `2-hop` traversal from the original node.
  - Filter out visited nodes.
  - Add to results until budget or limit is met.

### Implementation Steps

1.  **Router**: In `packages/api/src/routers/graph.ts` (`runQuery`):
    - Check `edges.length`.
    - If `< 3`, run a second query for `2-hop` neighbors.
    - This might require a recursive CTE or a second specialized query (e.g., `getDeepStructuralContext`).
    - _Constraint_: Ensure we don't blow up latency. Limit 2-hop fetch to 20ms timeout.

## Execution Order

1.  **Telemetry** (Low risk, high value for verifying subsequent steps).
2.  **Context Trace** (High visible impact, low risk).
3.  **Deep RAG** (Higher complexity, performance risk).

## Verification

- **Visual**: Focus a node -> Confirm edges turn Indigo.
- **Metrics**: Check `/api/metrics` -> Confirm `graph_rag_hits_total` increments.
- **Deep**: Focus a leaf node -> Confirm 2-hop neighbors appear in Context Lens.
