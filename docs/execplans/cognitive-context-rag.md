# ExecPlan: Cognitive Context (RAG Integration)

**Status**: Proposed
**Goal**: Connect the visual "Focus Mode" to the AI's cognitive context, enabling "Chat with Node" functionality.

## Context
Currently, focusing a node in Mindscape is purely visual. It changes the layout and highlights the node, but if the user starts typing in the chat/command palette, the AI doesn't inherently know *which* node is focused or what its content is. We need to bridge this gap.

## Architecture

### 1. Focus State Propagation
- The `MindscapeStore` already tracks `focusedNodeId`.
- We need to expose this to the `Chat` or `CommandPalette` context.

### 2. RAG Injection
When a chat session is active and a node is focused:
- **Fetch**: Retrieve the node's full content (Note body, Workflow logs, Knowledge facts).
- **Inject**: Add a transparent "System Message" or "Context Block" to the AI's prompt.
  - *User Focus: Node "Project X" (Type: Note)*
  - *Content: ...*
- **UX**: Display a visual indicator "Context: Project X" in the chat input area.

### 3. "Ask" Action
- Add a specialized action in the Command Palette: `Ask about [Node Name]`.
- This explicitly starts a chat session seeded with that node's context.

## Implementation Steps

1.  [x] **Store Update**: Ensure `focusedNodeId` is accessible to the Chat component (it is via zustand).
2.  [x] **Context Hook**: Create `useFocusedContext()`:
    - Watches `focusedNodeId`.
    - Fetches data via TRPC (`node.getContext`).
    - *Update*: Handle `ChatNode` focus by looking for connected neighbors (context propagation).
3.  [x] **Chat Integration**:
    - Update `ChatContainer` to accept `additionalContext`.
    - Pass `useFocusedContext()` result to the `useChat` / `streamText` call. (Handled in `useChatLogic` and `ChatNode`).
4.  [x] **Visual Feedback**: Add a "pill" above the chat input showing the active context. (Implemented as `ContextLens`).
5.  [x] **"Ask" Action**: Add specialized action in Command Palette to spawn/focus Chat and link it to target.

## Verification
- **Scenario**:
    1. Focus "Meeting Notes".
    2. Trigger "Ask about Node" (CMD+K -> Ask).
    3. Chat opens (or focuses).
    4. Edge created between Chat and Meeting Notes.
    5. Chat input context pill shows "Meeting Notes".
    6. Type "Summarize this". AI responds with summary.
