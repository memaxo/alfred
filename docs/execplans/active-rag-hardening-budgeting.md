# ExecPlan: Active RAG Hardening - Context Budgeting

## Purpose

Protect the LLM context window and prevent excessive costs/latency by strictly enforcing a token/character limit on the injected RAG context.

## Plan

1.  **Define Limits**:
    - Set a constant, e.g., `MAX_RAG_CONTEXT_CHARS = 2000` (approx 500 tokens).

2.  **Implementation**:
    - Modify `apps/web/src/hooks/use-focused-context.ts`.
    - In the `useMemo` block where `combinedContent` is built:
      - Calculate the length of the local context.
      - Calculate remaining budget.
      - Iterate through `ragDocuments` and append them only if they fit.
      - Truncate the final document if needed (adding an ellipsis).

3.  **Transparency**:
    - If documents are dropped/truncated, update the `ragDocuments` list passed to `ContextLens` to reflect _what was actually included_ (or add a flag `isTruncated`).
    - Optionally, show a small indicator in the Lens (e.g., "3 documents (1 truncated)") so the user knows the limits.

## Verification

- **Test**: Mock a TRPC response with 3 large documents (1000 chars each).
- **Expectation**: The injected string in `combinedContent` should not exceed `MAX_RAG_CONTEXT_CHARS`.
- **Expectation**: The `ContextLens` should accurately reflect which documents are available to the LLM.
