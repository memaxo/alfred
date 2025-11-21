# Voice Streaming Prototype

## Purpose

Provide a bidirectional transport that reduces round-trip latency between capture and spoken reply. The streaming layer lets clients deliver audio incrementally and receive status/transcript/playback events without waiting for an entire clip to upload.

This document describes the current WebSocket prototype, the message contract, and how it ties into the existing `VoiceSessionManager`. The goal is to de-risk Milestone 5 by standing up a working skeleton that future contributors can extend into full partial-transcript and streamed TTS delivery.

## Transport Summary

- **Protocol**: WebSocket (native Bun implementation via `Bun.serve`).
- **Endpoint**: `ws://<API_HOST>:<VOICE_STREAMING_PORT|8788>/voice/stream`.
- **Authentication**: Prototype only; the server trusts the caller. The production version will require the same session policy as `voice.speechToSpeech` (tRPC cookies + `voice.stt`/`voice.tts` scopes).
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
{ "type": "start", "sessionId": "optional", "language": "en" }
{ "type": "audio_chunk", "audioBase64": "...", "mimeType": "audio/pcm", "emitPartial": true }
{ "type": "stop" }
{ "type": "ping" }
```

- `start`
  - `sessionId` (optional): supply to resume an abandoned session; otherwise the server generates one.
  - `language`: passed to `VoiceSessionManager.createSession` for Faster-Whisper hints.
- `audio_chunk`
  - `audioBase64`: Base64 PCM (`s16le`, 16 kHz, mono). Clients should transcode before sending (mirrors Milestone 1 codec rules).
  - `mimeType`: Defaults to `audio/pcm`; currently informative only.
  - `emitPartial`: Set `false` to skip per-chunk transcript pushes.
- `stop`: Flushes transcription, emits `final_transcript`, and closes the session.
- `ping`: Health probe (server responds with `pong`).

### Server → Client

```json
{ "type": "ready", "sessionId": null }
{ "type": "session_started", "sessionId": "uuid" }
{ "type": "partial_transcript", "sessionId": "uuid", "text": "..." }
{ "type": "final_transcript", "sessionId": "uuid", "text": "..." }
{ "type": "status", "sessionId": "uuid", "state": "recording|processing|idle" }
{ "type": "error", "sessionId": "uuid", "message": "..." }
{ "type": "pong" }
```

The prototype keeps transcripts in memory via `VoiceSession.getTranscript()`; `partial_transcript` is emitted immediately after each `audio_chunk`, and `final_transcript` is issued when the client calls `stop` or disconnects cleanly.

## Server Architecture

- `packages/api/src/voice/streaming.ts` hosts the prototype.
- The server is started automatically when `VOICE_STREAMING_PROTO=1`. The port defaults to `8788` and can be overridden via `VOICE_STREAMING_PORT`.
- Each connection stores `{ sessionId, userId }` and reuses the existing `VoiceSessionManager` so all PCM decoding, VAD, and buffering logic stays in one place.
- Audio chunks call `VoiceSession.processAudioChunk`, followed by a snapshot of `session.getTranscript()`.
- On `stop`/disconnect, the server emits a final transcript and removes the session from the manager.
- Logging lives under the `voice_stream_proto_*` keys (`voice_stream_proto_start`, `voice_stream_proto_chunk`, `voice_stream_proto_error`).

### Prototype Limitations

- No authentication or rate limiting.
- Only transcription events are sent; TTS streaming is not yet implemented.
- Audio must already be PCM; container decode (M4A/WebM) still happens client-side (browser/native can reuse the Milestone 1 converters before pushing PCM frames).
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

3. On native/web, reuse the existing capture pipelines, but stop the recorder every few hundred milliseconds and send each chunk as PCM. The Milestone 3 `useVoiceSessionWeb` hook is a natural place to experiment with this by adding a `speechToSpeechStream` mode.

## Future Work

- **Authentication & policy**: reuse the tRPC session cookie, enforce `voice.stt`/`voice.tts` policies, and attach request IDs for observability.
- **Downstream streaming**: push incremental TTS chunks back to the client (AudioWorklet on web / AVAudioEngine on native).
- **Codec negotiation**: accept containerized chunk uploads (M4A/WebM) and transcode server-side via the ffmpeg helper.
- **Adaptive chunk sizing**: feed VAD state back to the client so it can stop sending silence.
- **Production deployment**: move from the dedicated Bun.serve instance to the shared API server, add health probes, and document scaling/limits.

## Validation

- Enable the prototype flag and run `wscat` as shown above. Speak into a local microphone, confirm that `partial_transcript` arrives during capture and `final_transcript` matches the clip when stopped.
- Monitor logs for `voice_stream_proto_chunk` and `voice_stream_proto_error` to verify chunk routing and error propagation.
- Use the existing `voice.speechToSpeech` tests for non-streaming regression; once the streaming endpoints mature, add integration tests that exercise partial transcripts end-to-end.
