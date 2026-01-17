# OpenTUI React Patterns

## Core Principle

OpenTUI React provides a React reconciler for terminal UIs. Migrate from custom `string[]` renderers to React components using OpenTUI primitives (`<box>`, `<scrollbox>`, `<text>`, `<input>`, `<select>`).

## Rules

1. **Text content prop.** Use the `content` prop for `<text>`, not children.

2. **Layout props direct.** Pass `x/y/width/height` directly to components; don’t add wrapper boxes just for layout.

3. **JSX runtime.** Use `/** @jsxImportSource @opentui/react */` in OpenTUI React component files (or a repo-wide JSX augmentation).

4. **Keyboard handling.** Use `useKeyboard()` for keyboard events.

5. **Terminal dimensions.** Use `useTerminalDimensions()` hook for responsive layout. Returns `{ width, height }` that updates on resize.

6. **Scrollable content.** Wrap scrollable content in `<scrollbox>` component. Accepts `focused` prop for keyboard navigation. Children are `<text>` elements with `content` prop.

7. **Store integration.** Access existing stores via React hooks (`useCognitiveStore()`, `useWorkflowStore()`, etc.) from `hooks/stores.ts`. Subscribe in `useEffect` with cleanup.

8. **Panel positioning.** Panel components accept `x` and `y` props for absolute positioning within dashboard layout. Dashboard calculates positions and passes to panels.

9. **Feature flag.** Use `ALFRED_TUI_REACT=1` environment variable to switch between old renderer and React renderer. Enables incremental migration without breaking existing functionality.

10. **Renderer lifecycle.** Create renderer with `await createCliRenderer()`, create root with `createRoot(renderer)`, render with `root.render(<App />)`, start with `renderer.start()`. Cleanup with `root.unmount()` and `renderer.destroy()`.

11. **Component structure.** React components live in `packages/tui/src/tui/react/`. Panels in `react/panels/`, hooks in `react/hooks/`, dashboard in `react/dashboard.tsx`.

12. **Preserve domain logic.** Keep existing stores, subscriptions, and commands. Only replace rendering layer. Domain logic (`subscriptions/`, `stores/`) remains unchanged.

13. **Style prop pattern.** Prefer the `style` prop for styling when it improves readability.

14. **Scrollbox focus.** Always pass `focused` to `<scrollbox>` for keyboard navigation.

15. **Advanced hooks.** Use `useRenderer()` to access renderer instance, `useTimeline()` for animations, `useTerminalDimensions()` for responsive layout.
