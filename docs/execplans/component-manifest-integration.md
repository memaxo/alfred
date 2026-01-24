# component-manifest-integration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

Owner: web

## Purpose / Big Picture

After this work, every UI component declared in `apps/web/src/components/manifest.ts` is (1) fully implemented, (2) reachable via a TanStack Start route inside the webapp, and (3) reachable via the Desktop-Inspired “window” app system (so the Desktop can demonstrate and use every component, not just a subset).

This matters because the component manifest is already treated as “source of truth” for what ALFRED’s UI building blocks are, but today there are still gaps between what the manifest declares and what the app actually renders. Finishing and wiring everything makes the manifest trustworthy, makes UI regressions visible immediately, and provides a single place (route + desktop window) where every component can be inspected in a real running system.

## Progress

- (2026-01-12) Baseline audit tooling exists: `apps/web/scripts/audit.ts` and `apps/web/src/components/__tests__/manifest.test.ts` run cleanly.
- (2026-01-12) Define “integrated” contract for this plan (completed: definition draft; remaining: encode in tests and manifest statuses).
- (2026-01-12) Implement missing components (completed: 10/10).
- (2026-01-12) Add router wiring for component demos (completed: list route + detail route).
- (2026-01-12) Add Desktop app wiring for component demos (completed: new window type + registry entry + default icon + command palette entry).
- (2026-01-12) Wire each component into at least one real app flow (completed: all components have verified usage sites).
- (2026-01-12) Update/extend tests so failures are obvious (completed: demo coverage check + root wrapper check + integrated contract enforcement).

## Surprises & Discoveries

- Observation: The repo contains two window type unions (`apps/web/src/store/desktop/types.ts` and `apps/web/src/store/desktop/types.new.ts`) that are both referenced from active code paths, so adding a new desktop window type must update both unless/until we consolidate.
  Evidence: `apps/web/src/components/windows/shared/window-frame.tsx` imports from `types.new`, while `apps/web/src/components/desktop/windows/registry.tsx` imports from `types`.
- Observation: Some “manifest components” are implemented under `apps/web/src/components/ai-elements/*` (AI SDK Elements) and others under `apps/web/src/components/*` or `apps/web/src/components/ui/*`, so the plan needs a consistent rule for “where is the canonical implementation”.
  Evidence: `tool` is implemented as `apps/web/src/components/ai-elements/tool.tsx`, while `code` is `apps/web/src/components/code.tsx`.
- Discovery: Several components were missing root wrappers in `apps/web/src/components/`, causing inconsistent import paths in manifest usage proofs. Created wrappers for `tool`, `matrix`, `wave`, `msg`, `chat`, and `chatbar`.

## Decision Log

- Decision: For this plan, “integrated” means “implemented + reachable via router demo + reachable via Desktop window demo”.
  Rationale: “Implemented” alone is not enough to prevent drift; wiring makes the component observable and verifiable in production UI.
  Date/Author: 2026-01-12 / Codex
- Decision: Add a dedicated Desktop window (“Components”) as the hard guarantee that _every_ manifest component is wired into the Desktop-Inspired UI system, even if we later also adopt them into more specialized apps.
  Rationale: This removes ambiguity and prevents future regressions where a component silently becomes unused.
  Date/Author: 2026-01-12 / Codex
- Decision: Enforce root wrappers for all manifest components.
  Rationale: Simplifies the manifest usage tracking and provides a predictable entry point for consumers.
  Date/Author: 2026-01-12 / Codex

## Outcomes & Retrospective

- All 50 manifest components are now fully integrated and verified.
- The manifest test suite now serves as a CI gate for UI completeness.
- The Desktop "Components" app provides a live gallery for design system inspection.
- Fixed inconsistent import paths by enforcing root wrappers for all components.
- Added command palette support for the Components gallery (Shortcut: `K`).

## Context and Orientation

This plan applies to the **ALFRED webapp** under `apps/web/` (not to generated apps).

Key terms used in this plan:

- Component manifest: the registry and status list in `apps/web/src/components/manifest.ts` that defines the set of UI components ALFRED expects to exist.
- Router (in this plan): TanStack Start file routes under `apps/web/src/routes/` (not tRPC routers under `packages/api`).
- Desktop-Inspired UI app system: the “windowed” desktop shell rendered by `apps/web/src/routes/_protected/index.tsx` via `apps/web/src/components/desktop/shell.tsx`, where windows are created by the desktop store and rendered through `apps/web/src/components/desktop/windows/registry.tsx`.

Relevant files and their roles:

- `apps/web/src/components/manifest.ts`: componentRegistry + componentStatus. This is what we must make accurate and complete.
- `apps/web/src/components/__tests__/manifest.test.ts`: asserts manifest structure and that certain “installed/integrated” components have expected files.
- `apps/web/scripts/audit.ts`: produces a JSON report of (status counts, file existence, “used in code” heuristics, and gaps).
- `apps/web/src/components/chat-render.tsx`: renders AI SDK v6 message parts and already imports some manifest components (e.g. `Code`, `Plan`, `Task`, `Think`, `Cite`).
- `apps/web/src/components/desktop/layers/window-layer.tsx`: renders windows using `windowRegistry`.
- `apps/web/src/components/desktop/windows/registry.tsx`: the window registry mapping `WindowType` to window component + metadata; this is where we will register the new “Components” window.
- `apps/web/src/store/desktop/icons.ts`: default desktop icons; we will add a “Components” icon here so it is visible in the default desktop.

Current state (baseline before implementation):

- The manifest currently lists 50 components in `componentRegistry`.
- There are still 10 `pending` components that lack local implementations: `number`, `chart`, `grid`, `dock`, `term`, `date`, `daterange`, `choice`, `autocomplete`, `profile`.
- There are 18 `installed` components that exist locally but are not yet wired to a defined route/window demo contract.

## Plan of Work

### Milestone 1 — Lock the “integrated” definition into code and tests

At the end of this milestone, there is a single, mechanical definition of “integrated” that cannot drift silently:

- A component can only be marked `integrated` if:
  - A local implementation exists (wrapper and/or UI file as defined below),
  - It has a demo entry in the router demo system,
  - It has a demo entry in the Desktop Components window.

To accomplish this:

1. In `apps/web/src/components/manifest.ts`, document the contract near the `componentStatus` type comment.
2. Extend `apps/web/src/components/__tests__/manifest.test.ts` to assert:

- zero `pending` components,
- zero `installed` components,
- and that every component has a “demo configuration” entry (see Milestone 3/4) so that “integrated” is not a social contract.

3. Decide and document the canonical file layout for a component:

- Wrapper: `apps/web/src/components/<name>.tsx` (single-word filename; existing camelCase names use kebab-case file names where they already do, e.g. `voice-btn.tsx`).
- UI primitive implementation (when non-trivial): `apps/web/src/components/ui/<name>.tsx`.
- AI SDK Elements exceptions: if the canonical implementation lives under `apps/web/src/components/ai-elements/<name>.tsx`, create a thin wrapper at `apps/web/src/components/<name>.tsx` that re-exports it so the manifest always has a predictable import path.

Acceptance for Milestone 1:

- Running `cd apps/web && bun test src/components/__tests__/manifest.test.ts` passes.
- The manifest test suite now fails if any component is left `pending`/`installed` at the end of the project.

### Milestone 2 — Implement the 10 remaining `pending` components

At the end of this milestone, the following components exist as real, typed React components, and are usable without throwing at runtime:

- `number`: a “sliding number” display; implement using `motion` (already in deps) with a pure render API.
- `chart`: an animated chart; implement using `recharts` or `@tremor/react` (both already in deps) with a minimal, stable prop interface.
- `grid`: a bento grid layout; implement as a reusable layout primitive (cards + grid areas) consistent with the Mindscape aesthetic.
- `dock`: a dock-like launcher bar; implement as a small UI primitive and then reuse it in the Desktop taskbar/app-launcher to avoid duplication.
- `term`: a terminal-style block; implement as a presentation component that can render logs or code (not the full xterm instance).
- `date`: a date picker; implement as a wrapper around `apps/web/src/components/ui/date-time-picker.tsx` with `showTime={false}` by default.
- `daterange`: a date range picker; implement as a small composed component (two `date` pickers + validation) unless a local primitive already exists.
- `choice`: a choice box; implement as a radio-group wrapper using the existing Radix deps.
- `autocomplete`: a typeahead select; implement using the existing `apps/web/src/components/ui/command.tsx` pattern (similar to `voice-picker.tsx`).
- `profile`: a profile dropdown; implement by factoring the existing `apps/web/src/components/user-menu.tsx` patterns into a `profile` component, then use it in the Desktop menu bar.

Implementation approach:

- Prefer reuse of existing primitives under `apps/web/src/components/ui/*` rather than importing a new dependency.
- Keep every render function pure; move side effects into hooks only when needed (e.g. measuring layout).
- Ensure each component has a small “empty state” behavior so the demo page can render with no backend.

Acceptance for Milestone 2:

- `componentStatus` has no `pending` entries.
- Each of these components has at least one deterministic demo instance (props and example data) that can render in tests.

### Milestone 3 — Router wiring: component demo routes

At the end of this milestone, every component is reachable via a route in the running webapp (for quick inspection without the Desktop shell).

Implementation:

- Add a new route group under `apps/web/src/routes/_protected/components/`.
  - `apps/web/src/routes/_protected/components/index.tsx`: lists all components, grouped by phase/source, shows status, and links to detail pages.
  - `apps/web/src/routes/_protected/components/$name.tsx`: renders a single component demo by name, and shows:
    - its manifest `source` URL,
    - its status,
    - its live demo,
    - and any “integration notes” (e.g., “used in Chat window”, “used in Metrics window”).

Design constraints:

- The routes must derive their list from `componentRegistry` so they never drift.
- If a component demo config is missing, the route should render an explicit error panel listing what to add; it must not silently render blank.

Acceptance for Milestone 3:

- `cd apps/web && bun run dev` and navigating to `/_protected/components` shows the list.
- Navigating to `/_protected/components/connect` (and any other name) renders a demo without runtime errors.

### Milestone 4 — Desktop wiring: “Components” window app

At the end of this milestone, the Desktop shell can spawn a dedicated window that showcases every component, and the Desktop has a default icon for it.

Implementation steps:

1. Add a new Desktop window type `"components"`:

- Update both `apps/web/src/store/desktop/types.ts` and `apps/web/src/store/desktop/types.new.ts` to include `"components"` in `WindowType`.

2. Add a new desktop “app” module:

- Create `apps/web/src/components/apps/components/` with:
  - `index.tsx` exporting `ComponentsApp` and `ComponentsAppWindow` (matching the pattern used by other apps in `apps/web/src/components/apps/*`).
- Add exports in `apps/web/src/components/apps/index.ts`.

3. Register the window in `apps/web/src/components/desktop/windows/registry.tsx`:

- Add an entry for `"components"` with reasonable defaults (size, tier, singleton).

4. Add a default desktop icon in `apps/web/src/store/desktop/icons.ts`:

- Add `{ id: "icon-components", type: "components", position: … }`.

5. Ensure command palette can spawn it:

- Confirm the command palette lists spawnable window types via the registry and add a label/icon if needed.

Acceptance for Milestone 4:

- In the Desktop UI (`apps/web/src/routes/_protected/index.tsx`), the default icon set includes “Components”.
- Clicking it opens a window listing all manifest components and rendering demos for each (or a searchable list + detail pane).

### Milestone 5 — Wire every component into at least one real Desktop app flow

The Components window and demo routes guarantee reachability, but this milestone makes components genuinely part of ALFRED’s day-to-day UI.

For each component, pick at least one “real” integration point and replace ad-hoc UI with the manifest component. Examples (initial mapping; refine during implementation):

- Chat pipeline: `connect`, `controls`, `actions`, `think`, `plan`, `task`, `tool`, `cite`, `code`, `load` must all be used within `ChatAppWindow` and/or `chat-render.tsx`.
- Context surface: `ctx` should be used in Chat (context lens panel) or Agents (session metadata) to prevent it being a dead component.
- Workflow/canvas surfaces: `canvas`, `node`, `edge`, `panel`, `toolbar`, `artifact` should be used in Workflow/Agents/Codex apps where the concepts actually exist.
- Loading/animation: `loading`, `list` should be used in at least one real long-running UI (e.g. task manager fetching, workflow run loading).
- Metrics: `number`, `chart`, `matrix` should be used in Metrics/Learning/Task Manager apps so we stop maintaining parallel visualization components.
- Forms: `text`, `select`, `checkbox`, `dropdown`, `autocomplete`, `choice`, `date`, `daterange`, `profile` should be used in Settings/Onboarding/Reminders/Task creation surfaces.
- Desktop UI: `dock` should be used by the desktop launcher/taskbar layer so we do not have two competing dock implementations.

Acceptance for Milestone 5:

- Grep-based sanity checks show each component is imported by at least one non-demo module (i.e., not only the Components window/route).
- The Components window notes show “Used in: …” for each component (derived from a hand-maintained map checked into code, not from a heuristic).

## Concrete Steps

All commands in this plan are run from the repo root unless stated otherwise.

Baseline commands (already available today):

cd apps/web
bun test src/components/**tests**/manifest.test.ts
bun run audit:components

During implementation, after each milestone:

cd apps/web
bun run typecheck
bun test

To manually verify the Desktop wiring:

cd apps/web
bun run dev
Open [http://localhost:3001/](http://localhost:3001/) (authenticated session required)
Click the “Components” desktop icon and verify the window renders.

## Validation and Acceptance

This plan is complete only when all of the following are true:

1. `apps/web/src/components/manifest.ts` lists 0 `pending` and 0 `installed` statuses; every component is `integrated` by the contract in this plan.
2. Every component is reachable via a protected route under `apps/web/src/routes/_protected/components/`.
3. Every component is reachable in the Desktop shell via the “Components” window type and default icon.
4. `cd apps/web && bun test` passes, and includes at least one test that would fail if a component is missing from the router demo config or Desktop Components window config.

## Idempotence and Recovery

- All steps are additive and can be repeated safely.
- If adding the `"components"` window type causes type mismatches, update both `apps/web/src/store/desktop/types.ts` and `apps/web/src/store/desktop/types.new.ts` together first, then fix imports to point to a single canonical source as a follow-up (do not leave the app in a split-brain state).

## Artifacts and Notes

When implementing this plan, keep a running “component wiring map” checked into code (not only in docs). The simplest form is a `Record<ComponentName, { routes: string[]; windows: string[]; usedIn: string[] }>` in a single file under `apps/web/src/components/`, imported by both the router demo pages and the Desktop Components app.

## Interfaces and Dependencies

The plan should use existing dependencies already present in `apps/web/package.json`:

- UI: `react`, `@radix-ui/*`, `cmdk`, `lucide-react`, `motion`, `recharts`, `@tremor/react`.
- No new component library should be added unless a missing component cannot be implemented cleanly with existing deps.

The plan must keep TypeScript strict mode happy, and keep component render paths pure unless a hook is explicitly required (e.g., for measuring layout or managing controlled inputs).
