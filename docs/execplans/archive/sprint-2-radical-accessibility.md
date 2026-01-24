# ExecPlan: Sprint 2 - Radical Accessibility (a11y)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Owner: web

## Purpose / Big Picture

Ensure the ALFRED interface is usable by everyone, respecting system preferences and providing first-class keyboard-driven workflows. This sprint focuses on comprehensive keyboard navigation, dynamic ARIA labels, and reduced motion support.

## Progress

- [x] (2026-01-12) ALF-A11Y-01: Implement comprehensive desktop keyboard navigation [completed]
- [x] (2026-01-12) ALF-A11Y-02: Audit and fix ARIA labels across manifest components [completed]
- [x] (2026-01-12) ALF-A11Y-03: Implement reduced motion support system-wide [completed]

## Surprises & Discoveries

- (pending)

## Decision Log

- (pending)

## Outcomes & Retrospective

- (pending)

## Context and Orientation

Relevant files:

- `apps/web/src/components/desktop/shell.tsx`: Main desktop layout and keyboard manager.
- `apps/web/src/components/manifest.ts`: Component metadata.
- `apps/web/src/components/ui/`: Primitive UI components.

## Plan of Work

### Subtask 1: ALF-A11Y-01 - Keyboard Navigation

1. Add global keyboard event listeners to `DesktopShell` for window switching (⌘Tab) and tiling control.
2. Implement focus trapping for modal windows in `WindowChrome`.
3. Ensure all interactive elements have visible focus states.

### Subtask 2: ALF-A11Y-02 - Screen Reader & Label Audit

1. Audit manifest components for missing or static ARIA labels.
2. Update `ComponentDemo` to showcase dynamic labels.
3. Integrate `axe-core` into the test suite if possible.

### Subtask 3: ALF-A11Y-03 - Reduced Motion

1. Verify `useReducedMotion` usage across all animated components.
2. Update window transitions to bypass spring physics when preferred.
