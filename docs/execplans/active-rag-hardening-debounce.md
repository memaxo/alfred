# ExecPlan: Active RAG Hardening - Debounced Retrieval

## Purpose

Prevent backend overload and unnecessary API calls during rapid navigation (e.g., arrow key traversal or fast clicking) in the Mindscape. Ensure RAG queries only fire when the user's attention "settles" on a node.

## Plan

1.  **Utility Creation**:
    - Check if a `useDebounce` hook exists in `apps/web/src/hooks/`. If not, create one (standard pattern: `useState` + `useEffect` with `setTimeout`).

2.  **Hook Integration**:
    - Modify `apps/web/src/hooks/use-focused-context.ts`.
    - Debounce the `focusedNodeId` or the derived `queryText` with a ~300ms delay.
    - Pass the _debounced_ value to the `trpc.graph.runQuery.useQuery` hook key/enabled check.

3.  **Visual Feedback**:
    - Ensure the UI doesn't flash "Loading" immediately upon focus change if we are in the debounce window. The `ContextLens` should likely retain the _previous_ context or show a neutral state until the debounce timer clears.

## Verification

- **Test**: Rapidly switch focus between 5 nodes in < 1 second.
- **Expectation**: Only 1 (or 0) TRPC queries should be fired, corresponding to the final node settled upon.
- **Test**: Dwell on a node for > 300ms.
- **Expectation**: Query fires and context updates.
