# Desktop UX & Motion

1. **Spatial Layout ID.** Always use `layoutId` from Framer Motion for windows and widgets to enable smooth transitions between Desktop and Mindscape modes.
2. **Focus Gravity.** Use the `useFocusGravity` hook in all window frames to dim and blur background elements when a window is focused.
3. **Physics-Based Transitions.** Prefer spring-based animations for window spawning and closing; use `AnimatePresence` to ensure exit animations trigger.
4. **Reduced Motion Priority.** Every spring or high-frequency animation must check `useReducedMotion()` and fallback to `opacity` or `tween` transitions with zero scale effects.
5. **Connectivity Awareness.** Use the global network listener in the shell to apply visual filters (e.g. red-tinted HUD) and display persistent warnings when offline.
6. **Optimistic Persistence.** Tier 4 apps (Notes, Reminders, Todos) must use TanStack Query optimistic updates to ensure zero-latency interaction during network latency.
7. **Storage Budgeting.** All serialized desktop state must remain under 50KB. Implement proactive size auditing and pruning of ephemeral caches (like context snapshots) in the persistence middleware.
8. **Shadowing Prevention.** Avoid naming components exactly after global JS types (e.g. `Number`, `Select`). Export them via the manifest but use descriptive internal names or aliases (e.g. `SlidingNumber`, `SelectRoot`) to satisfy linter constraints.
9. **HUD Layering.** Background widgets (metrics, charts) belong in the `WidgetLayer` between the background and windows, using separation transparency and minimal blur.
10. **Tiling Feedback.** Tiling drag-and-drop operations must provide a ghost preview (`TileZonePreview`) with spring-based entry/exit to indicate snap targets.
