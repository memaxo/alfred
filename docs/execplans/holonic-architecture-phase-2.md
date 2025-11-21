# Holonic Architecture Phase 2: Roadmap & ExecPlans

This document outlines the five execution plans required to mature the Holonic Cognitive OS architecture from a prototype to a production-grade "Living Environment."

---

## Plan 1: Holonic Ecosystem Completion

### 1. Objective
Eliminate visual jarring and cognitive dissonance by ensuring **every** node type in the Mindscape supports the Polymorphic LOD (Level of Detail) system. Currently, only core nodes (Note, Workflow, Chat) support it; system nodes remain static.

### 2. Scope
**Target Nodes:**
-   **Knowledge:** `KnowledgeNode`, `ConceptNode`, `BookmarkNode`
-   **System:** `SettingsNode`, `PrivacyNode`, `ProfileNode`, `IntegrationsNode`
-   **Dev Tools:** `CodeNode`, `TerminalNode`, `DeploymentNode`

### 3. Technical Strategy
-   **Pattern Application:** Apply the `useLOD()` and `useNodeFocus()` hooks to all target components.
-   **Visual Consistency:**
    -   **Tiny (LOD 0):** Render as colored particles (Knowledge=Emerald, System=Slate, Dev=Cyan).
    -   **Small (LOD 1):** Icon + truncated label.
    -   **Medium/Full:** Existing implementation with "Focus Mode" styling (glow/scale).

### 4. Implementation Steps
1.  [ ] Refactor **Knowledge Group**:
    -   `KnowledgeNode`: Particle (Emerald) -> Summary Card -> Full Doc Viewer.
    -   `ConceptNode`: Particle (Amber) -> Definition Card -> Concept Graph.
    -   `BookmarkNode`: Particle (Blue) -> Favicon+Title -> Embed/Preview.
2.  [ ] Refactor **System Group**:
    -   `Profile/Settings/Privacy`: Particle (Gray) -> Icon -> Form.
    -   `IntegrationsNode`: Particle (Purple) -> Status Grid -> Config.
3.  [ ] Refactor **Dev Group**:
    -   `CodeNode`: Particle (Cyan) -> Snippet Preview -> Editor.
    -   `TerminalNode`: Particle (Black) -> Last Line -> Full Console.
4.  [ ] **Verify:** Walk through the graph at all zoom levels to ensure no node "pops" unexpectedly or fails to fade.

---

## Plan 2: The Loom V2 (Web Worker Physics)

### 1. Objective
Offload the `layoutSemantic` force-directed graph calculations to a Web Worker to maintain 60fps UI performance while scaling from ~50 to ~1000+ nodes. Add "Semantic Clustering" to group nodes by project/context.

### 2. Technical Strategy
-   **Concurrency:** Move `layoutSemantic.ts` logic into `layout.worker.ts`.
-   **Messaging:** Use a request/response loop: Main thread sends `nodes/edges` -> Worker computes velocities -> Worker sends `positions`.
-   **Clustering:** Introduce a `clusterId` field to `ArtifactData`. Modify physics engine to add a strong attractive force between nodes sharing a `clusterId`.

### 3. Implementation Steps
1.  [ ] **Worker Setup:** Create `apps/web/src/lib/layout.worker.ts`.
2.  [ ] **Migration:** Move force-simulation logic from the main thread to the worker.
3.  [ ] **Bridge:** Update `MindscapeStore` to instantiate the worker and listen for position updates.
4.  [ ] **Optimization:** Implement "Transferable Objects" (Float32Arrays) for position data to minimize serialization overhead.
5.  [ ] **Cluster Logic:**
    -   Update `layoutSemantic` to accept `clusterMap`.
    -   Add `groupGravity` force: `if (a.cluster === b.cluster) force *= 5`.

---

## Plan 3: High-Performance "Starfield" (Hybrid Renderer)

### 1. Objective
Render thousands of nodes with zero DOM overhead when zoomed out (LOD 0). Transition seamlessly from a WebGL/Canvas "Starfield" to React Components as the user zooms in.

### 2. Technical Strategy
-   **Hybrid Layer:**
    -   **LOD 0 (Tiny):** Render ALL nodes as points on a single `<canvas>` layer via `react-flow`'s `<Background />` or a custom overlay. Set React Node opacity to 0 (or unmount).
    -   **LOD 1+:** Fade out Canvas points, fade in React Nodes.
-   **Culling:** Use `getNodesInViewport` to only mount React components for nodes currently visible and large enough to read.

### 3. Implementation Steps
1.  [ ] **Canvas Overlay:** Create `<MindscapeStarfield />` component using a `canvas` element.
2.  [ ] **Sync Loop:** Bind canvas render loop to `useStore(s => s.transform)`. Draw circles at `node.x * zoom + pan.x`.
3.  [ ] **Culling Logic:** Modify `MindscapeCanvas` to conditionally render the `ReactFlow` nodes list based on `useLOD()`.
    -   If `LOD === Tiny`, pass `[]` to ReactFlow (or `display: none`), and render Starfield.
    -   If `LOD > Tiny`, render ReactFlow nodes and hide Starfield.
4.  [ ] **Transition:** Add CSS transitions to opacity to smooth the handoff between Canvas and DOM.

---

## Plan 4: Contextual Omni-Palette

### 1. Objective
Transform the "Command Palette" (`Cmd+K`) into a context-aware tool that suggests actions based on the user's current focus (the active Node) rather than just global commands.

### 2. Technical Strategy
-   **Context Resolution:** Hook into `useMindscapeStore.focusedNodeId`.
-   **Action Registry:** Define a map of `NodeType -> Action[]`.
    -   *Example (Note):* "Summarize", "Translate", "Copy as Markdown".
    -   *Example (Workflow):* "Retry", "View Logs", "Modify Prompt".
-   **Priority Sorting:** When `Cmd+K` opens, lift "Context Actions" to the top of the list, followed by "Global Actions."

### 3. Implementation Steps
1.  [ ] **Registry Definition:** Create `apps/web/src/config/actions.ts`. Define actions with `icon`, `label`, `handler`, and `validNodeTypes`.
2.  [ ] **Update Component:** Refactor `MindscapeCommandPalette` to read `focusedNodeId`.
3.  [ ] **Dynamic Filtering:** Inside the palette, filter actions: `actions.filter(a => a.validNodeTypes.includes(focusedNode?.type))`.
4.  [ ] **Gaze Interaction:** (Optional) If no node is "focused" (pinned), use the node currently under the mouse cursor (hover state).

---

## Plan 5: "Living" Edge Animations

### 1. Objective
Visualize data flow and activity. When a Workflow modifies a Note, or a Chat references a File, the connecting edge should visibly "pulse" or "flow" to indicate active transmission.

### 2. Technical Strategy
-   **Edge State:** Add `activity` state to Edges (`idle` | `active` | `error`).
-   **SVG Animation:** Use CSS `stroke-dasharray` and `stroke-dashoffset` keyframes.
-   **Signal Triggers:** Listen for TRPC events or Store updates (e.g., "Workflow Step Complete") to trigger a transient `active` state on relevant edges.

### 3. Implementation Steps
1.  [ ] **Custom Edge:** Create `LivingEdge.tsx` extending React Flow's `BaseEdge`.
2.  [ ] **CSS Animation:** Add `@keyframes flow { to { stroke-dashoffset: -100; } }`.
3.  [ ] **Store Update:** Add `triggerEdgeActivity(edgeId, duration)` to `MindscapeStore`.
4.  [ ] **Event Hook:** In `WorkflowManager` or `ChatNode`, call `triggerEdgeActivity` when an operation completes, targeting the edge between the Agent and the Artifact.
