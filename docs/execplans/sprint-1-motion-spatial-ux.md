# ExecPlan: Sprint 1 - Motion Orchestration & Spatial UX

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Owner: web

## Purpose / Big Picture

Elevate the ALFRED desktop experience with physics-based motion and spatial awareness. This sprint focuses on window choreography (spawning/closing/transitions), focus gravity (attention management), and tiling polish (drag-and-drop fidelity).

## Progress

- [x] (2026-01-12) ALF-DESK-01: Orchestrate window transitions and spatial layout animations [completed]
- [x] (2026-01-12) ALF-DESK-02: Implement focus gravity and background dimming [completed]
- [x] (2026-01-12) ALF-DESK-03: Add drag-and-drop snap indicators and ghost previews [completed]

## Surprises & Discoveries

- (pending)

## Decision Log

- (pending)

## Outcomes & Retrospective

- (pending)

## Context and Orientation

Relevant files:
- `apps/web/src/components/desktop/layers/window-layer.tsx`: Main entry point for window rendering.
- `apps/web/src/components/desktop/windows/chrome.tsx`: Individual window wrapper handling drag/resize/focus.
- `apps/web/src/store/desktop/`: Desktop state management.

## Plan of Work

### Subtask 1: ALF-DESK-01 - Window Choreography
1. Wrap window list in `AnimatePresence` in `WindowLayer`.
2. Apply `initial`, `animate`, and `exit` props to `WindowChrome` or its internal wrapper.
3. Implement `layoutId` for smooth transitions between "Desktop" and "Mindscape" modes.

### Subtask 2: ALF-DESK-02 - Focus Gravity
1. Create `apps/web/src/hooks/use-focus-gravity.ts`.
2. Implement dimming/blur logic for windows that are not focused.
3. Update `WindowChrome` to apply these visual styles based on focus state.

### Subtask 3: ALF-DESK-03 - Tiling Polish
1. Enhance `TileZonePreview` with smoother transitions.
2. Implement snap-to-grid visual indicators during window movement.
