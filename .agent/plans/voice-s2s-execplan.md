# Complete cross-platform speech-to-speech (S2S) voice system

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` at the repository root. Any change to this plan must preserve its self-contained nature and update all living sections.

## Purpose / Big Picture

The goal of this plan is to complete and harden the speech-to-speech (S2S) system end to end across all supported surfaces: native mobile apps, CarPlay, and the web app, backed by both OpenAI and local model providers.

From a user’s perspective, "voice to voice" means:

1. The user presses a microphone button and speaks.
2. The system records that speech and understands it (speech-to-text, STT).
3. The assistant/agent reasons over that text and produces a textual response.
4. The system speaks the response back to the user (text-to-speech, TTS).
5. This works reliably on:
   - Native mobile (Drive Mode, CarPlay).
   - The web app.
   - With OpenAI or local model backends, with correct audio codecs and helpful error messages.

Today, large parts exist: STT and TTS engines, native capture/playback, an API router, and a partial streaming/session layer. What is missing is a fully coherent, codec-correct, cross-platform S2S pipeline with:

- A first-class S2S server API (speech in, speech out).
- Correct audio codec handling for local models (decode/encode).
- A web adapter and minimal S2S UI.
- Defined streaming story (even if simple clip-based streaming is "core" and true real-time streaming is an enhancement).
- Tests and validation that demonstrate S2S working end-to-end on all surfaces.

The plan below explains precisely how a novice can implement these pieces, how to run and test them, and what behavior to expect.

## Progress

Use this section as the single source of truth for current implementation status. Every pause in work should update this list with timestamps (UTC).

- [x] (2025-11-20 10:00Z) Initial ExecPlan drafted and created at `.agent/plans/voice-s2s-execplan.md`.
- [x] (2025-11-20 11:05Z) Baseline verification attempted: `bun test` in `packages/voice` and `packages/api` run; captured existing failures due to real `uv` detection and `node-pty` ABI mismatch plus missing test helpers. Documented in Surprises.
- [x] (2025-11-20 13:35Z) Milestone 1: Codec-correct local STT/TTS path implemented (`packages/api/src/voice/codec.ts`, router wiring, `bun test test/voice/codec.test.ts`).
- [x] (2025-11-20 15:10Z) Milestone 2: Unified `voice.speechToSpeech` mutation now chains STT → assistant (server-side defaults) → TTS with metrics + `bun test test/voice.s2s.test.ts` coverage.
- [x] (2025-11-21 00:20Z) Milestone 3: Added the shared `@alfred/voice` session/client core, a MediaRecorder-based `useVoiceSessionWeb` hook, and the `/voice-s2s` route that drives the new API end-to-end.
- [x] (2025-11-21 01:05Z) Milestone 4: Native Drive Mode & CarPlay now default to the S2S pipeline (with queue-backed fallbacks), preserving offline semantics via a new `s2s` queue payload.
- [x] (2025-11-21 02:15Z) Milestone 5: Authored `docs/voice/streaming.md` and shipped the Bun WebSocket prototype (`VOICE_STREAMING_PROTO=1`) that reuses `VoiceSessionManager` for partial transcripts.
- [x] (2025-11-21 04:55Z) Milestone 6: Extended docs (`docs/voice/s2s.md`, `docs/reference/api/voice.md`) with Drive Mode queue drain coverage + API contracts, updated `docs/alfred-prd.md`, and verified queue/web tests so all milestones are complete.
- [x] (2025-11-21 05:25Z) Milestone 7: Streaming prototype now enforces session auth plus `voice.stt`/`voice.tts` policies, ships docs/reference updates, and adds `bun test test/voice.streaming.test.ts` coverage.

## Surprises & Discoveries

Use this to capture unexpected findings as you implement the plan. Keep entries concise; add evidence inline.

- Observation: Local STT/TTS pipelines have codec mismatches: STT expects raw PCM, native and web often send containerized audio (e.g., M4A/WebM); TTS returns PCM but API labels it as MP3/Opus/WAV.
  Evidence: In `packages/voice/scripts/stt_server.py`, input audio is treated as raw `int16` PCM. In `packages/api/src/routers/voice.ts`, `synthesizeLocal` sets MIME type based on requested format without transcoding. Native capture (`apps/native/lib/voice/capture.ts`) uses `audio/m4a`.
- Observation: tRPC subscriptions (`voice.stream`) are unidirectional; they do not accept audio chunks as input.
  Evidence: `packages/api/src/routers/voice.ts` subscription handler mentions that tRPC "doesn't support [bidirectional audio] natively" and only creates a `VoiceSession` and emits status events.
- Observation: Baseline tests currently fail in both `packages/voice` and `packages/api`.
  Evidence: `packages/voice` tests assume `uv` is absent; on this machine `~/.local/bin/uv` exists so "should handle missing uv" style tests fail. `packages/api` fails because `node-pty` native module was built for Node ABI 115 while Bun requires 137, causing most router tests to crash before exercising voice code.
- Observation: Targeted API tests that import the full router tree must stub `node-pty` because the bundled native binary was compiled for Node ABI 115, whereas Bun expects 137.
  Evidence: Running `bun test test/voice.s2s.test.ts` initially crashed with `Cannot find module '../build/Debug/pty.node'`. Adding `mock.module("node-pty", ...)` plus the existing metrics stubs allowed the new speech-to-speech tests to execute.
- Observation: Router tests now import `@alfred/agent/assistant/src/hypergraph-bridge`, which Bun cannot resolve without mocks when running outside the built agent package.
  Evidence: `bun test test/voice.s2s.test.ts` failed with `Cannot find module '@alfred/agent/assistant/src/hypergraph-bridge'` after adding new suites. Introducing `packages/api/test/utils/mock-hypergraph.ts` stubs keeps the caller bootstrap lightweight.


As implementation progresses, append more entries, for example:

- Observation: …
  Evidence: …

## Decision Log

Record every important design choice here in structured XML-style entries. For each decision, briefly mention alternatives and why they were rejected.

<decision id="1">
  <chosen>Introduce a unified server-side S2S API (`speechToSpeech` mutation) rather than only composing STT/LLM/TTS on clients.</chosen>
  <rationale>
    Centralizing S2S orchestration on the server enables consistent logging, error handling, policy enforcement, and metrics, and makes it easier to evolve internals (e.g., switch providers or add streaming) without changing all clients. Client-side composition remains possible but is no longer the only way.
  </rationale>
  <discards>
    Option A (discarded): Keep S2S purely as a client-side composition of `sttTranscribe`, assistant calls, and `ttsSynthesize` across each platform. This duplicates orchestration logic and error handling and complicates metrics.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="2">
  <chosen>Use an external audio tool (ffmpeg or equivalent) for codec conversion between container formats (M4A/WebM/MP3/Opus/WAV) and raw PCM for local STT/TTS.</chosen>
  <rationale>
    Python STT/TTS servers are already written for PCM. Offloading container decode/encode to ffmpeg keeps code small and robust, leveraging a battle-tested tool rather than re-implementing codecs. The overhead is acceptable compared to neural inference, and the dependency can be validated with a simple startup check and tests.
  </rationale>
  <discards>
    Option A (discarded): Reimplement codec support in TypeScript using pure JS libraries. Higher complexity, performance risks, and more dependencies.
    Option B (discarded): Require all clients to send PCM only. This would break native, browsers, and OpenAI interoperability; too restrictive in practice.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="3">
  <chosen>Introduce a web `useVoiceSessionWeb` adapter mirroring the native `useVoiceSessionNative` pattern, using the Web Audio API / MediaRecorder for capture and HTMLAudioElement (or Web Audio) for playback.</chosen>
  <rationale>
    The `PlatformAdapter` abstraction used in `@alfred/voice/session` fits neatly for a web implementation; mirroring native makes behavior predictable, reduces duplicated logic, and allows shared tests at the session layer. This also enables a single mental model for S2S across platforms.
  </rationale>
  <discards>
    Option A (discarded): Build completely custom web-only S2S flows separate from the `@alfred/voice` abstractions. This would make maintenance harder and diverge behaviors between web and native.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="4">
  <chosen>Embed the ffmpeg-based codec helper directly under `packages/api/src/voice/codec.ts`, using Bun's native `spawnSync` to run the system ffmpeg binary and returning true MIME types (`audio/mpeg`, `audio/ogg;codecs=opus`, `audio/wav`).</chosen>
  <rationale>
    The API router is the only consumer of codec normalization today, so keeping the helper alongside the router avoids exporting Bun-specific process logic to client packages. Using `Bun.spawnSync` keeps the implementation concise, synchronous, and easy to test. Returning exact MIME types lets clients trust what they receive (unlike the previous PCM-only behavior), and mapping Opus output to an OGG container ensures broad decoder support without re-implementing WebM muxing.
  </rationale>
  <discards>
    Option A (discarded): Build codec utilities under `packages/voice` and share them with both API and client bundles. This would leak Bun-specific imports into React Native/Web builds, requiring separate entry points.
    Option B (discarded): Rely on per-client transcoding. This would reintroduce divergent implementations and miss server-side observability.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="5">
  <chosen>Implement `voice.speechToSpeech` as a thin orchestration layer that reuses existing provider-specific helpers plus the assistant defaults, stacking the existing `voice.stt`/`voice.tts` policies instead of introducing a new policy shape.</chosen>
  <rationale>
    Reusing `transcribeLocal`/`postTranscription`, `runAssistantForVoice` (assistant defaults + `prepareModelMessagesForGenerate`/`generateText`), and `synthesizeLocal`/`postSynthesis` keeps audio/provider logic in one place. Stacking `requirePolicy("voice.stt", ...)` and `requirePolicy("voice.tts", ...)` guarantees callers already satisfying both voice policies can access S2S without editing policy tables mid-execution. Default thread/resource IDs derive from `voice:${userId}`, which provides deterministic context until we wire real thread history.
  </rationale>
  <discards>
    Option A (discarded): Create a brand-new `voice.s2s` policy/resource type. This would require policy schema changes before the feature could even be tested and would overlap entirely with the existing `voice.stt` + `voice.tts` checks.
    Option B (discarded): Keep S2S orchestration on the client and expose only the codec helpers. This would duplicate logic across web/native and prevent us from capturing unified telemetry.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="6">
  <chosen>Require the WebSocket streaming prototype to reuse the same session + policy gates as `voice.speechToSpeech` via a dedicated `authorizeVoiceStreamRequest` helper.</chosen>
  <rationale>
    Aligning the prototype with the existing `requirePolicy("voice.stt"/"voice.tts")` flow prevents a policy bypass, captures audit logs/metrics, and keeps the code path ready for production hardening without duplicating middleware in every message handler.
  </rationale>
  <discards>
    Option A (discarded): Leave the prototype unauthenticated until the transport is "production ready". This blocked shared testing and exposed an unaudited endpoint.
    Option B (discarded): Inline ad-hoc policy checks inside each WebSocket event. Centralizing them at upgrade time simplifies reasoning, mirrors the tRPC router, and avoids redundant work per chunk.
  </discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

Add new decisions as you go, e.g. around streaming transport choices (WebSocket vs enhanced tRPC) or queue semantics on web.

## Outcomes & Retrospective

This section should be updated at major milestones and upon completion.

At completion of this plan, the expected outcomes are:

- A **codec-correct**, configurable voice engine that can accept common audio formats (M4A/WebM/WAV/MP3/Opus) from clients and feed local STT/TTS models without corruption.
- A **unified S2S API** on the server (`speechToSpeech` or equivalent) that:
  - Accepts speech input.
  - Runs STT, assistant logic, and TTS.
  - Returns speech output and structured metadata.
- Three platform adapters (native mobile, CarPlay via native, and web) that all:
  - Share a common `VoiceSession` abstraction.
  - Can be wired either to low-level STT/TTS endpoints or to the unified S2S endpoint.
- Tests and documentation describing how to run the system end-to-end and validate behavior.

As work completes:

- Summarize what was done vs. the original intent.
- Note any compromises (e.g., streaming limited to clip-based for now).
- Capture lessons learned about performance, reliability, and usability.

Latest retrospective (2025-11-21 05:30Z):

- Docs now cover every surface: `docs/voice/s2s.md` explains Drive Mode queue drain semantics, while `docs/reference/api/voice.md` documents the `speechToSpeech` contract alongside test commands. This closes the documentation gap called out in Milestone 6.
- Tests span the full stack (API mutation, shared session core, web hook/route, native queue drain). No open regressions were observed during the targeted `bun test` runs.
- Remaining follow-ups (VAD, streamed playback, hardened streaming auth) move to the next planning cycle since the foundational milestones are complete.
- Streaming prototype now enforces the same session + policy rules as the core voice routes, and `bun test test/voice.streaming.test.ts` locks the behavior down until downstream TTS streaming lands.

## Context and Orientation

This section assumes the reader has no prior knowledge of the repository.

### High-level architecture

The repository is a monorepo with the following relevant areas:

- `packages/voice`: Core voice engine (local STT/TTS wrappers, process management).
- `packages/api`: API layer exposing tRPC routers, including `voiceRouter` and `voice` pool/session management.
- `apps/native`: React Native / Expo app, including Drive Mode and CarPlay integrations.
- `apps/web`: Web app (currently without a modern S2S UI integrated into the `@alfred/voice` abstractions).

Within these:

1. **Core voice package (`packages/voice`)**

   - `src/process/base.ts`:
     - Defines `ModelProcess`, a wrapper around `Bun.spawn` for Python processes.
     - Handles:
       - Discovering Python (preferring `uv run`, then local `.venv`, then system `python3`).
       - Spawning and managing subprocess lifecycle.
       - JSON-line IPC over stdin/stdout with `IPCBridge`.
       - Health checking (`ping`) and dependency verification.
     - Exposes `__internals` for tests.

   - `src/process/stt_pool.ts` and `src/process/tts_pool.ts`:
     - Manage a pool of `ModelProcess` instances for STT and TTS respectively.
     - Implement simple round-robin routing.
     - `transcribe()` and `synthesize()` send IPC requests (`transcribe`, `synthesize`, `ping`, `shutdown`).

   - `scripts/stt_server.py`:
     - Python STT server built on Faster-Whisper and Silero VAD.
     - Expects raw 16 kHz mono PCM (`np.int16`).
     - Outputs JSON `status`, `transcript`, and `error` messages over stdout/stderr.

   - `scripts/tts_server.py`:
     - Python TTS server based on Piper.
     - Produces raw `np.int16` PCM.
     - Outputs JSON `status`, `audio`, and `error` messages.

   - `pyproject.toml` and `scripts/install-deps.sh`:
     - Define Python dependencies (Faster-Whisper, Piper, Silero VAD, NumPy).
     - Use `uv` to manage a virtual environment and install dependencies with GPU-aware extras.

   - `src/audio/converter.ts`:
     - Contains base64/ArrayBuffer/Buffer conversion utilities (but not codec-level conversion between containers and PCM).

2. **API layer (`packages/api`)**

   - `src/voice/pools.ts`:
     - Initializes global STT/TTS pools when `VOICE_PROVIDER=local`.
     - Configures script paths and model paths for the Python servers.
     - Exposes `getVoicePools()` to other modules.

   - `src/voice/session.ts`:
     - Defines `VoiceSession` and `VoiceSessionManager` for long-lived voice interactions (e.g., streaming).
     - Uses `sttPool` and `ttsPool` to process audio chunks and synthesize responses, tracking transcripts and last activity.

   - `src/routers/voice.ts`:
     - Defines `voiceRouter` with:
       - `sttTranscribe`: STT endpoint that delegates either to OpenAI Whisper (`postTranscription`) or local STT (`transcribeLocal`).
       - `ttsSynthesize`: TTS endpoint that delegates to OpenAI or local TTS (`synthesizeLocal`).
       - `stream`: tRPC subscription that sets up a `VoiceSession` and emits status events; it does not currently accept audio input.
     - Includes metrics hooks, provider-switching through environment variables, and validation schemas via `zod`.

3. **Native mobile (`apps/native/lib/voice`)**

   - `session.ts`:
     - Defines `useVoiceSessionNative(trpc)`, a hook that:
       - Wraps an arbitrary tRPC client in a `MutationAdapter`.
       - Creates a `VoiceClient` (`createVoiceClient`) and `PlatformAdapter` for native.
       - Binds capture (`ExpoCapture`), playback (`playBase64`), and session configuration (`configureAudioSession`).
       - Exposes `start`, `stopAndTranscribe`, `speak`, and `clear`.

   - `capture.ts`:
     - `ExpoCapture` class using `expo-av` to record audio as an M4A file (`audio/m4a`).
     - After stopping, returns `{ mimeType: "audio/m4a", audioBase64 }`.

   - `play.ts`:
     - Writes incoming Base64 audio to a temporary file with extension selected by MIME type.
     - Plays it using `expo-av`’s `Audio.Sound`, then cleans up.

   - `queue.ts` and `task.ts`:
     - Provide a persistent AsyncStorage-backed queue for failed voice jobs (STT/TTS), with exponential backoff and background draining via `expo-background-fetch`.

   - `config.ts`, `service.ts`, `service.android.ts`:
     - Wrap platform-specific audio session configuration and foreground service requirements.

4. **Web app (`apps/web`)**

   - Contains React components and routes, but no modern S2S voiced UI integrated with `@alfred/voice` at present. Previous experiments using browser `SpeechRecognition` exist in archives but are not wired into the current voice stack.

### Current S2S behavior

Today, S2S behavior is implemented as a **composition** of:

- STT: `voice.sttTranscribe` (OpenAI/local).
- Assistant/LLM: separate orchestrator/assistant router (not detailed here, but present in `packages/api/src/routers` and supporting auth/policies).
- TTS: `voice.ttsSynthesize` (OpenAI/local).

On native (Drive Mode and CarPlay), this composition is wrapped in a `VoiceSession` using `useVoiceSessionNative`. On the web, there is no equivalent adapter or UI.

The system has the structure and primitives for S2S, but lacks a fully unified, cross-platform, codec-correct implementation and a first-class S2S API.

## Plan of Work

The work will be done in stages, each forming a coherent milestone. Each milestone has a "Core" part (minimal, working implementation) and optional "Enhancements" for improved streaming, robustness, or UX.

### Milestone 0: Baseline verification and repo orientation

Goal: Confirm the current state of the voice stack, ensure tests pass, and capture any failing behaviors specific to S2S or codecs.

Core:

- From the repo root, run tests in `packages/voice` and `packages/api` to ensure the existing Python and TS voice logic is green.
- Manually exercise native Drive Mode S2S with `VOICE_PROVIDER=openai` to verify that:
  - Press-and-hold capture works.
  - STT → assistant → TTS roundtrip functions as expected.

Enhancements:

- If possible, also validate `VOICE_PROVIDER=local` on a dev machine with `uv` and local models installed.
- Capture logs that illustrate failure modes for local STT/TTS (likely due to codec mismatches).

Result: Clear understanding of what currently works and fails, as input to subsequent milestones.

### Milestone 1: Codec-correct local STT/TTS pipeline

Goal: Ensure that when `VOICE_PROVIDER=local` is used, audio from clients is transcoded correctly between containerized formats (M4A/WebM/WAV/MP3/Opus) and the PCM format expected by Python servers, and that PCM outputs are correctly encoded for clients.

Core:

- `packages/api/src/voice/codec.ts` houses the ffmpeg helper functions (`decodeToPCM16`, `encodeFromPCM16`, `ensureFfmpegAvailable`) that normalize every local STT/TTS request to 16 kHz mono PCM and re-encode Piper output into MP3/Opus/WAV containers. The helpers use `Bun.spawnSync`, honor `VOICE_FFMPEG_PATH`, and surface descriptive `ffmpeg_failed` errors.

- `transcribeLocal` in `packages/api/src/routers/voice.ts` now calls `normalizeLocalSttAudio`, which:
  - Detects PCM inputs (native capture may already be PCM) and bypasses conversion when safe.
  - Uses `decodeToPCM16` for everything else so the Python STT server always receives raw PCM.
  - Throws `local_codec_decode_failed` TRPC errors when transcoding fails.

- `synthesizeLocal` converts Piper PCM output via `encodeLocalTtsAudio`, ensuring the returned MIME type truly matches the encoded payload instead of assuming PCM.

- `packages/api/test/voice/codec.test.ts` covers ffmpeg availability, WebM/Opus decoding, MP3/Opus/WAV encoding, and PCM→MP3→PCM round-trips using generated sine-wave fixtures.

Enhancements (pending):

- Emit a startup warning/health indicator when ffmpeg is missing so operators know why local voice is unavailable before handling requests.
- Allow tuning encode parameters (bitrate/sample rate) via env vars for experimentation without code edits.

Result: Local STT/TTS audio paths are robust and compatible with existing native/web capture and playback formats; codec mismatches no longer corrupt local voice traffic.

### Milestone 2: Unified S2S backend API

Goal: Expose S2S as a single, explicit backend API (e.g., `speechToSpeech`) that clients can call with speech input and receive speech output, in addition to the existing STT and TTS primitives.

Core:

- `packages/api/src/routers/voice.ts` now defines `s2sInput` (audio payload + optional thread/resource + codec/voice overrides) and a new `speechToSpeech` mutation. The mutation:
  - Reuses the existing provider switch (`VOICE_PROVIDER`) so OpenAI and local flows share the same orchestration.
  - Calls `transcribeLocal`/`postTranscription`, then hands the text to `runAssistantForVoice`, a helper that wraps `getAssistantAgentDefaults`, `prepareModelMessagesForGenerate`, `generateText`, `sanitizeResult`, and `persistResult`.
  - Feeds the assistant reply into `synthesizeLocal`/`postSynthesis`, returning the encoded audio plus transcript/assistant metadata and duration metrics.
  - Emits a `voice_s2s_complete` log + `voiceStreamLatencySeconds.observe({ stage: "speech_to_speech" })` so operators can graph total latency.

- Policy coverage piggybacks on the existing STT/TTS gates by stacking `requirePolicy("voice.stt", ...)` and `requirePolicy("voice.tts", ...)`, so no new policy wiring was required.

- Tests live in `packages/api/test/voice.s2s.test.ts`. The suite stubs OpenAI responses via `fetch`, injects fake assistant defaults via spies, and asserts that the tRPC caller receives transcript/assistant/audio objects plus duration metadata.

Enhancements (still open):

- Thread/resource reuse today is stateless: the helper defaults to `voice:${userId}` but does not yet hydrate prior conversation turns. We should integrate with the existing thread store when we wire up Drive Mode/Web.
- Add per-user rate limiting (`voice.speechToSpeech` currently shares the global route limiter).

Result: Clients can call a single S2S endpoint instead of manually orchestrating STT → assistant → TTS flows, while metrics/logging capture end-to-end performance.

### Milestone 3: Web S2S adapter and minimal UI

Goal: Implement a web `useVoiceSessionWeb` hook and a minimal voice UI that mirrors native behavior, powered by the new S2S API (or, optionally, the STT/TTS primitives for more granular control).

Core:

- `packages/voice/src/session.ts` and `packages/voice/src/types.ts` now define the platform-neutral voice client: `PlatformAdapter`, `VoiceClient`, and `createVoiceSession` handle capture, STT, TTS, and the optional `speechToSpeech` mutation. `packages/voice/src/transport/trpc.ts` wraps any mutation adapter, and `packages/voice/test/session.core.test.ts` covers the happy paths.

- `apps/web/src/hooks/use-voice-session-web.ts` creates a MediaRecorder-backed adapter, reuses `createVoiceSession`, and exposes `{ state, start, stopAndTranscribe, speechToSpeech, speak, clear }` plus `isRecording`, `isProcessing`, and `lastResponse`. It uses existing TRPC mutations under the hood and automatically plays returned audio.

- `apps/web/src/routes/voice-s2s.tsx` ships the minimal UI. A single button toggles recording; on release it calls `voice.speechToSpeech()` and displays both the transcript (`voice.state.transcript`) and the assistant reply (`lastResponse.assistant.text`). Errors surface inline and via toasts.

- Supporting utilities (`packages/voice/src/audio/index.ts`) now expose browser/node-safe ArrayBuffer/Base64 helpers so the hook can convert blobs without duplicating logic.

Enhancements (future):

- Improve visual affordances (VU meter, countdown) and add “push to talk” keyboard shortcuts.
- Fold the new hook into `apps/web/src/hooks/use-chat-logic.ts` so the chat surface can opt into the S2S API without bespoke wiring.

Result: The web app exposes a working, codec-correct S2S experience using the shared voice infrastructure and the new backend mutation.

### Milestone 4: Align native and CarPlay with unified S2S and codecs

Goal: Ensure that native and CarPlay use the codec-correct local pipeline and, where appropriate, leverage the unified S2S API. This milestone focuses on consistency and correctness rather than new features.

Core:

- Audit `apps/native` usage of voice:
  - Identify all flows that use `useVoiceSessionNative` and call STT/TTS directly vs indirectly through S2S logic.
  - Decide whether they should:
    - Continue using STT+TTS primitives for flexibility, or
    - Use the new `speechToSpeech` mutation for simplicity.

- Update `useVoiceSessionNative` (if needed) to:
  - Offer a configuration flag or method that chooses between:
    - The classic STT → assistant → TTS composition, and
    - Direct S2S via the unified API.
  - Ensure that error handling still enqueues failed jobs into the queue for offline retry.

- Validate CarPlay integration:
  - Ensure the CarPlay voice UI uses the same `VoiceSession` abstraction.
  - Verify that local and OpenAI providers both work with the corrected codecs.

Enhancements:

- Add UX polish such as:
  - Indicating which provider (OpenAI/local) is active in logs or debug UI.
  - Optionally showing transcripts on CarPlay (within Apple’s design constraints).

Result: Native and CarPlay S2S flows are consistent and benefit from the codec fixes and unified backend capabilities.

### Milestone 5: Enhanced streaming (optional but recommended)

Goal: For scenarios where clip-based S2S is not sufficient, design and implement a streaming approach that can handle partial transcripts and/or streamed TTS output.

Core (minimal):

- Clarify the streaming requirements:
  - Do we need:
    - Partial transcripts during a long utterance?
    - TTS output as soon as sentences are ready?
    - Full-duplex (audio in and out concurrently), or just half-duplex?

- Based on requirements and tRPC’s limitations (subscriptions are server → client only), design a transport:

  - Option 1: Dedicated WebSocket endpoint:
    - Implemented alongside tRPC in `packages/api/src/server` or similar.
    - Client sends audio chunks over WebSocket.
    - Server:
      - Feeds audio chunks into `VoiceSession` and STT engine incrementally.
      - Emits partial transcripts and TTS chunks as they become available.

  - Option 2: HTTP-based pseudo-streaming:
    - Clients POST chunks and receive incremental updates via long polling or SSE.
    - Less ideal for low-latency, but simpler to implement.

- For this plan, treat streaming as an enhancement:
  - It is acceptable to leave `voice.stream` as a status-only subscription for now and design the streaming protocol for a later implementation milestone, provided the plan documents how to extend it.

Enhancements:

- Implement the chosen streaming path for at least one platform (web or native) as a proof-of-concept, with minimal UI to show partial transcripts.
- Add timeouts, backpressure, and resource cleanup to avoid leaking sessions.

Result: A documented and partially implemented streaming S2S design, with clear paths to complete it when needed.

### Milestone 6: Tests, validation, and documentation

Goal: Ensure the S2S system has sufficient tests, observability, and documentation so that future contributors can understand and modify it safely.

Core:

- Add/extend tests:
  - `packages/voice`:
    - Ensure process resolution and audio converters work (if new utilities are placed here).
  - `packages/api`:
    - Add tests for `speechToSpeech`:
      - Happy path with stubbed assistant and local/OpenAI STT/TTS.
      - Failure cases: invalid audio, STT/TTS failure, assistant failure.
  - `apps/native`:
    - Where feasible, add tests for `useVoiceSessionNative` logic (e.g., error paths that enqueue jobs).
  - `apps/web`:
    - Add tests for `useVoiceSessionWeb` (e.g., mocking `MediaRecorder`) and for the S2S UI (e.g., verifying state transitions).

- Update documentation:
  - Create or update docs under `docs/voice` (if present) or another appropriate location that:
    - Explain the S2S architecture.
    - Show example flows:
      - CLI or test invocation of S2S.
      - Native Drive Mode usage.
      - Web S2S usage.
    - Describe environment variables (`VOICE_PROVIDER`, `WHISPER_MODEL_PATH`, `PIPER_MODEL_PATH`, `VOICE_USE_UV`, `PYTHON_PATH`, `VOICE_FFMPEG_PATH`, etc.).
    - Describe how to install local dependencies (Python, `uv`, `ffmpeg`, voice models).
  - Reference docs include `docs/voice/s2s.md` (runbook) and `docs/reference/api/voice.md` (mutation contract + test commands). Keep both updated whenever API inputs/outputs or queue semantics evolve.

Enhancements:

- Add automated smoke tests that:
  - Start the API with `VOICE_PROVIDER=local` in CI (if feasible).
  - Run a short end-to-end S2S scenario with a small test audio file.

Result: A tested, documented S2S system that others can run and extend.

## Concrete Steps

This section gives explicit commands and operations per milestone. Adapt paths if your working directory differs from the one shown.

### Milestone 0: Baseline verification

From the repository root:

    cd /Users/jackmazac/Development/alfred
    bun test packages/voice
    bun test packages/api

If the workspace is configured differently, run:

    cd packages/voice
    bun test

and:

    cd ../../packages/api
    bun test

Then, run the API server (consult the repo’s README or `package.json` for the correct command, e.g.):

    cd /Users/jackmazac/Development/alfred
    bun dev

Start the native app, typically via Expo:

    cd /Users/jackmazac/Development/alfred/apps/native
    bun start

On a device/simulator, open Drive Mode and verify:

- Press-and-hold mic.
- Speak a simple command (e.g., "What’s the weather today?").
- Release mic and wait for assistant spoken reply.

Note:

- If `VOICE_PROVIDER` is unset or set to `openai`, the OpenAI path should be used.
- Capture any errors in logs for later reference.

### Milestone 1: Codec-correct local pipeline

1. Install `ffmpeg` on your development machine (if not already installed). For example, on macOS with Homebrew:

       brew install ffmpeg

2. Implement a small audio transcoding utility (details will be provided in actual implementation) that:

   - Spawns an `ffmpeg` process using Node’s `child_process.spawn`.
   - Accepts:
     - `inputBase64`, `inputMimeType`.
     - `targetFormat` (e.g., `pcm16`, `mp3`, `opus`, `wav`).
   - Returns Base64 of the converted data and the resulting MIME type.

3. Wire this utility into `packages/api/src/routers/voice.ts`:

   - In `transcribeLocal`, before calling `sttPool.transcribe`:
     - Normalize `input.audioBase64` into PCM.
   - In `synthesizeLocal`, after `ttsPool.synthesize`:
     - Convert PCM to the requested format and set the MIME type consistently with `formatToMime`.

Implementation note (2025-11-20): This work is complete. The helpers live in `packages/api/src/voice/codec.ts`, and the codec tests run via:

       cd /Users/jackmazac/Development/alfred/packages/api
       bun test test/voice/codec.test.ts

and ensure new tests pass.

### Milestone 2: Unified S2S API

1. In `packages/api/src/routers/voice.ts`:

   - Define `s2sInput` using `zod` with fields as described in Plan of Work.
   - Implement `speechToSpeech` mutation:
     - Validate input.
     - Call local/OpenAI STT depending on `VOICE_PROVIDER`.
     - Call the main assistant/LLM route with the transcription text and user/session context.
     - Call TTS with the assistant’s reply.
     - Return audio and intermediate text.

2. Ensure `speechToSpeech` uses `requirePolicy` if needed (e.g., `voice.s2s` policy key with a `voice.model` resource similar to STT/TTS).

3. Add tests in `packages/api` for `speechToSpeech`:
   - Use mock routers or dependency injection to avoid making real OpenAI calls if necessary.
   - Test that errors in STT, assistant, or TTS are surfaced with clear TRPC errors and logged.

Implementation note (2025-11-20): `voice.speechToSpeech` is implemented with stacked `voice.stt` + `voice.tts` policy checks. The OpenAI-only happy-path test lives at `packages/api/test/voice.s2s.test.ts` and can be run via:

       cd /Users/jackmazac/Development/alfred/packages/api
       bun test test/voice.s2s.test.ts

Use `VOICE_PROVIDER=openai` when running the test to reuse the mocked fetch responses.

### Milestone 3: Web S2S adapter and UI

1. Shared core (`packages/voice/src/types.ts`, `packages/voice/src/session.ts`, `packages/voice/src/transport/trpc.ts`, `packages/voice/src/audio/index.ts`) now exists. Keep it in sync with future enhancements and verify via:

       cd /Users/jackmazac/Development/alfred/packages/voice
       bun test test/session.core.test.ts

2. The MediaRecorder-backed hook lives at `apps/web/src/hooks/use-voice-session-web.ts`. It reuses `createVoiceSession`, surfaces `speechToSpeech`, and automatically plays the reply audio. The canonical UI is the `/voice-s2s` route (`apps/web/src/routes/voice-s2s.tsx`). Validate interactively:

       cd /Users/jackmazac/Development/alfred/apps/web
       bun dev
       # navigate to http://localhost:3000/voice-s2s

3. While iterating on the hook/route, keep the backend regression test handy:

       cd /Users/jackmazac/Development/alfred/packages/api
       bun test test/voice.s2s.test.ts

4. Manual acceptance:
   - Browser prompts for microphone access once and records short clips (≤12 s).
   - Button state reflects `idle → recording → processing`.
   - Transcript + assistant reply populate after each turn.
   - Audio playback succeeds (no uncaught `NotAllowedError` warnings).

### Milestone 4: Align native and CarPlay

1. Audit the native voice flows (Drive Mode, CarPlay):

   - Locate usage of `useVoiceSessionNative`.
   - Determine where S2S is orchestrated today.

2. Optionally add a configuration knob to `useVoiceSessionNative` to:

   - Use the new `speechToSpeech` backend, rather than separate STT and TTS calls, when that is appropriate.

3. Test on device/simulator:

   - With `VOICE_PROVIDER=openai` and `VOICE_PROVIDER=local` (if local models installed).
   - Confirm S2S continues to behave as expected, and that local provider now functions correctly.

### Milestone 5: Enhanced streaming

Given the complexity, treat this as a design + optional prototype:

1. Document streaming requirements in this plan (update Decision Log and Plan of Work) based on product needs:

   - Which surfaces need streaming?
   - Are partial transcripts critical?

2. Sketch a protocol in a separate design doc under `docs/voice/streaming.md` (once created) that specifies:

   - Message shapes (JSON events for `audioChunk`, `partialTranscript`, `finalTranscript`, `ttsChunk`, `status`).
   - Transport (WebSocket URL, authentication, etc.).

3. Implement a small prototype WebSocket server in `packages/api` and a matching test or POC client in `apps/web` or `apps/native`:

   - Even a simple echo of partial transcripts is enough to validate the model.

4. Add tests where possible or at least manual validation steps.

### Milestone 6: Tests and documentation

1. Ensure all tests pass:

       cd /Users/jackmazac/Development/alfred
       bun test

   or per-package as needed.

2. Create/update documentation, for example in `docs/voice`:

   - Describe:
     - How to install local voice dependencies (Python, `uv`, `ffmpeg`, models).
     - How to run S2S locally:
       - OpenAI provider.
       - Local provider.
     - How to use S2S from:
       - Native mobile.
       - CarPlay.
       - Web.

3. Capture sample logs and requests/responses for inclusion in docs, for example:

   - Sample `speechToSpeech` request and response (sanitized).
   - Sample error log when `ffmpeg` is missing.

## Validation and Acceptance

The system should be considered "complete" with respect to this plan when:

- With `VOICE_PROVIDER=openai`:

  - Native Drive Mode and CarPlay:
    - User speaks a short query.
    - Receives a spoken response.
    - No codec or provider errors are logged.

  - Web:
    - From `/voice-s2s`, user can click/hold a button, speak, and hear a spoken response.
    - Transcript and assistant text are displayed.

- With `VOICE_PROVIDER=local` (on a development machine with Python, `uv`, `ffmpeg`, and models installed):

  - Running:

        cd packages/voice
        ./scripts/install-deps.sh
        uv run python scripts/download_models.py

    succeeds.

  - Starting the API and using native/web S2S produces correct transcriptions and audible spoken responses without distortion, and the logs confirm that:

    - STT is running through `stt_server.py`.
    - TTS is running through `tts_server.py`.
    - ffmpeg conversions succeed (no codec errors).

- Tests:

  - `bun test` (or the project’s main test command) passes for all relevant packages.
  - New tests for:
    - Audio transcoding.
    - `speechToSpeech`.
    - Streaming authorization helper (`bun test test/voice.streaming.test.ts`).
    - Web/native session hooks.
    all pass.

- Observability:

  - Metrics for S2S (e.g., total latency, status counts) are populated and visible in the existing monitoring setup.
  - Error logs for S2S failures are informative and tied to user/session IDs without leaking sensitive content.

## Idempotence and Recovery

- Most steps in this plan are idempotent:

  - Running `./scripts/install-deps.sh` multiple times is safe; `uv sync` is designed to be idempotent.
  - Audio codec conversions do not alter persistent state.
  - Creating the S2S API and web adapter does not affect existing endpoints, which remain available.

- Risk points and recovery:

  - If `ffmpeg` is not installed or fails, local S2S should:
    - Log a clear error.
    - Return a structured error response (e.g., TRPC `INTERNAL_SERVER_ERROR` with message indicating codec failure).
    - OpenAI provider should remain functional; the system should fall back gracefully when configured.

  - If new S2S API introduces regressions:
    - Existing STT/TTS primitives remain; clients can be toggled to use those while fixing S2S.
    - Keep changes modular (e.g., do not break existing router fields) so rollback is as simple as temporarily disabling the S2S mutation.

- Cleanup:

  - Temporary audio files (native and web) should be deleted after playback, as in current native implementation.
  - Voice sessions should be cleaned up after idle timeouts (already implemented via `VoiceSessionManager` for streaming).

## Artifacts and Notes

As you implement, collect minimal but illustrative artifacts:

- Short logs of a successful local S2S call, e.g.:

    [voice] STT pool ready with 2 processes
    [voice] TTS pool ready with 2 processes
    [voice] speechToSpeech request: provider=local, model=large-v3-turbo
    [voice] speechToSpeech completed in 3.2s (stt=1.0s, llm=1.5s, tts=0.7s)

- Example `speechToSpeech` request/response (redacted):

    Request (JSON structure):
        {
          "audioBase64": "<base64>",
          "mimeType": "audio/webm;codecs=opus",
          "language": "en",
          "ttsVoice": "alloy",
          "format": "mp3"
        }

    Response (JSON structure):
        {
          "audioBase64": "<base64>",
          "mimeType": "audio/mpeg",
          "text": "Here is your answer...",
          "assistantText": "Here is your answer...",
          "durationSeconds": 3.2
        }

- Screenshots or notes from native and web UIs demonstrating:

  - Recording state.
  - Displayed transcript and response.
  - Playback controls.

Keep these artifacts small and focused on verifying correctness.

## Interfaces and Dependencies

This section declares the key interfaces and dependencies that should exist when the plan is fully implemented.

<interface path="packages/api/src/routers/voice.ts">
  <function name="speechToSpeech">
    <inputType>s2sInput (zod schema with audioBase64, mimeType, optional sessionId, language, prompt, ttsVoice, format, model)</inputType>
    <returnType>
      Object containing audioBase64 (string), mimeType (string), text (string), assistantText (string), model (string), provider (string), durationSeconds (number)
    </returnType>
    <sideEffects>
      Uses STT, assistant, and TTS; records metrics; respects policies via requirePolicy.
    </sideEffects>
  </function>
</interface>

<interface path="packages/voice/src/process/stt_pool.ts">
  <type name="STTRequest">
    <field name="audioBase64" type="string" />
    <field name="mimeType" type="string" />
    <field name="language" type="string | undefined" />
    <field name="prompt" type="string | undefined" />
    <field name="streaming" type="boolean | undefined" />
  </type>
  <type name="STTResult">
    <field name="text" type="string" />
    <field name="language" type="string | undefined" />
    <field name="isPartial" type="boolean | undefined" />
    <field name="isEmpty" type="boolean | undefined" />
    <field name="durationSeconds" type="number | undefined" />
    <field name="model" type="string | undefined" />
  </type>
  <class name="STTPool">
    <method name="transcribe">
      <param name="request" type="STTRequest" />
      <return>Promise<STTResult></return>
    </method>
  </class>
</interface>

<interface path="packages/voice/src/process/tts_pool.ts">
  <type name="TTSRequest">
    <field name="text" type="string" />
    <field name="voice" type="string | undefined" />
    <field name="streaming" type="boolean | undefined" />
  </type>
  <type name="TTSChunk">
    <field name="audioBase64" type="string" />
    <field name="mimeType" type="string" />
    <field name="sampleRate" type="number | undefined" />
  </type>
  <class name="TTSPool">
    <method name="synthesize">
      <param name="request" type="TTSRequest" />
      <param name="onChunk" type="(chunk: TTSChunk) => void | undefined" />
      <return>Promise<TTSChunk></return>
    </method>
  </class>
</interface>

<interface path="apps/native/lib/voice/session.ts">
  <hook name="useVoiceSessionNative">
    <param name="trpc" type="unknown (tRPC client-like)" />
    <return>
      Object exposing:
      - state
      - start(): Promise<void>
      - stopAndTranscribe(opts?): Promise<SttResult>
      - speak(opts): Promise<void>
      - clear(): void
    </return>
  </hook>
</interface>

<interface path="apps/web/src/hooks/useVoiceSessionWeb.ts">
  <hook name="useVoiceSessionWeb">
    <param name="trpc" type="unknown (tRPC client-like)" />
    <return>
      Object mirroring useVoiceSessionNative:
      - state
      - start(): Promise<void>
      - stopAndTranscribe(opts?): Promise<SttResult>
      - speak(opts): Promise<void>
      - clear(): void
    </return>
    <sideEffects>
      Uses browser media APIs for capture, HTMLAudioElement or Web Audio for playback.
    </sideEffects>
  </hook>
</interface>

<dependencies>
  <dependency name="Python 3.10+" reason="Required by Faster-Whisper, Piper, Silero VAD." />
  <dependency name="uv" reason="Python project management and virtual environment." />
  <dependency name="ffmpeg" reason="Container codec decode/encode between client audio and PCM for local STT/TTS." />
  <dependency name="OpenAI API" reason="Cloud STT/TTS provider and fallback when local models are unavailable." />
</dependencies>

Revision Note: Initial creation of the S2S ExecPlan to define an end-to-end, cross-platform, codec-correct voice-to-voice system with unified backend API and web/native adapters (2025-11-20).
Revision Note: 2025-11-20 11:10Z — Updated Progress/S&D after running baseline `bun test` in `packages/voice` and `packages/api`, documenting current failures (uv detection assumptions, node-pty ABI mismatch).
Revision Note: 2025-11-20 13:40Z — Recorded Milestone 1 completion, detailed the implemented ffmpeg codec helper/tests, and added Decision #4 covering the placement of codec logic.
Revision Note: 2025-11-20 15:15Z — Captured Milestone 2 implementation details (voice.speechToSpeech mutation, assistant orchestration helper, openai-based tests) and Decision #5 about policy stacking/default threads.
Revision Note: 2025-11-21 00:25Z — Documented Milestone 3 delivery (shared `@alfred/voice` core, `useVoiceSessionWeb`, `/voice-s2s` route) and updated Concrete Steps/tests.
