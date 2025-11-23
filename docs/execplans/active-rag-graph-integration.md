# ExecPlan: Structural Graph-RAG Integration

## Purpose
Upgrade the "Active RAG" system from purely semantic (vector-based) retrieval to **Graph-Aware Retrieval**. This ensures ALFRED understands not just the *topic* of a focused node, but its *structural place* in the system (dependencies, blockers, parent/child relations), enabling truly "Cognitive" context.

## Core Concept: "The Context Horizon"
When a user focuses a node, the context horizon includes:
1.  **Semantic**: "What is similar to this?" (Existing Vector RAG)
2.  **Structural**: "What is connected to this?" (New Graph Traversal)

## Implementation Plan

### 1. Backend: Enhanced Graph Query (`packages/api/src/routers/graph.ts`)
*   **Objective**: Modify `runQuery` or create a new `getContext` procedure that executes a hybrid fetch efficiently.
*   **Logic**:
    *   Parallel Execution:
        *   **Task A (Vector)**: Run existing vector search (`semantic`).
        *   **Task B (Graph)**: Run a 1-hop (or 2-hop) traversal (`traverse`) to get incoming/outgoing edges (e.g., `depends_on`, `relates_to`, `part_of`).
    *   **Fusion**: Deduplicate nodes found in both. Prioritize Graph neighbors for the "Structural" context section.
*   **Optimization**: Ensure the graph traversal uses the optimized Drizzle/Postgres queries (using `memoryEdges` indices).

### 2. Frontend: Hook Refactor (`apps/web/src/hooks/use-focused-context.ts`)
*   **Objective**: Consume the new hybrid data structure.
*   **Data Structure**:
    ```typescript
    type ContextData = {
        ragDocuments: Array<{ label: string; summary: string; source: "vector" }>;
        graphNeighbors: Array<{ label: string; relation: "blocks" | "depends_on"; source: "graph" }>;
    }
    ```
*   **Prompt Injection**:
    *   Format the context to explicitly separate these types for the LLM:
        ```text
        [Structural Context]
        - Login Service *depends on* Redis Cache
        - Login Service *is blocked by* Ticket-999

        [Knowledge Context]
        - Login Service Architecture (Doc)
        - Auth Protocols (Doc)
        ```

### 3. UI: Enhanced Context Lens (`apps/web/src/components/chat-container.tsx`)
*   **Objective**: Visualize the difference between "Related Knowledge" and "Structural Connections".
*   **Design**:
    *   Split the Popover content into two sections.
    *   Use distinct icons (e.g., `Network` vs `BookOpen`).
    *   This gives the user immediate visual confirmation: "I see the code (RAG) and I see the dependencies (Graph)."

### 4. Hardening & Budgeting
*   **Budget Allocation**:
    *   Allocate strict quotas. E.g., 20% of the context budget to Graph Edges (high value, low token count), 80% to Vector Docs (lower density).
    *   Graph edges are "higher signal" per token, so they get priority.

## Progress

- [x] **API**: Updated `graph.runQuery` to support `kind: "context"`, enabling parallel execution of structural (1-hop neighbors) and semantic (vector) queries.
- [x] **Hook**: Updated `useFocusedContext` to use the new API, implement dynamic budgeting (30% of model window), and merge results with a "Graph Priority" strategy.
- [x] **UI**: Updated `ContextLens` to differentiate between Graph (Indigo/Network icon) and Vector (White/Book icon) sources.
- [x] **Verification**: Validated with integration tests (`apps/web/src/hooks/__tests__/use-focused-context.test.tsx`) covering RAG triggers, payload correctness, and result merging.

## Outcomes & Retrospective

The integration successfully bridged the "Semantic vs. Structural Gap". By fetching 1-hop neighbors alongside vector results, we provide the LLM with immediate awareness of dependencies and relationships without it needing to ask.

**Key Decisions:**
- **Unified Query**: Instead of two separate TRPC calls, we unified them in `graph.runQuery(kind="context")` to reduce network round-trips and allow server-side optimization.
- **Budgeting**: We implemented a "Graph Priority" strategy where structural edges (being low-token, high-signal) always consume the budget first, with remaining space filled by vector documents.
- **UI Feedback**: The Context Lens now explicitly shows *why* something is in context (e.g., "Is DEPENDS_ON by..."), reinforcing the user's mental model of the graph.

**Next Steps:**
- Consider extending to 2-hop neighbors for deeper reasoning if latency permits.
- Add telemetry to measure the "Helpfulness" of structural context vs semantic context in actual conversations.
