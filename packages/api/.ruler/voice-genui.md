# Voice GenUI Integration

## Core Principle

Voice responses can carry structured GenUI payloads alongside TTS text. The `assistant_message.raw` field contains a validated `VoiceAssistantRaw` payload with UIMessages and workflow metadata, enabling UI deep-linking and component rendering from voice commands.

## Rules

1. **Canonical raw payload.** Voice assistant responses must emit `VoiceAssistantRaw` in `assistant_message.raw`: `{ uiMessages: UIMessage[]; meta?: { runId?: string; planId?: string; } }`. Never use ad-hoc structures.

2. **GenUI parts in UIMessages.** Workflow handlers emit `data-ui` parts with `{ type: "data-ui", data: { kind, ...props }, ui: { component, props } }`. The `ui.component` must match a manifest entry.

3. **Validate before forwarding.** Streaming servers (WebSocket and WebRTC) must validate `raw` with `parseVoiceAssistantRaw()` before forwarding. Invalid payloads log `voice_assistant_raw_invalid` and are dropped (text still sends).

4. **Text always present.** The `text` field is always synthesized to TTS. GenUI in `raw` is supplemental for visual surfaces—voice-only users get the spoken response.

5. **Workflow metadata propagation.** When a voice handler generates a workflow plan, embed `runId` and `planId` in `meta` so clients can link to the workflow window.

6. **Dual GenUI approach.** Workflow handlers emit both `workflow-timeline` and `plan` GenUI components. Timeline shows phase progress; plan shows the structured plan preview.

7. **Mode-aware payloads.** Use `VoiceWorkflowRawMode` (`awaiting_approval`, `executing`, `completed`, `failed`, `rejected`) to drive GenUI component props and UI state.

8. **Helper constructors.** Use `buildVoiceWorkflowRaw()` helper to construct valid payloads. Never hand-build `data-ui` parts inline—type assertions hide errors.

9. **Client-side parsing.** Clients parse `event.raw` via `parseVoiceAssistantRaw()` and expose `assistantRaw`, `uiMessages`, and `workflow` in hook state.

10. **Deep-link on runId.** When `meta.runId` is present and valid, web clients spawn/focus the workflow window with that runId. Use a ref to avoid re-triggering on the same runId.

11. **Native adaptation.** Native/CarPlay surfaces render a minimal "workflow card" instead of full GenUI. Parse the same contract; show runId and a deep-link button.

12. **Test at each layer.** Add Bun tests for the Zod schema, Playwright E2E for UI integration, and opt-in live-AI tests gated by `ALFRED_TEST_LIVE_AI=1`.
