# Native Voice

**Date:** October 30, 2025  
**Workstream:** L — Mobile/native + CarPlay voice

## Objective
- Deliver a voice-first native experience that matches the web drive mode while satisfying background streaming and CarPlay requirements.
- Build a shared voice core that reuses `@alfred/type/stream` events and the forthcoming `packages/voice` repo bridge so mobile, web, and future surfaces stay convergent.
- Ship documentation, API tickets, and UX specs that unblock phased implementation across Expo (iOS/Android) and CarPlay.

## Current State

- 📘 Reference guides (must-read):
  - `docs/voice/s2s.md` – one-stop setup for local/Supertonic providers plus web/native/CarPlay validation steps.
  - `docs/voice/streaming.md` – WebSocket prototype contract for partial transcripts / future streaming.
  - `docs/reference/api/voice.md` – backend mutation contract, curl sample, and test/observability references.

- ✅ `apps/native` implements audio capture (`ExpoCapture`), playback (`playBase64`), and streaming primitives via `@alfred/voice` shared core
- ✅ Authentication and tRPC wiring exist via `auth-client.ts` and `utils/trpc.ts`
- ✅ Voice session management via `useVoiceSessionNative` hook wrapping `@alfred/voice/session`
- ✅ Background queue system with AsyncStorage persistence and retry logic
- ✅ Background task registration for queue draining (2-minute interval)
- ✅ Foreground service support for Android (`ensureForegroundService`)
- ✅ Drive mode screen with "Hold to Talk" interface
- ✅ Local voice models support (Faster-Whisper + Maya1 TTS) via `VOICE_PROVIDER=maya1`
- ✅ Full bidirectional streaming (WebSocket; STT partials + assistant + TTS back)
- ⏳ CarPlay integration (plugin exists but disabled)

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

## Implementation Status

### Completed (Phase 1-2)
- ✅ `packages/voice` shared core with platform adapters
- ✅ Expo audio session helper (`configureAudioSession`)
- ✅ Permission flows (microphone, speech recognition)
- ✅ Local file persistence (AsyncStorage queue)
- ✅ tRPC voice procedures (`voice.sttTranscribe`, `voice.ttsSynthesize`, `voice.stream`)
- ✅ Background audio modes configured in `app.json`
- ✅ Foreground service for Android
- ✅ Queue system with retry logic
- ✅ Local models support (Faster-Whisper + Piper TTS)

### In Progress (Phase 3)
- ⏳ Full bidirectional streaming (session management complete, audio chunk processing pending)
- ⏳ Enhanced error recovery and reconnection
- ⏳ Metrics dashboard expansion

### Pending (Phase 4-5)
- ⏳ CarPlay integration (`react-native-carplay` plugin exists but disabled)
- ⏳ Siri intents and CarPlay templates
- ⏳ App Store CarPlay entitlement submission

## Local Models

The voice system supports local models (Faster-Whisper for STT, Maya1 or Supertonic for TTS) when `VOICE_PROVIDER=maya1` or `VOICE_PROVIDER=supertonic`. See `docs/voice/local-models.md` for setup instructions.

Key features:
- Zero API costs
- Complete privacy (no data leaves server)
- Lower latency (no network round-trip)
- Offline operation
- Process pools with health checks and auto-restart

## Validation & Follow-up
- Review this plan with product, safety, and legal stakeholders; log resulting work in Linear (one ticket per phase plus CarPlay entitlement tracking).
- After implementation, run ride-along tests capturing latency, reconnection rates, and biometric elevation compliance, then update `docs/alfred-prd.md` and `docs/native/voice.md` with outcomes.
