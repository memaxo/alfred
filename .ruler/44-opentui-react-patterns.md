# OpenTUI React Patterns

## Core Principle

OpenTUI React provides a React reconciler for terminal UIs. Migrate from custom `string[]` renderers to React components using OpenTUI primitives (`<box>`, `<scrollbox>`, `<text>`, `<input>`, `<select>`).

## Rules

1. **Text content prop.** Use `content` prop for `<text>` components, not children. Example: `<text content={dim("Loading...")} />` not `<text>{dim("Loading...")}</text>`.

2. **Layout props direct.** Components accept layout props (`x`, `y`, `width`, `height`) directly. No wrapper boxes needed. Example: `<box width={50} height={10} x={0} y={0} border title="Panel" />`.

3. **JSX type configuration.** Use `/** @jsxImportSource @opentui/react */` pragma at top of OpenTUI React component files. This tells TypeScript/Bun to use OpenTUI's JSX runtime for that file. Alternatively, create `opentui-jsx.d.ts` type declaration file and include it in tsconfig.json for global JSX augmentation.

4. **Keyboard handling.** Use `useKeyboard()` hook for keyboard events. Hook receives `KeyEvent` with `name`, `ctrl`, `shift`, `alt` properties. Example: `useKeyboard((event) => { if (event.name === "q") quit(); })`.

5. **Terminal dimensions.** Use `useTerminalDimensions()` hook for responsive layout. Returns `{ width, height }` that updates on resize.

6. **Scrollable content.** Wrap scrollable content in `<scrollbox>` component. Accepts `focused` prop for keyboard navigation. Children are `<text>` elements with `content` prop.

7. **Store integration.** Access existing stores via React hooks (`useCognitiveStore()`, `useWorkflowStore()`, etc.) from `hooks/stores.ts`. Subscribe in `useEffect` with cleanup.

8. **Panel positioning.** Panel components accept `x` and `y` props for absolute positioning within dashboard layout. Dashboard calculates positions and passes to panels.

9. **Feature flag.** Use `ALFRED_TUI_REACT=1` environment variable to switch between old renderer and React renderer. Enables incremental migration without breaking existing functionality.

10. **Renderer lifecycle.** Create renderer with `await createCliRenderer()`, create root with `createRoot(renderer)`, render with `root.render(<App />)`, start with `renderer.start()`. Cleanup with `root.unmount()` and `renderer.destroy()`.

11. **Component structure.** React components live in `packages/tui/src/tui/react/`. Panels in `react/panels/`, hooks in `react/hooks/`, dashboard in `react/dashboard.tsx`.

12. **Preserve domain logic.** Keep existing stores, subscriptions, and commands. Only replace rendering layer. Domain logic (`subscriptions/`, `stores/`) remains unchanged.

13. **Style prop pattern.** Use `style` prop for styling instead of individual props where appropriate. Example: `<box style={{ borderColor: "#FFFFFF", borderStyle: "single" }} />` instead of `<box borderColor="#FFFFFF" borderStyle="single" />`.

14. **Scrollbox focus.** Always add `focused` prop to `<scrollbox>` components for keyboard navigation. Example: `<scrollbox focused={focused}>`.

15. **Advanced hooks.** Use `useRenderer()` to access renderer instance, `useTimeline()` for animations, `useTerminalDimensions()` for responsive layout.
