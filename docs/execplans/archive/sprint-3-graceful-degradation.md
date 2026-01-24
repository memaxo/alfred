# ExecPlan: Sprint 3 - Graceful Degradation & Resilience

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Owner: web

## Purpose / Big Picture

Ensure ALFRED remains functional and responsive under adverse conditions, such as network outages or service failures. This sprint focuses on degraded state UI, local-first optimistic updates, and strict storage budget management.

## Progress

- [x] (2026-01-12) ALF-CORE-01: Implement offline mode and degraded state UI [completed]
- [x] (2026-01-12) ALF-CORE-02: Add optimistic UI updates for Tier 4 apps [completed]
- [x] (2026-01-12) ALF-CORE-03: Implement storage budget monitoring and pruning [completed]

## Surprises & Discoveries

- (pending)

## Decision Log

- (pending)

## Outcomes & Retrospective

- (pending)

## Context and Orientation

Relevant files:

- `apps/web/src/components/connect.tsx`: Connection status indicator.
- `apps/web/src/collections/`: Data collections for Tier 4 apps.
- `apps/web/src/store/desktop/persist.ts`: Layout persistence logic.

## Plan of Work

### Subtask 1: ALF-CORE-01 - Connectivity States

1. Update `Connect` component to include `degraded` and `offline` statuses.
2. Add global network state listener to trigger these states.
3. Enhance `MenuBar` or `Taskbar` with a persistent connectivity warning when offline.

### Subtask 2: ALF-CORE-02 - Optimistic UI

1. Implement `useOptimistic` (or TanStack Query `onMutate` patterns) for Notes, Reminders, and Todos.
2. Ensure data is written to local collections immediately before network confirmation.

### Subtask 3: ALF-CORE-03 - Storage Budget

1. Implement `calculateStorageSize` helper in `persist.ts`.
2. Add a check during persistence to warn or prune if size exceeds 50KB.
3. Implement basic pruning strategy (e.g., clear old context caches).
