# ExecPlan: Integrate Active RAG into Mindscape Chat

## Purpose
The "Active RAG" features (Context Lens, Deep RAG, Context Trace) were implemented in `ChatContainer` but are missing from the production `ChatNode` used in the Mindscape. This plan bridges that gap, ensuring the spatial chat interface has full cognitive context awareness.

## 1. Refactor & Extract
**Goal**: Make `ContextLens` a reusable component.
*   **Source**: `apps/web/src/components/chat-container.tsx`
*   **Destination**: `apps/web/src/components/mindscape/context-lens.tsx`
*   **Changes**: Export `ContextLens` as a standalone component. Ensure it accepts `ContextState` props.

## 2. Integrate into ChatNode
**Goal**: Connect the spatial chat to the cognitive context hook.
*   **Target**: `apps/web/src/components/mindscape/nodes/chat-node.tsx`
*   **Changes**:
    *   Call `useFocusedContext()` hook.
    *   Render `<ContextLens />` in the header area of the `MindscapeNode` (or right above the conversation).
    *   Pass the focused context to the `Chat` logic (this is already handled by backend, but visual confirmation is key).

## 3. Refine Visual Hierarchy
**Goal**: Ensure the lens fits the "Signal in the Void" aesthetic within a Node.
*   **Design**:
    *   The `ContextLens` trigger button should probably live in the node header actions or floating inside the chat area (top-right).
    *   Ensure the Popover z-index plays nicely with the Mindscape canvas.

## 4. Verification
*   **Scenario**: Focus a "Knowledge Node" connected to other nodes.
*   **Action**: Open/Focus the "Chat Node" (or Neural Stream).
*   **Expectation**:
    1.  Edges pulse Indigo (Context Trace - already active via hook).
    2.  `ContextLens` appears in the Chat Node.
    3.  Clicking Lens shows 1-hop and 2-hop neighbors.

## Step-by-Step
1.  **Create**: `apps/web/src/components/mindscape/context-lens.tsx` by extracting from `chat-container.tsx`.
2.  **Update**: `chat-container.tsx` to use the new shared component (verify no regression).
3.  **Update**: `chat-node.tsx` to import `useFocusedContext` and render `ContextLens`.
