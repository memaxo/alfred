# Mindscape Architecture

## Visualization Philosophy

Mindscape adheres to the **Reality-Driven UI** principle. Visualization must derive strictly from real system state or events. "Simulation" modes, mock data generators, and fake actions are strictly forbidden in production components.

## Event-Driven Activations

Visual activity in the graph (glowing edges, pulsing nodes) is driven by a unified event bus. This decouples the visualization layer (Mindscape) from the functional layers (Voice, Chat, Workflow).

### Event Bus API

- **Hook:** `useMindscapeActivations()` (consumes events)
- **Dispatcher:** `dispatchMindscapeEvent(event)` (produces events)

### Event Types

| Type | Trigger | Visual Effect |
| :--- | :--- | :--- |
| `voice-input` | User VAD active | Pulse `User` → `VoiceSession` |
| `voice-output` | System TTS playing | Pulse `VoiceSession` → `User` |
| `tool-call` | Tool execution started | Pulse `Chat` → `ToolNode` |
| `rag-retrieval` | Documents retrieved | Pulse `KnowledgeNode` (output) |
| `workflow-step` | Workflow event received | Pulse `WorkflowNode` (output) |

### Implementation Pattern

To visualize a new system activity:
1.  Locate the functional component/hook where the activity occurs.
2.  Import `dispatchMindscapeEvent` from `@/hooks/use-mindscape-activations`.
3.  Dispatch an event with `sourceId` and/or `targetId`.
4.  The `MindscapeCanvas` will automatically visualize the activation.

## Core Components

1. **LOD Polymorphism.** All graph nodes must use `useLOD()` to implement four distinct render states (tiny/small/medium/full). Tiny/small states must minimize DOM depth (no complex sub-trees) to ensure 60fps performance with 1000+ nodes.

2. **Focus Gravity.** Nodes must subscribe to `useNodeFocus()` to apply visual suppression (blur/grayscale/scale-down) when another node is active. The focused node must visually dominate the viewport as a "modal-less modal."

3. **Contextual Commands.** Register actions in `config/actions.ts` with `validNodeTypes`. The Command Palette must filter actions based on the currently focused node ID to provide a context-aware interface.

4. **Algorithmic Isolation.** Keep physics (layout) and search (trie) logic in pure TypeScript files (`lib/*.ts`) separate from React components. This ensures core logic is unit-testable even if the DOM environment is unstable.
