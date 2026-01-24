# Plan: Comprehensive Holonic Testing Strategy

## 1. Objective

Ensure the new "Holonic Cognitive OS" features (LOD, Physics Layout, Command Palette, Living Edges) are robust, performant, and regression-free. We need to catch runtime bugs that static analysis misses, particularly in complex interaction flows.

## 2. Risk Analysis

- **Layout Loops:** The physics engine (`layout-semantic.ts`) could enter an infinite loop or NaN state if forces are unbalanced.
- **Memory Leaks:** Creating ephemeral `PrefixTrie` or `activeEdges` sets repeatedly might cause memory growth.
- **LOD Flickering:** Rapid zoom changes could cause nodes to "flicker" between states if thresholds aren't stable.
- **Command Palette Lag:** Large action lists could freeze the main thread during filtering.

## 3. Testing Strategy

### A. Unit Tests (Logic Verification)

- **Trie:** Verify `PrefixTrie` handles insert, completion, and scoring correctly (including tie-breaking).
- **Layout Engine:** Test `layoutSemantic` with 0, 1, and 100 nodes to ensure deterministic output and performance budget (<16ms per frame).
- **LOD Logic:** Verify `useLOD` thresholds and stability.

### B. Integration Tests (Component Interaction)

- **Command Palette:** Test that opening the palette, typing, and selecting a command fires the correct store action.
- **Node Lifecycle:** Test that creating a Node (via Palette) correctly adds it to the Store and renders it on the Canvas.
- **Edge Activity:** Test that calling `triggerEdgeActivity` temporarily sets the active state and clears it after the timeout.

### C. Visual/E2E Tests (Playwright)

- **Zoom Interaction:** Automate zooming in/out and assert that Node components switch variants (Tiny -> Small -> Full).
- **Focus Mode:** Click a node -> Assert camera centers and other nodes dim.
- **Workflow Animation:** Trigger a mock workflow -> Assert edge SVG class changes to "active".

## 4. Execution Plan

1.  [ ] **Unit Tests:** Create `apps/web/src/lib/trie.test.ts` and `layout-semantic.test.ts`.
2.  [ ] **Integration Tests:** Create `apps/web/src/components/__tests__/command-palette.test.tsx` using React Testing Library.
3.  [ ] **E2E Scenarios:** Create `apps/web/tests/holonic-interaction.spec.ts` for Playwright.
    - Scenario 1: "The Diver" (Zoom in from Orbit to App).
    - Scenario 2: "The Commander" (Open Palette -> Type "Chat" -> Enter -> Verify Chat Node).
4.  [ ] **Performance Bench:** Write a script to spawn 1000 nodes and measure FPS during layout.

## 5. Success Metrics

- Layout calculation < 10ms for 100 nodes.
- Command Palette search < 5ms for 1000 items.
- No visual regressions (flickering/pop-in).
