# Mindscape Architecture

1. **LOD Polymorphism.** All graph nodes must use `useLOD()` to implement four distinct render states (tiny/small/medium/full). Tiny/small states must minimize DOM depth (no complex sub-trees) to ensure 60fps performance with 1000+ nodes.

2. **Focus Gravity.** Nodes must subscribe to `useNodeFocus()` to apply visual suppression (blur/grayscale/scale-down) when another node is active. The focused node must visually dominate the viewport as a "modal-less modal."

3. **Contextual Commands.** Register actions in `config/actions.ts` with `validNodeTypes`. The Command Palette must filter actions based on the currently focused node ID to provide a context-aware interface.

4. **Algorithmic Isolation.** Keep physics (layout) and search (trie) logic in pure TypeScript files (`lib/*.ts`) separate from React components. This ensures core logic is unit-testable even if the DOM environment is unstable.

5. **Event-Driven Activations.** Use `dispatchMindscapeEvent` to visualize system activity. Never manipulate `activeEdges` directly from functional components. Visualization must be a side effect of real events (Reality-Driven UI).

6. **Context Trace.** Visually highlight graph edges involved in active context retrieval ("Cognitive Pulse") to show the user *why* the system knows about dependencies.

7. **Concept node spawning.** When spawning concept nodes from graph traversal or visualization, use radial positioning around the parent node: `angle = (index / totalNodes) * 2 * Math.PI`, `x = parentPos.x + radius * Math.cos(angle)`, `y = parentPos.y + radius * Math.sin(angle)`. Use `MINDSCAPE_CONFIG.SPAWN_RADIUS` constant from `@/config/mindscape` for consistent spacing.

8. **Edge deduplication.** When merging edges from visualization results, use `Map<string, Edge>` keyed by edge ID to prevent duplicates. Merge new edges into existing edge map before calling `setEdges(Array.from(edgeMap.values()))`.

9. **Async action error handling.** Command palette actions that call async tRPC mutations must wrap execution in try-catch blocks. Surface errors via toast notifications (`toast.error()`) and log with structured context (`console.error("action_failed", error)`). Never silently swallow errors from async actions.
