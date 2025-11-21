# Voice Streaming Prototype

## Purpose

Provide a bidirectional transport that reduces round-trip latency between capture and spoken reply. The streaming layer lets clients deliver audio incrementally and receive status/transcript/playback events without waiting for an entire clip to upload.

This document describes the current WebSocket prototype, the message contract, and how it ties into the existing `VoiceSessionManager`. The goal is to de-risk Milestone 5 by standing up a working skeleton that future contributors can extend into full partial-transcript and streamed TTS delivery.

## Transport Summary

- **Protocol**: WebSocket (native Bun implementation via `Bun.serve`).
- **Endpoint**: `ws://<API_HOST>:<VOICE_STREAMING_PORT|8788>/voice/stream`.
- **Authentication**: Same as `voice.speechToSpeech`. The WebSocket upgrade reuses the tRPC session cookies, enforces both `voice.stt` and `voice.tts` policies, and rejects unauthenticated/unauthorized callers before the socket opens. Bring a real session cookie (e.g., from the browser) when testing.
- **Provider requirement**: Local voice provider (`VOICE_PROVIDER=local`). The prototype forwards audio chunks into the existing `VoiceSessionManager`, which in turn talks to the Faster-Whisper + Piper pools.
- **Input codec handling**: The server accepts PCM, M4A, WebM, MP3, or Opus chunks. Each chunk is normalized via the ffmpeg helper (`decodeToPCM16`) before the Faster-Whisper pool receives it, so clients can stream whatever their recorder produces.
- **Output codec negotiation**: Set `codec` in the `start` payload (`pcm|mp3|opus|wav`). The server now re-encodes each TTS chunk via `encodeFromPCM16` so downstream consumers receive the negotiated MIME type, falling back to PCM when the request is unsupported.
- **Lifecycle**:
  1. Client upgrades to WebSocket, receives `{"type":"ready","sessionId":null}`.
  2. Client sends `start` to allocate a session.
  3. Client streams `audio_chunk` events (base64 PCM, 16 kHz mono).
  4. Client sends `stop` to flush transcription and tear down.
  5. Server emits `partial_transcript`, `final_transcript`, and status/error events.

## Configuration

- `VOICE_STREAMING_PROTO=1` enables the Bun WebSocket server; `VOICE_STREAMING_PORT` (default `8788`) controls the port.
- Web app: set `VITE_VOICE_STREAMING_URL` (optional) and/or `VITE_VOICE_STREAMING_PORT`. When unset, the client derives `ws(s)://<frontend-host>:8788/voice/stream`.
- Native app: set `EXPO_PUBLIC_VOICE_STREAM_URL` (optional) and/or `EXPO_PUBLIC_VOICE_STREAM_PORT`. When unset, the Expo client derives the URL from `EXPO_PUBLIC_SERVER_URL`.


## Message Contract

All frames are UTF-8 JSON. Prototype types:

### Client → Server

```json
{ "type": "start",
  "sessionId": "optional",
  "language": "en",
  "codec": "pcm|mp3|opus|wav",
  "surface": "drive|carplay|web|native|stream|unknown",
  "vadThreshold": 0.6,
  "autoStop": true,
  "maxUtteranceMs": 20000,
  "ttsVoice": "en_US-lessac-medium",
  "ttsFormat": "mp3|opus|wav" }
{ "type": "audio_chunk", "audioBase64": "...", "mimeType": "audio/pcm", "emitPartial": true }
{ "type": "stop" }
{ "type": "ping" }
```

- `start`
  - `sessionId` (optional): supply to resume an abandoned session; otherwise the server generates one.
  - `language`: passed to `VoiceSessionManager.createSession` for Faster-Whisper hints.
  - `codec`: preferred outbound codec. The server advertises the negotiated codec in `session_started` and re-encodes chunks to `mp3`/`opus`/`wav` when requested (defaults to PCM).
  - `surface`: optional hint for the registry/UI so Drive Mode, CarPlay, and web can display the right badge.
  - `vadThreshold`: optional float (0–1) forwarded to Silero VAD; lower values make auto-stop more sensitive.
  - `autoStop`: defaults to `true`; when enabled the server triggers `auto_stop` on silence or when `maxUtteranceMs` elapses.
  - `maxUtteranceMs`: safety stop per utterance (20 s default).
  - `ttsVoice` / `ttsFormat`: hints forwarded to the TTS pipeline (format is honored for clip responses; streamed chunks stay PCM today).
- `audio_chunk`
  - `audioBase64`: Base64 PCM (`s16le`, 16 kHz, mono). Clients should transcode before sending (mirrors Milestone 1 codec rules).
  - `mimeType`: Defaults to `audio/pcm`; currently informative only.
  - `emitPartial`: Set `false` to skip per-chunk transcript pushes.
- `stop`: Flushes transcription, emits `final_transcript`, and closes the session.
- `ping`: Health probe (server responds with `pong`).

### Server → Client

```json
{ "type": "ready", "sessionId": null }
{ "type": "session_started", "sessionId": "uuid", "codec": "pcm", "negotiatedCodec": "pcm" }
{ "type": "partial_transcript", "sessionId": "uuid", "text": "..." }
{ "type": "vad_state", "sessionId": "uuid", "vadConfidence": 0.83, "isEmpty": false, "endOfUtterance": false }
{ "type": "auto_stop", "sessionId": "uuid", "reason": "silence" }
{ "type": "final_transcript", "sessionId": "uuid", "text": "..." }
{ "type": "assistant_message", "sessionId": "uuid", "text": "...", "replayId": "optional" }
{ "type": "tts_chunk", "sessionId": "uuid", "audioBase64": "...", "mimeType": "audio/mp3|audio/ogg;codecs=opus|audio/wav", "sequence": 0, "isLast": false }
{ "type": "tts_complete", "sessionId": "uuid" }
{ "type": "status", "sessionId": "uuid", "state": "recording|processing|playing|idle" }
{ "type": "error", "sessionId": "uuid", "message": "..." }
{ "type": "pong" }
```

The prototype keeps transcripts in memory via `VoiceSession.getTranscript()`. `partial_transcript` is emitted immediately after each `audio_chunk`, `vad_state` mirrors Silero’s confidence scores, and `auto_stop` fires when silence persists or `maxUtteranceMs` elapses. After `final_transcript`, the server runs the same assistant pipeline as `voice.speechToSpeech`, emits `assistant_message`, streams PCM `tts_chunk` events sentence-by-sentence, and terminates the turn with `tts_complete` plus a `status: idle` heartbeat.

## Server Architecture

- `packages/api/src/voice/streaming.ts` hosts the prototype.
- The server is started automatically when `VOICE_STREAMING_PROTO=1`. The port defaults to `8788` and can be overridden via `VOICE_STREAMING_PORT`.
- Each connection stores `{ sessionId, userId, runtimeContext, codec preferences }`, claims the shared voice session registry, and reuses the existing `VoiceSessionManager` so all PCM decoding, VAD, and buffering logic stays in one place. The registry keeps Drive Mode/web/CarPlay dashboards in sync with the streaming status.
- Audio chunks call `VoiceSession.processAudioChunk` (now returning VAD metadata) before emitting `partial_transcript` and `vad_state` updates.
- On `stop` (manual, silence, or timeout), the server emits a final transcript, runs `runAssistantForVoice`, streams PCM `tts_chunk` events via `TTSPool`, and finishes with `tts_complete` + `status: idle`.
- Logging lives under the `voice_stream_proto_*` keys (`voice_stream_proto_start`, `voice_stream_proto_chunk`, `voice_stream_proto_error`).

### Prototype Limitations

- Downstream audio is streamed as PCM chunks today. Negotiated MP3/Opus output will require per-chunk transcoding in a later iteration.
- Audio input must already be PCM; container decode (M4A/WebM) still happens client-side (browser/native can reuse the Milestone 1 converters before pushing PCM frames).
- Requires `VOICE_PROVIDER=local` so the Faster-Whisper pool is present. The server short-circuits with an error if local pools are unavailable.

## Client Usage

1. Start the API (or `bun dev`) with:

```bash
VOICE_PROVIDER=local \
VOICE_STREAMING_PROTO=1 \
VOICE_STREAMING_PORT=8788 \
bun dev
```

2. Connect via `wscat` or the browser console:

```bash
wscat -c ws://localhost:8788/voice/stream
> {"type":"start","language":"en"}
< {"type":"session_started","sessionId":"..."}
> {"type":"audio_chunk","audioBase64":"<pcm>","mimeType":"audio/pcm"}
< {"type":"partial_transcript","text":"hello"}
> {"type":"stop"}
< {"type":"final_transcript","text":"hello"}
```

3. On native/web, the recorder runs in short slices (≈600–1200 ms) and each slice is uploaded immediately. The server now accepts container formats, so the clients simply base64 encode the slice (`audio/m4a`, `audio/webm`, etc.). With `autoStop=true`, the server emits `auto_stop` as soon as Silero marks end-of-utterance; clients should stop recording, wait for `assistant_message`, and buffer PCM `tts_chunk` events for playback (native wraps them in WAV before calling `expo-av`, web streams them into an `AudioBufferSourceNode`).

### Native (Drive Mode + CarPlay)

- `useVoiceSessionNative` exposes `stream.start()` / `stream.stop()` plus live state (`status`, `transcript`, `assistantText`, `vadConfidence`). Press-and-hold now opens the streaming session; releasing calls `stream.stop()`.
- Drive Mode displays partial transcripts as `stream.transcript`, automatically transitions to "Thinking…" when the server stops the capture, and begins playback as `tts_chunk` events arrive (chunks are wrapped in temporary WAV files and queued through `expo-av`).
- The Drive UI also surfaces Silero’s VAD confidence and the latest auto-stop reason under a “Hands-free streaming” panel so drivers know whether the mic is armed, actively recording, or closed.
- CarPlay now prefers the streaming transport as well: the steering-wheel button calls `voice.stream.start()`, waits for `auto_stop`, and relays the streamed assistant text as soon as it arrives. If streaming is disabled or fails, the button falls back to the clip-based `speechToSpeech` flow automatically.
- The queue drain (background retry) continues to process clip-based jobs; streaming falls back to clip mode automatically when the WebSocket endpoint is unavailable.

- The web route now exposes two flows:
  - The original clip-based speech-to-speech button.
  - A "Streaming Prototype" button that toggles the WebSocket transport.
- The MediaRecorder runs with a `600 ms` `timeslice` and sends each blob as-is; PCM conversion happens server-side.
- Playback uses the Web Audio API: each PCM chunk becomes an `AudioBuffer`, queued via `AudioContext`, so the reply starts while Piper is still generating audio.
- The streaming card shows a live hands-free badge, a VAD meter, and the auto-stop reason so testers can tell when the transport is listening vs. when it has moved on to processing or playback.

## Future Work

- **Downstream codec negotiation**: streamed replies remain PCM for now to keep latency predictable. Once we can amortize encoder startup costs, add optional per-chunk MP3/Opus encoding and advertise it via `negotiatedCodec`.
- **Adaptive chunk sizing**: feed VAD state back to the client so it can stop sending silence.
- **Production deployment**: move from the dedicated Bun.serve instance to the shared API server, add health probes, and document scaling/limits.

## Validation

- Enable the prototype flag and run `wscat` as shown above. Speak into a local microphone, confirm that `partial_transcript` and `vad_state` events arrive during capture, `auto_stop` fires on silence, and `assistant_message` + `tts_chunk` events stream the reply while status transitions `recording → processing → playing → idle`.
- Monitor logs for `voice_stream_proto_chunk`, `voice_stream_proto_assistant_failed`, and `voice_stream_proto_tts_failed` to verify chunk routing and error propagation.
- Run `bun test packages/api/test/voice.streaming.test.ts` to cover the streaming auth helper and `bun test packages/api/test/voice/streaming.test.ts` for the session manager. Use `bun test packages/api/test/voice.s2s.test.ts` to ensure the clip-based API still works with the shared assistant helper.
