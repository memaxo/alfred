# TUI (Terminal User Interface) Patterns

**Note**: This file documents legacy `BasePanel` patterns. New panels should use OpenTUI React components (see `.ruler/44-opentui-react-patterns.md`). This file remains for reference during migration.

## Core Principle

Terminal interfaces must be fast, keyboard-driven, and follow consistent panel/layout patterns. Legacy panels extend `BasePanel` and implement lifecycle hooks. New panels use OpenTUI React components.

## Rules

1. **BasePanel inheritance.** All panels extend `BasePanel` and implement `id`, `label`, `render()`, and `subscribe()` methods.

2. **Panel organization.** Domain panels live in `panels/<domain>/` with index file as main entry and sub-components in separate files (e.g., `panels/cognitive/phase.ts`, `panels/cognitive/autonomy.ts`).

3. **Explicit exports.** Use explicit named exports in panel index files to avoid symbol conflicts between domains. Never use `export *` for domain panels.

4. **Mock data first.** Panels must work with mock data before API integration. Create `createMock*()` functions for each store type.

5. **Subscription lifecycle.** Use `SubscriptionManager` from `subscriptions/manager.ts` to handle tRPC subscription cleanup. Always call cleanup in panel `subscribe()` return value.

6. **Store pattern.** Each domain gets a store file in `subscriptions/<domain>.ts` with `create<Domain>Store()` and `setup<Domain>Subscription()` functions.

7. **Typography imports.** Only import typography functions that exist (`bold`, `dim`, `fg`, `bg`, `truncate`, `padLeft`, `padRight`, `center`, `progressBar`, `sparkline`). Don't assume others exist.

8. **Unused parameters.** Prefix unused function parameters with `_` (e.g., `_width`, `_height`) to pass TypeScript strict mode.

9. **Theme consistency.** Use colors from `theme.ts` only. Dark theme palette is canonical: `bg: #0A0E14`, `text: #E6E6E6`, `primary: #39BAE6`, etc.

10. **Keyboard navigation.** Implement standard keybindings: `q` quit, `ESC` back/cancel, `Tab` next, `Shift+Tab` previous, `Enter` confirm, `?` help, `/` search, `:` command.

11. **Panel lifecycle.** Call `init()` before first render, `subscribe()` returns cleanup function, `onResize()` updates bounds, `onFocus()`/`onBlur()` for state changes.

12. **Layout modes.** Support adaptive layout: single focus (<80 cols), split (80-120 cols), dashboard (>120 cols). Use `layout/adaptive.ts` for detection.

13. **Render performance.** Panels should render in <16ms (60fps). Cache expensive computations. Use sparklines for trends, not full charts.

14. **Error states.** Panels must handle null/undefined state gracefully. Show empty state message, don't crash.

15. **API endpoints.** TUI-specific endpoints go in existing routers (e.g., `cognitive.state`, `knowledge.stats`). Don't create new routers for TUI.
