# Native Voice

**Date:** October 30, 2025  
**Workstream:** L — Mobile/native + CarPlay voice

## Objective
- Deliver a voice-first native experience that matches the web drive mode while satisfying background streaming and CarPlay requirements.
- Build a shared voice core that reuses `@alfred/type/stream` events and the forthcoming `packages/voice` repo bridge so mobile, web, and future surfaces stay convergent.
- Ship documentation, API tickets, and UX specs that unblock phased implementation across Expo (iOS/Android) and CarPlay.

## Current State
- `apps/native` ships no audio capture, playback, or streaming primitives; authentication and tRPC wiring exist via `auth-client.ts` and `utils/trpc.ts`. 
- Web already prototypes `use-voice-capture.ts` and large-button controls under `apps/web/src/hooks` and `apps/web/src/components/drive-mode.tsx`, giving us interaction patterns and zero-allocation goals to mirror natively.

## Shared Core Strategy
- Introduce `packages/voice` to hold platform-neutral hooks (`useVoiceSession`), stream event mappers, and audio buffer transformers; depend only on `@alfred/type` and `@alfred/api` client facades to respect import direction.
- Define `voice` tRPC procedures (`voice.stream`, `voice.tts`, `voice.ttl`) once in `packages/api`, exposing a websocket transport that both web and native reuse; align naming with the single-word rule.
- Extend `apps/native` with a `voice` domain folder hosting Expo-specific adapters (capture, playback, permission prompts) that wrap shared core utilities.

## Expo Audio Strategy
- Enable background audio by adding the `audio` entry to `ios.infoPlist.UIBackgroundModes` in `app.json`, and call `Audio.setAudioModeAsync` with `allowsRecordingIOS`, `playsInSilentModeIOS`, and `staysActiveInBackground` so capture and playback survive screen lock. citeturn2search2turn2search4
- Require a managed Expo build (EAS) because background modes are unavailable inside Expo Go; document this in `docs/native/build.md` when created. citeturn2search2
- On Android we must register a foreground service (`foregroundServiceType: "microphone"`) with a persistent notification; otherwise Doze will terminate the recorder within minutes. citeturn2search0
- Guard all mode toggles with a single `configureAudioSession` helper that caches the active mode to avoid redundant allocations, following the Carmack zero-allocation rule highlighted in the web hook.

## Background Streaming
- Use `expo-task-manager` with `expo-background-fetch` to keep transcription and synthesis polling alive when users background the app, constrained to low-frequency refresh (≤15 minutes) while the foreground service handles live capture. citeturn12search0
- Maintain an always-on websocket for conversational turns; when the OS suspends the JS bridge, enqueue deltas in an on-device queue (AsyncStorage-backed) and flush on resume.
- Emit structured telemetry (`fast_capture_start`, `fast_stream_flush`) so `packages/metrics` can enforce the `<100 µs` transition and `<10 ms` fact extraction budgets defined in the cognitive architecture rules.

## CarPlay Integration
- Follow Apple’s CarPlay guidance: keep drivers focused on the road, lean on Siri, and restrict interactions to short taps or voice. citeturn6search1turn7search2
- Adopt the 2024 CarPlay frameworks (Now Playing, Communication, Trip, Instrument Cluster) and map Alfred voice flows onto templates that already support streaming metadata. citeturn8search0
- Prototype with `react-native-carplay` to expose templates, Siri intents, and navigation surfaces without leaving the Expo managed workflow; evaluate gaps (e.g., background audio handoff, SiriKit entitlement). citeturn10search0
- Treat CarPlay as a thin projection layer that subscribes to the shared voice core; avoid CarPlay-only business logic so policy enforcement and telemetry stay centralized.

## Safe Driving UX
- Mirror the web drive mode: single “Hold to Talk” control, large tap targets, high-contrast theme, and zero scrolling when the session is active.
- Default to voice prompts instead of on-screen text whenever CarPlay is connected; Siri-driven confirmations keep interactions hands-free. citeturn7search2
- Add an always-visible status banner (`thinking`, `responding`, `muted`) that maps to the cognitive state machine, satisfying the single-active-state rule and helping drivers anticipate system behavior.

## Phased Rollout
1. **Foundation (Week 1–2):** Ship `packages/voice` scaffolding, Expo audio session helper, permission flows, and local file persistence; land tRPC contract stubs with mocked audio payloads.
2. **Foreground Streaming (Week 3–4):** Integrate real STT/TTS streaming via `voice.stream`, wire background audio modes, and enforce telemetry budgets; add regression tests under `apps/native/__tests__/voice`.
3. **Background Resilience (Week 5–6):** Add foreground service notification, TaskManager tasks for resume, and retry logic; document fallback when OS terminates the process.
4. **CarPlay Beta (Week 7–9):** Integrate `react-native-carplay`, map templates, implement Siri intents, and capture UX feedback from supervised drives.
5. **Stabilization (Week 10+):** Harden error handling, expand metrics dashboards, and prepare App Store CarPlay entitlement submission.

## Validation & Follow-up
- Review this plan with product, safety, and legal stakeholders; log resulting work in Linear (one ticket per phase plus CarPlay entitlement tracking).
- After implementation, run ride-along tests capturing latency, reconnection rates, and biometric elevation compliance, then update `docs/alfred-prd.md` and `docs/native/voice.md` with outcomes.
