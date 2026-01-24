# tui-opentui-audit

Purpose: reduce ALFRED’s bespoke terminal UI framework by adopting OpenTUI’s native React renderer + primitives for rendering, input, layout, scrolling, and rich widgets.

Owner: `packages/tui`

## Scope

- **ALFRED TUI (current)**: `packages/tui/src/tui/**` (custom “render `string[]` frames” engine).
- **OpenTUI React (target substrate)**: `vendor/opentui/packages/react/**` (React reconciler + component catalogue backed by OpenTUI core).

This report targets **ALFRED itself** (the CLI/TUI in `packages/tui`), not the apps ALFRED generates.

## Executive Summary (Recommendation)

ALFRED’s current TUI is a full custom UI framework: it hand-parses keyboard input, calculates layout, draws borders, styles with ANSI, and blits frames with `writeAt()` on a 30fps interval. OpenTUI React already provides these responsibilities natively (renderer lifecycle, key events, resize events, layout primitives, scrolling, diff/code widgets, and animation timelines).

**Recommendation**: refactor `packages/tui` to render the dashboard and modes using **OpenTUI React** (`createRoot(renderer).render(<App/>)`) and gradually migrate panels from “`string[]` renderers” to React components using OpenTUI primitives (`<box>`, `<scrollbox>`, `<input>`, `<select>`, `<diff>`, `<code>`). Keep ALFRED’s domain logic (stores/subscriptions/commands) but delete/replace the bespoke terminal UI substrate.

## Evidence: Current Architecture vs OpenTUI React

### ALFRED’s current rendering substrate (custom)

- **Frame loop + blitting**
  - `packages/tui/src/tui/views/dashboard.ts`: renders each panel as `string[]` and writes via `writeAt()` on ~30fps interval.
  - `packages/tui/src/tui/modes/base.ts`: mode loop renders `string[]` and clears screen each frame.
  - `packages/tui/src/tui/renderer.ts`: raw ANSI terminal ops, cursor control, alternate screen, and frame render helpers.
- **Layout**
  - `packages/tui/src/tui/layout/engine.ts`: custom flex/split-like layout engine producing `Rect`s.
- **Input**
  - `packages/tui/src/tui/input/keys.ts`: raw stdin parsing into a custom `KeyEvent`.
  - `packages/tui/src/tui/components/input.ts`: homegrown single-line input editing, history, cursor.
- **UI primitives**
  - `packages/tui/src/tui/panels/base.ts`: borders + truncation/padding implemented in-house using ANSI-aware string utilities.
  - `packages/tui/src/tui/typography.ts`: ANSI styling, visible-length computation, truncation with ANSI preservation.
  - `packages/tui/src/tui/views/focus.ts`: custom focus view + modal/confirm dialogs rendered with box-drawing strings.

### OpenTUI React substrate (native)

- **Renderer lifecycle**
  - `vendor/opentui/packages/react/src/reconciler/renderer.ts`: `createRoot(renderer)` attaches engine, provides `AppContext` (`renderer.keyInput`, renderer instance), and handles destroy cleanup.
- **Component primitives**
  - `vendor/opentui/packages/react/src/components/index.ts`: built-in component catalogue mapping JSX tags to OpenTUI core renderables (`<box>`, `<text>`, `<scrollbox>`, `<input>`, `<select>`, `<diff>`, `<code>`, `<line-number>`, etc.) + `extend()` for custom renderables.
- **Hooks**
  - `vendor/opentui/packages/react/src/hooks/use-keyboard.ts`: keypress subscription (including optional release events).
  - `vendor/opentui/packages/react/src/hooks/use-resize.ts` + `use-terminal-dimensions.ts`: resize subscription + dimension state.
  - `vendor/opentui/packages/react/src/hooks/use-timeline.ts`: animation timeline wired to OpenTUI `engine`.
- **Testing posture**
  - `vendor/opentui/packages/react/tests/**`: snapshot and regression tests for layout/scrolling/destroy correctness (useful patterns for ALFRED’s migration tests).

## Capability Matrix (ALFRED vs OpenTUI React)

| Capability                          | ALFRED (current)                                                                       | OpenTUI React (native)                                                                                              | Recommendation                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render loop**                     | `setInterval` 30fps + `writeAt()` blit (`views/dashboard.ts`, `modes/base.ts`)         | Engine-driven rendering via React reconciler (`reconciler/renderer.ts`)                                             | Replace interval loops with `createRoot(renderer).render(<App/>)` and rely on OpenTUI render scheduling + optional `Timeline` for animations.                         |
| **Terminal ops**                    | ANSI control codes + alternate screen (`tui/renderer.ts`)                              | Managed by OpenTUI core renderer                                                                                    | Stop doing manual cursor/clear logic; create one OpenTUI `CliRenderer` and render into it. Keep only necessary process-level lifecycle (e.g., MAX_TRANSITIONS guard). |
| **Layout**                          | Custom split/flex engine (`layout/engine.ts` + adaptive layout)                        | `<box>` layout props + absolute positioning; scrollboxes; flex-like behavior (documented + tested in OpenTUI tests) | Rebuild dashboard layout using nested `<box>` + percent/absolute widths; eliminate custom layout engine once parity achieved.                                         |
| **Borders + titles**                | Box-drawing strings (`typography.ts`, `panels/base.ts`, `views/focus.ts`)              | `<box border title borderStyle borderColor focusedBorderColor>`                                                     | Replace all hand-drawn borders with `<box>` props; remove ANSI truncation/padding hacks.                                                                              |
| **Text styling**                    | ANSI styling wrappers (`typography.ts`)                                                | `<text>` + child spans (`<span>`, `<strong>`, etc.) and style props                                                 | Move from string styling to renderable styling; keep semantic color palette values but apply via OpenTUI styles.                                                      |
| **Keyboard input**                  | Raw stdin parsing (`input/keys.ts`)                                                    | `renderer.keyInput` + `useKeyboard()` (`use-keyboard.ts`)                                                           | Replace custom key parser; migrate keybinding logic to `useKeyboard` callbacks.                                                                                       |
| **Resize**                          | `process.stdout.on("resize")` + ad-hoc recalculation                                   | `useOnResize()` / `useTerminalDimensions()`                                                                         | Replace manual resize wiring with OpenTUI hooks.                                                                                                                      |
| **Input text entry**                | Custom editable line (`components/input.ts`)                                           | `<input>` / `<textarea>` components                                                                                 | Replace custom input line editor and modal “buttons” with focusable OpenTUI inputs/selects.                                                                           |
| **Scrolling lists**                 | Manual “windowing” math in panels (e.g. selectedIndex + slice)                         | `<scrollbox>`                                                                                                       | Use `<scrollbox>` for tool calls, workflow lists, logs, chat history. Keep selection state logic if needed.                                                           |
| **Diff/code views**                 | Not native; would require custom string formatting                                     | `<diff>`, `<code>`, `<line-number>`                                                                                 | Use OpenTUI’s built-in diff/code widgets for PR/patch views in terminal modes.                                                                                        |
| **Animations (spinner, progress)**  | Manual spinner index (`panels/workflow/active.ts`)                                     | `useTimeline()` + engine timeline                                                                                   | Use `Timeline` for spinners and subtle animations; otherwise render deterministically from state.                                                                     |
| **Overlays/modals/command palette** | Custom overlay render (`views/dashboard.ts` palette), modal/confirm (`views/focus.ts`) | Compose as layered `<box>` trees + focusable `<input>`/`<select>`                                                   | Keep fuzzy search logic but render palette with OpenTUI components and focus.                                                                                         |
| **Headless / E2E**                  | Bun spawn harness reads stdout; supports `--headless` (`test/tui-e2e.test.ts`)         | OpenTUI has testing utilities and snapshots; renderer can be created in test mode                                   | Keep Bun spawn E2E for integration and add OpenTUI-style snapshot tests for layout parity of React components.                                                        |

## Redundant Custom Code (Deletion / Rewrite Candidates)

These are high-probability “delete or shrink drastically” candidates once OpenTUI React is the rendering substrate:

- **`packages/tui/src/tui/views/dashboard.ts`**: entire manual render loop, manual overlay drawing, and per-panel blitting.
- **`packages/tui/src/tui/panels/base.ts`**: border rendering + ANSI truncation/padding; replace with `<box>` composition.
- **`packages/tui/src/tui/layout/engine.ts`**: replace with `<box>` layout primitives; keep only “which panels are visible” policy, if needed.
- **`packages/tui/src/tui/input/keys.ts`**: replace with OpenTUI `KeyEvent` delivered via `renderer.keyInput` + `useKeyboard`.
- **`packages/tui/src/tui/components/input.ts`**: replace with `<input>`; keep only domain-level “submit command” semantics.
- **`packages/tui/src/tui/typography.ts`**: replace with OpenTUI styling rather than ANSI string-wrangling; keep `colors` palette in `theme.ts`.
- **`packages/tui/src/tui/views/focus.ts` modal/confirm**: replace with overlay `<box>` + `<select>` or two-button focusable controls; avoid manual box-drawing.

Code that should remain (domain logic, not UI substrate):

- **Stores/subscriptions**: `packages/tui/src/tui/subscriptions/**` (data acquisition).
- **Command semantics**: fuzzy search + actions in `packages/tui/src/tui/input/commands.ts` (logic can stay; rendering changes).
- **MAX_TRANSITIONS guard**: `packages/tui/src/tui/index.ts` control-flow safety.

## Refactor Plan (Phased, Low Risk)

### Phase 0 — Decide dependency strategy (1 decision, then commit)

ALFRED currently depends on published packages (`@opentui/core`, `@opentui/react`) but also vendors upstream as `vendor/opentui`.

Decision to make:

- **Preferred**: keep using published `@opentui/*` in runtime, use `vendor/opentui` only for audits/patch reference.
- Alternative: point `packages/tui` to vendored workspace sources (higher maintenance and risk of divergence).

### Phase 1 — Introduce OpenTUI React “shell” without changing domain logic

Goal: render a minimal dashboard shell with OpenTUI React while preserving stores and the existing E2E harness expectations.

- Create a new TUI entry path that:
  - creates `CliRenderer` with OpenTUI core
  - calls `createRoot(renderer).render(<DashboardApp stores=... />)`
  - installs keybindings for quit / mode switching using `useKeyboard()`
  - preserves `ALFRED_TUI_MAX_TRANSITIONS` behavior at the `TuiApp` controller layer
- Keep old dashboard/modes in place temporarily for rollback.

### Phase 2 — Migrate dashboard panels to React components (one-by-one)

For each panel class, replace `renderContent(): string[]` with a React component that reads the same underlying store, e.g.:

- `<WorkflowPanel />` uses nested `<text>` + progress bar boxes.
- `<ToolCallsPanel />` becomes `<scrollbox>` with selection highlight.

Migration discipline:

- Keep panel state machines (selection indices, view modes) but move rendering to OpenTUI components.
- Remove per-panel manual “windowing” code as soon as `<scrollbox>` is adopted.

### Phase 3 — Replace overlays and focused views

- **Command palette**: render with `<box title>` + `<input>` query + `<select>` for results.
- **Modal/confirm**: render with `<box>` + `<select>` or explicit focusable controls; stop using `views/focus.ts` drawing logic.
- **Focus mode**: can become “layout state” rather than a separate `FocusView` renderer.

### Phase 4 — Migrate modes (chat/debug/plan/help) to OpenTUI React

Replace mode base loop (`modes/base.ts`) with React trees, reusing:

- `<scrollbox stickyScroll stickyStart="bottom">` for chat history (OpenTUI tests show sticky scroll support).
- `<input>` for chat prompt.
- `<code>`/`<diff>` where applicable.

### Phase 5 — Delete obsolete substrate (after parity + tests)

Once dashboard + modes are fully React-rendered and tests pass, remove:

- custom render loop and terminal blitting
- custom key parsing
- custom layout engine
- ANSI styling/truncation/padding utilities

Do not delete in this phase without an explicit “delete approval” in the session; this is a plan item.

## Testing Strategy (Must-Have)

ALFRED already has a strong black-box harness:

- `packages/tui/test/tui-e2e.test.ts` spawns `bun packages/tui/src/bin/alfred.ts tui ... --headless` and asserts:
  - dashboard renders key sections
  - key inputs (`tab`, `q`, `esc`, Ctrl+D) trigger expected transitions
  - MAX_TRANSITIONS emits `tui_max_transitions` on stderr

Recommendations:

- **Keep existing spawn-based E2E tests** as the primary “parity gate” during the migration.
- Add **OpenTUI-style snapshot tests** for critical layouts:
  - render `<DashboardApp>` into a test renderer, capture char frame, snapshot.
  - use upstream patterns from `vendor/opentui/packages/react/tests/layout.test.tsx` (captures frames and snapshots).
- Add at least one new E2E test case:
  - “command palette opens, filters, executes a command” (currently bespoke overlay rendering is fragile and untested).

## Risks & Mitigations

- **Process lifecycle / teardown**: OpenTUI has known destroy/unmount interactions; upstream ships a regression test (`vendor/opentui/packages/react/tests/destroy-crash.test.tsx`). Mirror the pattern: always unmount React root (or rely on upstream cleanup) before calling `renderer.destroy()` and ensure background intervals are cleared.
- **TTY vs headless**: preserve `--headless` and `ALFRED_TUI_HEADLESS` semantics; ensure renderer creation works in CI-like environments (the existing E2E harness already enforces this).
- **Parity creep**: avoid re-implementing new UI features mid-migration. Phase gate by tests: only proceed when existing E2Es are green.

## Immediate Next Steps (Concrete)

1. Decide dependency strategy (published packages vs vendored sources).
2. Add a new OpenTUI React-driven dashboard shell that preserves:
   - quit (`q`)
   - focus navigation (`tab`)
   - help (`?` then `esc`)
   - mode switching (Ctrl+D, etc.)
   - MAX_TRANSITIONS guard behavior
3. Port one high-ROI panel first (recommend: tool calls list → `<scrollbox>`).
