# Voice API

**Date:** November 21, 2025  
**Owners:** Voice / Native platform teams

This reference documents the backend voice endpoints exposed via the `voiceRouter` tRPC namespace. Pair it with the implementation notes in `docs/voice/s2s.md` (runbooks) and `docs/voice/streaming.md` (prototype transport).

## speechToSpeech mutation

`voice.speechToSpeech` orchestrates STT → assistant → TTS. It is exported as a tRPC mutation and is also reachable over HTTP POST at `/trpc/voice.speechToSpeech`. The server handles provider selection (`VOICE_PROVIDER=maya1|supertonic`), codec normalization, policy checks, and metrics.

### Request shape

| Field         | Type     | Notes                                                                                                                                 |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------ | -------- | ----------- | -------------------------------------------------------------------------------------------- |
| `audioBase64` | string   | Required. Base64 audio payload captured on the client. Containers such as WebM/Opus, MP3, WAV, or PCM are accepted.                   |
| `mimeType`    | string   | Required. Accurate MIME type for the encoded audio (e.g., `audio/webm;codecs=opus`). Used for codec detection before ffmpeg decoding. |
| `language`    | string?  | Optional ISO code forwarded to STT. Defaults to `en`.                                                                                 |
| `prompt`      | string?  | Optional system hint for STT (passed to Faster-Whisper).                                                                              |
| `thread`      | string?  | Optional thread identifier. Defaults to `voice:${userId}` when omitted.                                                               |
| `resource`    | string?  | Optional resource identifier for policy logging; mirrors `thread` by default.                                                         |
| `ttsVoice`    | string?  | Optional override for TTS voice (e.g., `en_US-lessac-medium`, `M1`).                                                                  |
| `ttsFormat`   | `"mp3"   | "opus"                                                                                                                                | "wav"`? | Optional output format. If omitted, defaults to `mp3`. |
| `model`       | string?  | Optional LLM model override. Uses assistant defaults when unset.                                                                      |
| `sessionId`   | string?  | Optional stable session identifier. If omitted, the server allocates one and returns it in the response.                              |
| `surface`     | `"drive" | "carplay"                                                                                                                             | "web"   | "native"                                               | "stream" | "unknown"`? | Optional hint describing the caller. Drives the session registry/metrics. Defaults to `web`. |
| `inputCodec`  | string?  | Optional client-declared capture codec (e.g., `audio/webm;codecs=opus`). When omitted, the server infers it from `mimeType`.          |
| `outputCodec` | string?  | Optional hint describing the desired synthesized format. Defaults to `ttsFormat`.                                                     |

### Response shape

```ts
type SpeechToSpeechResponse = {
  transcript: { text: string; model: string; durationSeconds?: number };
  assistant: { text: string; model: string };
  audio?: { audioBase64: string; mimeType: string; durationSeconds?: number };
  durations: {
    sttSeconds?: number | null;
    assistantSeconds?: number | null;
    ttsSeconds?: number | null;
    totalSeconds?: number | null;
  };
  session?: {
    id: string;
    surface: "drive" | "carplay" | "web" | "native" | "stream" | "unknown";
    status: "idle" | "recording" | "processing" | "responding" | "error";
    codec?: { input?: string; output?: string };
    createdAt: number;
    updatedAt: number;
    lastTranscript?: string;
    lastAssistantText?: string;
  };
};
```

### Policies & auth

- Requires an authenticated session; anonymous callers receive `UNAUTHORIZED`.
- Enforces both `requirePolicy("voice.stt")` and `requirePolicy("voice.tts")`. Callers must satisfy both scopes or the router rejects with `FORBIDDEN`.
- The streaming prototype (WebSocket) reuses the same policy evaluation (`voice.stt`, `voice.tts`) during the upgrade handshake, so Drive Mode/web streaming callers inherit identical access control.

### Codec handling

- Requests can send M4A/WebM/MP3/Opus/WAV/PCM. The router normalizes every local request through `packages/api/src/voice/codec.ts` so the Python STT server always sees 16 kHz mono PCM.
- Local TTS responses (PCM) are encoded back into the requested format. MIME types are accurate (`audio/mpeg`, `audio/ogg;codecs=opus`, `audio/wav`).

### Example (cURL)

```bash
curl \
  -X POST "http://localhost:3000/trpc/voice.speechToSpeech" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
--data '{"0":{"json":{"audioBase64":"<...>","mimeType":"audio/webm;codecs=opus","thread":"drive-mode","ttsVoice":"en_US-lessac-medium"}}}'
```

### Observability

- Logs: `voice speechToSpeech` (start + completion) include provider, duration, and error codes.
- Metrics: `voice_stream_latency_seconds` (labels: `stage=stt|llm|tts|speech_to_speech`).
- Queue drains on native append `voice QueueDrain` logs that reference this endpoint when retrying `kind:"s2s"` items.
- Session registry: every call either reuses the provided `sessionId` or provisions one. The response includes the current snapshot so clients can display continuity (Drive Mode, CarPlay, `/voice-s2s`). The registry also powers streaming status events.

### Tests

| Command                                                                | Coverage                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `bun test packages/api/test/voice.s2s.test.ts`                         | Mutation orchestration + error handling (OpenAI-mocked).                   |
| `bun test apps/web/src/hooks/__tests__/use-voice-session-web.test.tsx` | Web adapter calling the mutation and auto-playing the response.            |
| `bun test apps/web/src/routes/__tests__/voice-s2s.route.test.tsx`      | UI integration around `useVoiceSessionWeb`.                                |
| `bun test apps/native/lib/voice/__tests__/queue.test.ts`               | Drive Mode queue drain replaying `speechToSpeech` jobs.                    |
| `bun test packages/api/test/voice.streaming.test.ts`                   | Streaming authorization helper (session/policy gating).                    |
| `bun test packages/api/test/voice.session-registry.test.ts`            | Session registry bookkeeping (claim/update/complete + conflict detection). |

## sessions query

`voice.sessions` is a read-only authed procedure that surfaces the in-memory session registry for the current user.

- Input: optional `{ sessionId?: string }`. When supplied, the server returns at most one snapshot (or `[]` if the session isn’t owned by the caller).
- Output: `VoiceSessionDescriptor[]` (mirrors `session` from the `speechToSpeech` response).
- Use cases: render Drive Mode/CarPlay/web “hands-free” status on mount; recover session metadata after offline queue drains; debug codec negotiation.
- Example (tRPC):

```ts
const sessions = await trpcClient.voice.sessions.query();
console.log(sessions[0]?.status); // "idle" | "recording" | ...
```

The shared hooks expose this query via `voice.refreshSession()` (native) and `useVoiceSessionWeb().refreshSession()`.

## Streaming prototype

- File: `packages/api/src/voice/streaming.ts`.
- Flag: `VOICE_STREAMING_PROTO=1` enables a Bun WebSocket server on `VOICE_STREAMING_PORT` (default `8788`).
- Contract: See `docs/voice/streaming.md` for message types (`start`, `audio_chunk`, `vad_state`, `auto_stop`, `assistant_message`, `tts_chunk`, `tts_complete`, `status`, `error`).
- Input codecs: clients may send PCM, M4A, WebM/Opus, MP3, or WAV chunks. The server normalizes every chunk via ffmpeg before forwarding it to Faster-Whisper/Silero VAD.
- Output codecs: set `codec=mp3|opus|wav` in the `start` payload to have the server re-encode each `tts_chunk` before it leaves the socket; omit it (or use `pcm`) to continue receiving raw PCM for lowest latency.
- Authentication: WebSocket upgrade reuses the browser/native session cookies. The server enforces both `voice.stt` and `voice.tts` policies before accepting the connection, matching the mutation.
- Clients:
  - Drive Mode/CarPlay (`useVoiceSessionNative.stream`) automatically opt into streaming when the flag/env are set. The UI shows live transcripts + VAD and stops recording automatically when `auto_stop` arrives.
  - `/voice-s2s` exposes a "Streaming Prototype" button guarded by the same policy checks and env variables (`VITE_VOICE_STREAMING_URL` or default host:port).
- Session registry: every streaming connection claims a session record (matching the `sessionId` returned in `session_started`). Status transitions (`recording → processing → playing → idle`), transcripts, and assistant replies are mirrored into the registry so Drive Mode/web panels can reflect the active session even before clip-based S2S runs.
- Session registry: every streaming connection claims a session record (matching the `sessionId` returned in `session_started`). Status transitions (`recording → processing → playing → idle`), transcripts, and assistant replies are mirrored into the registry so Drive Mode/web panels can reflect the active session even before clip-based S2S runs.

## Local provider prerequisites

- Python 3.10+, `uv`, and the Faster-Whisper + Piper deps (`packages/voice/scripts/install-deps.sh`).
- Models: configure `WHISPER_MODEL_PATH`, `PIPER_MODEL_PATH`, `PIPER_VOICE`.
- `ffmpeg` available on `$PATH` or via `VOICE_FFMPEG_PATH` for codec conversion.
- See `docs/voice/s2s.md` for installation details and `docs/reference/native/voice.md` for Drive Mode specifics.
