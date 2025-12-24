# Mindscape Architecture

## Desktop Store Architecture

1. **Store slices.** Desktop state is managed in `store/desktop/` with four slices: `windows.ts` (window CRUD), `viewport.ts` (focus, zoom), `dock.ts` (pins, spawning), `persist.ts` (localStorage). Import via `useDesktopStore` from `store/desktop`.

2. **Window types.** 12 window types defined in `store/desktop/types.ts`: chat, note, reminder, timer, bookmark, todo, workflow, droid, settings, privacy, profile, integrations. Register new types in `components/windows/registry.tsx`.

3. **Selectors pattern.** Use memoized selectors from `store/desktop/selectors.ts` for derived state: `selectWindows`, `selectWindowById`, `selectEdgesForWindow`, `selectFocusedWindow`, `selectStats`. Never compute derived state inline.

4. **Storage budget.** Layout persistence must stay under 50KB in localStorage. Use `getLayoutStorageSize()` from `lib/desktop/performance.ts` to monitor. Store positions and minimal metadata only, never content.

## Rendering & Performance

5. **LOD Polymorphism.** All nodes use `useLOD()` for four render states (tiny/small/medium/full). Tiny/small states minimize DOM depth for 60fps with 1000+ nodes.

6. **Edge degradation.** Use `useVisibleEdges()` hook for automatic edge filtering by zoom level: <0.3 hides all, 0.3-0.6 shows important only, >0.6 shows all with labels.

7. **Focus gravity.** Nodes subscribe to `useNodeFocus()` for visual suppression when another node is active. Focused node dominates viewport as "modal-less modal."

## Data Layer

8. **TanStack DB collections.** Resource persistence uses collections in `collections/`: `noteCollection`, `reminderCollection`. Collections provide optimistic updates via `createOptimisticAction` pattern.

9. **Subscription protocol.** Real-time sync via `lib/subscription/manager.ts`. Multiplexed WebSocket with cursor-based resume. Use `useGraphSubscription` and `useWorkflowSubscription` hooks.

## UI Patterns

10. **Contextual commands.** Register actions in `config/actions.ts` with `validNodeTypes`. Command Palette (Ctrl+K) filters by focused node.

11. **Window spawning.** Use `spawn(type)` from dock slice. Singletons (chat, settings) focus existing; others create new. Position offset prevents overlap.

12. **Event-driven activations.** Use `dispatchMindscapeEvent` for visualization. Never manipulate `activeEdges` directly. Visualization derives from real events (Reality-Driven UI).

13. **Edge deduplication.** When merging edges, use `Map<string, Edge>` keyed by ID to prevent duplicates before `setEdges()`.

14. **Async error handling.** Command palette async actions must use try-catch. Surface errors via `toast.error()` and log with context.
