# Voice Streaming Prototype

## Purpose

Provide a bidirectional transport that reduces round-trip latency between capture and spoken reply. The streaming layer lets clients deliver audio incrementally and receive status/transcript/playback events without waiting for an entire clip to upload.

This document describes the current WebSocket prototype, the message contract, and how it ties into the existing `VoiceSessionManager`. The goal is to de-risk Milestone 5 by standing up a working skeleton that future contributors can extend into full partial-transcript and streamed TTS delivery.

## Transport Summary

- **Protocol**: WebSocket (native Bun implementation via `Bun.serve`).
- **Endpoint**: `ws://<API_HOST>:<VOICE_STREAMING_PORT|8788>/voice/stream`.
- **Authentication**: Same as `voice.speechToSpeech`. The WebSocket upgrade reuses the tRPC session cookies, enforces both `voice.stt` and `voice.tts` policies, and rejects unauthenticated/unauthorized callers before the socket opens. Bring a real session cookie (e.g., from the browser) when testing.
- **Provider requirement**: Local voice provider (`VOICE_PROVIDER=local`). The prototype forwards audio chunks into the existing `VoiceSessionManager`, which in turn talks to the Faster-Whisper + Piper pools.
- **Lifecycle**:
  1. Client upgrades to WebSocket, receives `{"type":"ready","sessionId":null}`.
  2. Client sends `start` to allocate a session.
  3. Client streams `audio_chunk` events (base64 PCM, 16 kHz mono).
  4. Client sends `stop` to flush transcription and tear down.
  5. Server emits `partial_transcript`, `final_transcript`, and status/error events.

## Message Contract

All frames are UTF-8 JSON. Prototype types:

### Client → Server

```json
{ "type": "start",
  "sessionId": "optional",
  "language": "en",
  "codec": "pcm|mp3|opus|wav",
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
  - `codec`: preferred outbound codec. The server currently advertises `pcm` in `session_started` but the field is future-proof.
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
{ "type": "tts_chunk", "sessionId": "uuid", "audioBase64": "...", "mimeType": "audio/pcm", "sequence": 0, "isLast": false }
{ "type": "tts_complete", "sessionId": "uuid" }
{ "type": "status", "sessionId": "uuid", "state": "recording|processing|playing|idle" }
{ "type": "error", "sessionId": "uuid", "message": "..." }
{ "type": "pong" }
```

The prototype keeps transcripts in memory via `VoiceSession.getTranscript()`. `partial_transcript` is emitted immediately after each `audio_chunk`, `vad_state` mirrors Silero’s confidence scores, and `auto_stop` fires when silence persists or `maxUtteranceMs` elapses. After `final_transcript`, the server runs the same assistant pipeline as `voice.speechToSpeech`, emits `assistant_message`, streams PCM `tts_chunk` events sentence-by-sentence, and terminates the turn with `tts_complete` plus a `status: idle` heartbeat.

## Server Architecture

- `packages/api/src/voice/streaming.ts` hosts the prototype.
- The server is started automatically when `VOICE_STREAMING_PROTO=1`. The port defaults to `8788` and can be overridden via `VOICE_STREAMING_PORT`.
- Each connection stores `{ sessionId, userId, runtimeContext, codec preferences }` and reuses the existing `VoiceSessionManager` so all PCM decoding, VAD, and buffering logic stays in one place.
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

3. On native/web, reuse the existing capture pipelines, but stop the recorder every few hundred milliseconds and send each chunk as PCM. With `autoStop=true`, the server emits `auto_stop` as soon as VAD marks end-of-utterance; clients should immediately stop recording, wait for `assistant_message`, and begin buffering `tts_chunk` audio for playback.

## Future Work

- **Codec negotiation**: accept containerized chunk uploads (M4A/WebM) and transcode server-side via the ffmpeg helper, and honor downstream codec preferences so MP3/Opus clients can avoid PCM decoding.
- **Adaptive chunk sizing**: feed VAD state back to the client so it can stop sending silence.
- **Production deployment**: move from the dedicated Bun.serve instance to the shared API server, add health probes, and document scaling/limits.

## Validation

- Enable the prototype flag and run `wscat` as shown above. Speak into a local microphone, confirm that `partial_transcript` and `vad_state` events arrive during capture, `auto_stop` fires on silence, and `assistant_message` + `tts_chunk` events stream the reply while status transitions `recording → processing → playing → idle`.
- Monitor logs for `voice_stream_proto_chunk`, `voice_stream_proto_assistant_failed`, and `voice_stream_proto_tts_failed` to verify chunk routing and error propagation.
- Run `bun test packages/api/test/voice.streaming.test.ts` to cover the streaming auth helper and `bun test packages/api/test/voice/streaming.test.ts` for the session manager. Use `bun test packages/api/test/voice.s2s.test.ts` to ensure the clip-based API still works with the shared assistant helper.
