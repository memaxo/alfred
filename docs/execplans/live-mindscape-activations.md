# Live Mindscape Activations ExecPlan

Owner: frontend

## Purpose

Enhance the Mindscape visualization to reflect real-time system cognition. Instead of static graphs, the Mindscape should pulse with "neuro-activity" corresponding to:

1. **RAG Retrieval:** Visualizing the path from query to retrieved knowledge.
2. **Tool Execution:** Visualizing the handoff from reasoning (Chat) to capability (Tool).
3. **Voice Activity:** Visualizing the heartbeat of conversation (VAD/TTS).

This adheres to the **Reality-Driven UI** rule by visualizing only actual system events.

## Plan

### Phase 1: Event Ingestion Architecture

Establish a unified way to trigger graph activations from disparate sources.

- [ ] Extend `useMindscapeStore` with `triggerNodeActivity(nodeId, type: "input" | "output" | "processing")`.
- [ ] Create `useMindscapeActivations` hook that listens to global event buses (Chat, Voice, Workflow).

### Phase 2: Tool & RAG Visualization

Visualize the "Thought → Action" loop.

- [ ] **Tool Calls:** Intercept `tool-call` parts in `useChatLogic` / `ChatContainer`.
  - Trigger edge: `ChatNode` → `ToolNode` (e.g., "Linear", "Git").
  - Animation: Fast pulse (action initiated).
- [ ] **RAG Retrieval:** Intercept `search_knowledge` tool results.
  - Trigger edge: `ChatNode` → `KnowledgeNode` (the retrieved doc).
  - Animation: Flowing particle from Doc to Chat (information retrieval).

### Phase 3: Voice Activity Visualization

Visualize the "Hearing → Speaking" loop.

- [ ] **VAD (User Speaking):**
  - Source: `useVoiceSessionWeb` → `isSpeaking`.
  - Visual: Pulse `UserNode` → `VoiceSessionNode` → `ChatNode`.
- [ ] **TTS (System Speaking):**
  - Source: `useVoiceSessionWeb` → `isPlaying`.
  - Visual: Pulse `ChatNode` → `VoiceSessionNode` → `UserNode`.

### Phase 4: Performance Profiling

Ensure 60fps under load.

- [ ] Create stress test with simulated high-frequency event stream (10+ events/sec).
- [ ] Profile `LivingEdge` CSS animations vs Canvas/WebGL implementation.
- [ ] optimize: Use `requestAnimationFrame` batching for store updates if React rendering becomes a bottleneck.

## Progress

- [ ] Phase 1: Event Ingestion
- [ ] Phase 2: Tool & RAG
- [ ] Phase 3: Voice
- [ ] Phase 4: Performance

## Decision Log

- **Visual Metaphor:** We use "pulses" for discrete events (Tools) and "flow" for continuous states (Voice).
- **State Management:** Activations are transient UI state, stored in Zustand (`activeEdges`), not persisted to DB.

## Outcomes & Retrospective

**Outcomes:**

- Implemented unified event bus (`useMindscapeActivations`, `dispatchMindscapeEvent`) to decouple visualization from logic.
- Enforced "Reality-Driven UI" by removing simulation modes and connecting directly to `tool-call` (Tool), `voice-input/output` (Voice), and `workflow-step` (Workflow) events.
- Visualized RAG retrieval paths using real response headers from the assistant stream.
- Verified end-to-end functionality with `apps/web/tests/mindscape-activation.e2e.spec.ts`.

**Retrospective:**

- **Success:** The event bus pattern proved highly effective for cross-cutting visualization concerns without coupling deeply into functional components.
- **Correction:** Initial implementation relied on "simulated" paths which violated lean app principles; this was corrected by wiring up real system events instead.
- **Future:** Consider visualizing "Thought" nodes (reasoning steps) using the same pattern as `tool-call` events.
