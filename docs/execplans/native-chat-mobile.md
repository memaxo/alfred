# Native Mobile Chat (Expo) — Assistant + Orchestrator

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `.agent/PLANS.md`.

Owner: native

## Purpose / Big Picture

Deliver a production-grade chat UI inside **ALFRED’s native Expo app** (this plan targets **ALFRED itself**, not applications ALFRED generates). After this work:

- The tab route `apps/native/app/(drawer)/(tabs)/index.tsx` is a chat screen, not a placeholder.
- The user can switch between **Assistant** and **Orchestrator** and receive **streaming** responses from the matching backend endpoint.
- The user can use **voice input** and have the final transcript sent into chat exactly once per voice session.
- Messages render rich AI SDK v6 `UIMessage.parts`, including at minimum: `text`, `reasoning`, `tool-call`, and `tool-result`.
- The Jest test suite for native chat logic + components covers the key invariants (agent switching, voice transcript send, tool-result rendering).

## Progress

- [x] (2026-01-10) Audited current branch vs `main` baseline for native chat route.
- [x] (2026-01-10) Implement agent switching reset semantics via `useChat({ id: currentAgent })` in `apps/native/hooks/use-chat-logic.ts`.
- [x] (2026-01-10) Render `tool-call` + `tool-result` parts in `apps/native/components/chat/message-bubble.tsx`.
- [x] (2026-01-10) Ensure voice transcript → `sendMessage` fires once per voice cycle in `apps/native/hooks/use-chat-logic.ts`.
- [x] (2026-01-10) Fix chat “call” button routing to `/(drawer)/call` in `apps/native/components/chat/chat-input.tsx`.
- [x] (2026-01-10) Update/add Jest tests for agent switching, voice transcript sending, and tool-result rendering; make them pass (`cd apps/native && bun run test:unit`).

## Surprises & Discoveries

- Observation: On `main`, `apps/native/app/(drawer)/(tabs)/index.tsx` is still a placeholder “Tab One” screen; chat UI exists only on this branch.
  Evidence: `git show main:"apps/native/app/(drawer)/(tabs)/index.tsx"` shows placeholder content.

- Observation: AI SDK v6 `useChat` supports an `id` option that recreates the chat instance when the `id` changes; this is a clean way to ensure agent switching resets chat state without inventing custom state machines.
  Evidence: `node_modules/@ai-sdk/react/dist/index.mjs` uses `options.id` to decide `shouldRecreateChat`.

## Decision Log

- Decision: Agent switching will reset the chat transcript by recreating the AI SDK chat instance (via `useChat({ id })`), rather than mixing Assistant/Orchestrator messages in a single thread.
  Rationale: Prevents accidental cross-agent context leakage and matches “switch endpoint cleanly”. It is also trivial to reason about and test.
  Date/Author: 2026-01-10 (Codex)

## Outcomes & Retrospective

- Outcome: Native chat tab route is implemented and no longer a placeholder, with Assistant/Orchestrator switching, voice input integration, and rich part rendering.
  Date/Author: 2026-01-10 (Codex)

- Outcome: Jest coverage now locks the key invariants (agent switching resets chat, voice transcript sends once per cycle, tool-result renders).
  Date/Author: 2026-01-10 (Codex)

- Follow-up: Validate on a real device/simulator that voice status UX is acceptable during `connecting/processing/playing` states and adjust UI affordances if needed.
  Date/Author: 2026-01-10 (Codex)

## Context and Orientation

Key native files (Expo Router + React Native + NativeWind):

- Route entry: `apps/native/app/(drawer)/(tabs)/index.tsx` (chat screen UI + header actions).
- Chat logic: `apps/native/hooks/use-chat-logic.ts`
  - Uses AI SDK v6 `useChat` from `@ai-sdk/react`.
  - Uses `DefaultChatTransport` from `ai` to talk to `${EXPO_PUBLIC_SERVER_URL}/api/{assistant|orchestrator}`.
  - Forwards Better Auth cookies via `authClient.getCookie()` into a `Cookie` header.
  - Uses `useVoiceSessionNative` from `apps/native/lib/voice/session.ts`.
- UI components:
  - `apps/native/components/chat/chat-list.tsx` (FlatList auto-scroll)
  - `apps/native/components/chat/chat-input.tsx` (text send + voice toggle + “call” shortcut)
  - `apps/native/components/chat/message-bubble.tsx` (per-message renderer; currently missing `tool-result`)

Relevant server endpoints (TanStack Start server routes):

- Assistant stream handler: `apps/web/src/routes/api/assistant/$.ts`
- Orchestrator stream handler: `apps/web/src/routes/api/orchestrator/$.ts`

Both routes delegate to `apps/web/src/lib/api/stream-handler` which is responsible for AI SDK v6 streaming responses compatible with `DefaultChatTransport`.

## Plan of Work

1. Update `apps/native/hooks/use-chat-logic.ts` to:
   - Pass a stable `id` tied to the selected agent into `useChat` so switching agent recreates the chat instance.
   - Ensure “voice transcript → chat message” only fires once per voice session (key off `voice.stream.sessionId` when available).
2. Update `apps/native/components/chat/message-bubble.tsx` to render `tool-result` parts:
   - Show tool name, and a readable rendering of `output`.
   - If AI SDK supplies `isError` for tool results, render an error visual state.
3. Fix any routing gaps that prevent expected navigation (notably the “call” button routing).
4. Update Jest tests:
   - `apps/native/test-jest/hooks/use-chat-logic.test.tsx`: agent switching influences `useChat` options, and voice transcript triggers exactly one `sendMessage`.
   - `apps/native/test-jest/components/chat/message-bubble.test.tsx`: tool-result renders.
5. Run native tests in `apps/native` and keep this plan updated as work proceeds.

## Concrete Steps

All commands are run from the repository root unless otherwise specified.

1. Run native unit tests:

   cd apps/native
   bun run test:unit

2. (Optional) Run all native tests:

   cd apps/native
   bun run test

## Validation and Acceptance

Acceptance is satisfied when:

- The native tab route `apps/native/app/(drawer)/(tabs)/index.tsx` renders a working chat UI on-device/simulator.
- Switching between Assistant and Orchestrator clearly changes the backend endpoint and resets the chat transcript intentionally.
- Streaming responses appear incrementally (not only after completion) for both agents.
- Voice toggle produces a transcript that is sent as a single chat message exactly once per voice session.
- Messages render: `text`, `reasoning`, `tool-call`, `tool-result`.
- `cd apps/native && bun run test:unit` passes, and the added tests would fail on a version missing the new behavior.

## Idempotence and Recovery

- All steps are safe to re-run.
- If tests fail, fix the minimal unit under test (avoid unrelated refactors) and re-run `bun run test:unit`.

## Artifacts and Notes

- Primary UI entry: `apps/native/app/(drawer)/(tabs)/index.tsx`.
- Primary logic: `apps/native/hooks/use-chat-logic.ts`.
