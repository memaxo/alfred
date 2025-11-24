# Cognitive Testing Playbook

This guide explains how to validate the cognitive pipeline end-to-end, from backend APIs to UI affordances, using the new feedback instrumentation.

## Quick Smoke Scripts

These commands run entirely in the repo root and require no external services.

- `bun scripts/verify-cognitive-pipeline.ts`
  - Drives `runCognitiveLoop` with mocked AI output, posts synthetic feedback, and confirms state transitions.
- `OPENAI_API_KEY=dummy DATABASE_URL=sqlite::memory: BUN_TEST=1 bun scripts/verify-cognitive-health.ts`
  - Replays a loop, increments the feedback metric, and asserts that Prometheus output includes `cognitive_physiology_gauge`, `cognitive_entropy_events_total`, and `cognitive_feedback_submissions_total`.

Both scripts exit non-zero on failure so they can gate CI.

## UI Affordances

Each surface exposes thumbs up/down controls wired to `cognitive.feedback`.

- **Chat Container**: Hover any assistant message to reveal the controls. Clicking opens the feedback dialog prefilled with the assistant response.
- **Mindscape Detail Panel**: Focus a runtime node to show buttons in the inspector; the workflow drawer header exposes the same controls for active runs.
- **Voice Admin Console** (`/admin/voice`): The “Recent voice sessions” panel lists transcripts with inline reactions. Submissions mark the chip with “Marked accurate” or “Needs revision”.

## Automated Coverage

- **Unit/Integration**: `bun test apps/web/src/components/__tests__/chat-container.test.tsx` and `bun test apps/web/src/hooks/__tests__/use-cognitive-feedback.test.tsx` keep the chat affordance + hook stable.
- **Mindscape Playwright**: `npx playwright test apps/web/tests/mindscape.workflow-drawer.e2e.spec.ts` intercepts `/api/trpc/cognitive.feedback` to ensure the drawer invokes the API (requires the dev server so `/login` resolves).
- **Voice Route Test**: `bun test apps/web/src/tests/routes/admin.voice-route.test.tsx` mocks tRPC + fetch to assert the recent-session controls fire fetch requests.

## Manual Acceptance

When testing manually:

1. Start the web app (`bun dev` or Turbo pipeline) and log in.
2. Chat with Alfred, then use the thumbs up/down controls and confirm the toast.
3. Open Mindscape, select a runtime node, submit feedback, and verify the badge shows the timestamp.
4. Visit `/admin/voice`, inspect the “Recent voice sessions” panel, and submit a reaction. Confirm the toast and that the UI disables the buttons briefly.

Record issues (API errors, missing toasts, metric gaps) against the corresponding milestone in `docs/execplans/cognitive-feedback-ui.md`.
