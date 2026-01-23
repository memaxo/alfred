# ExecPlan: Sprint 5 - System Visibility & Application Deepening

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Owner: web, cognition

## Purpose / Big Picture

Transition from a functional foundation to a high-visibility, deep-featured desktop environment. This sprint focuses on the "Cognitive HUD" (visualizing the agent's internal state) and bringing core applications (Code, Terminal, Task Manager) to production maturity.

## Progress

- [x] (2026-01-12) ALF-VIZ-01: Implement Cognitive HUD and Physiology visualization [completed]
- [ ] (2026-01-12) ALF-CODE-01: Wire real-time AI suggestions (Codex) into Monaco Editor [pending]
- [ ] (2026-01-12) ALF-PANE-01: Implement missing Timers and Bookmarks windows [pending]
- [ ] (2026-01-12) ALF-OPS-01: Polish Task Manager with real metrics and trajectory viewing [pending]

## Surprises & Discoveries

- Discovery: The `cognitiveRouter.state` already contained physiology, but adding a dedicated `physiologyGet` procedure provided a cleaner, more focused API for the high-frequency polling HUD.

## Decision Log

- Decision: Integrated the "Brain Monitor" as a core tab in the Cortex app rather than just a sidebar panel.
  Rationale: The Cortex app is the natural home for deep internal state analysis, and this allows for a richer visualization (MetricGauges + Waveform).
  Date/Author: 2026-01-12 / Codex


## Outcomes & Retrospective

- (pending)

## Context and Orientation

Relevant files:
- `packages/api/src/routers/cognitive.ts`: Cognitive state API.
- `apps/web/src/components/desktop/menubar/`: System status area.
- `apps/web/src/components/apps/code/`: Monaco editor integration.
- `apps/web/src/components/apps/taskmanager/`: Process and performance monitor.

## Plan of Work

### Subtask 1: ALF-VIZ-01 - Cognitive HUD
1. Add `physiologyGet` to `packages/api/src/routers/cognitive.ts`.
2. Create `apps/web/src/hooks/use-cognitive-physiology.ts`.
3. Update `MenuBar` to replace static icons with dynamic physiological gauges (Energy, Frustration).
4. Create `apps/web/src/components/apps/cortex/` for the deep visualization app.

### Subtask 2: ALF-CODE-01 - Codex Integration
1. Implement `trpc.codex.suggest` query in the `CodeApp`.
2. Wire cursor position changes to trigger suggestions.
3. Show inline "ghost-text" or a dedicated suggestions panel.

### Subtask 3: ALF-PANE-01 - Missing Panes
1. Create `apps/web/src/components/apps/timers/index.tsx`.
2. Create `apps/web/src/components/apps/bookmarks/index.tsx`.
3. Register new window types in `windowRegistry`.

### Subtask 4: ALF-OPS-01 - Task Manager Polish
1. Wire `process-list.tsx` to real agent run data.
2. Add "View Trajectory" action that opens the ATIF log.
3. Implement real-time performance charts for memory/cpu.
