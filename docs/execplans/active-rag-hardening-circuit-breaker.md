# ExecPlan: Active RAG Hardening - Circuit Breaking & Error Handling

## Purpose

Improve system resilience and user trust by gracefully handling backend failures during context retrieval. Distinguish between "no knowledge found" and "system error".

## Plan

1.  **Error State Handling**:
    - Modify `apps/web/src/hooks/use-focused-context.ts` to export an `error` property from the TRPC query.
    - Modify `ContextLens` component in `apps/web/src/components/chat-container.tsx`.

2.  **UI Updates (ContextLens)**:
    - Add an `isError` prop.
    - If `isError` is true:
      - Change badge color (e.g., amber/yellow border instead of indigo).
      - Change icon (e.g., `AlertTriangle` or just a distinct color for `Info`).
      - In the Popover content, display "Context retrieval unavailable" instead of "No related documents".

3.  **Silent Failover**:
    - Ensure that `combinedContent` (sent to LLM) simply omits the RAG section on error, rather than injecting error text (which might confuse the model).
    - The `useFocusedContext` hook is already doing this via `if (ragQuery.data ...)` checks, but verify `!ragQuery.error` is implicit or explicit.

## Verification

- **Test**: Force a backend 500 error for `graph.runQuery`.
- **Expectation**: UI shows amber warning badge. Hover text says "unavailable". LLM prompt receives only local node context (no crash).
