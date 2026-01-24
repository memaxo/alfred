# ExecPlan: Sprint 4 - App-Specific Polish

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Owner: web

## Purpose / Big Picture

Finalize the user-facing application logic by replacing mock data with real backend integrations and creating a guided first-run experience. This sprint focuses on real policy management, metrics pinning (widgets), and onboarding orchestration.

## Progress

- [x] (2026-01-12) ALF-APP-01: Connect Settings app to real policy backend [completed]
- [x] (2026-01-12) ALF-APP-02: Enable desktop widget pinning for metrics [completed]
- [x] (2026-01-12) ALF-APP-03: Orchestrate first-run onboarding flow [completed]

## Surprises & Discoveries

- (pending)

## Decision Log

- (pending)

## Outcomes & Retrospective

- (pending)

## Context and Orientation

Relevant files:

- `apps/web/src/components/apps/settings/policy-section.tsx`: Policy management UI.
- `apps/web/src/components/apps/metrics/dashboard-builder.tsx`: Metrics management.
- `apps/web/src/components/onboarding/`: Onboarding step components.
- `apps/web/src/store/desktop/`: Desktop state for widget pinning.

## Plan of Work

### Subtask 1: ALF-APP-01 - Real Policy Data

1. Replace `mockPreferences` in `PolicySection` with `trpc.policy.list.useQuery`.
2. Implement mutation for updating policy levels via `trpc.policy.update`.
3. Add loading and error states to the policy list.

### Subtask 2: ALF-APP-02 - Metrics Pinning

1. Add `pinnedWidgets` to `DesktopState` in `apps/web/src/store/desktop/types.new.ts`.
2. Implement `pinWidget` and `unpinWidget` actions in desktop store.
3. Update `DashboardBuilder` to provide a "Pin to Desktop" action for each chart.
4. Create `WidgetLayer` in `apps/web/src/components/desktop/shell.tsx` to render pinned charts.

### Subtask 3: ALF-APP-03 - Onboarding Orchestration

1. Implement `OnboardingOverlay` to guide the user through steps.
2. Store onboarding completion status in `DesktopState`.
3. Wire "Finish" buttons in onboarding steps to advance and eventually close the overlay.
