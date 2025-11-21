# Voice API

**Date:** November 21, 2025  
**Owners:** Voice / Native platform teams

This reference documents the backend voice endpoints exposed via the `voiceRouter` tRPC namespace. Pair it with the implementation notes in `docs/voice/s2s.md` (runbooks) and `docs/voice/streaming.md` (prototype transport).

## speechToSpeech mutation

`voice.speechToSpeech` orchestrates STT → assistant → TTS. It is exported as a tRPC mutation and is also reachable over HTTP POST at `/trpc/voice.speechToSpeech`. The server handles provider selection (`VOICE_PROVIDER=openai|local`), codec normalization, policy checks, and metrics.

### Request shape

| Field | Type | Notes |
| --- | --- | --- |
| `audioBase64` | string | Required. Base64 audio payload captured on the client. Containers such as WebM/Opus, MP3, WAV, or PCM are accepted. |
| `mimeType` | string | Required. Accurate MIME type for the encoded audio (e.g., `audio/webm;codecs=opus`). Used for codec detection before ffmpeg decoding. |
| `language` | string? | Optional ISO code forwarded to STT. Defaults to `en`. |
| `prompt` | string? | Optional system hint for STT (passed to Faster-Whisper/OpenAI). |
| `thread` | string? | Optional thread identifier. Defaults to `voice:${userId}` when omitted. |
| `resource` | string? | Optional resource identifier for policy logging; mirrors `thread` by default. |
| `ttsVoice` | string? | Optional override for TTS voice (e.g., `alloy`). |
| `ttsFormat` | `"mp3" | "opus" | "wav"`? | Optional output format. If omitted, defaults to `mp3`. |
| `model` | string? | Optional LLM model override. Uses assistant defaults when unset. |

### Response shape

```ts
type SpeechToSpeechResponse = {
  transcript: { text: string; model: string; durationSeconds?: number };
  assistant: { text: string; model: string };
  audio?: { audioBase64: string; mimeType: string; durationSeconds?: number };
  metrics: {
    sttSeconds: number;
    llmSeconds: number;
    ttsSeconds: number;
    totalSeconds: number;
  };
};
```

### Policies & auth

- Requires an authenticated session; anonymous callers receive `UNAUTHORIZED`.
- Enforces both `requirePolicy("voice.stt")` and `requirePolicy("voice.tts")`. Callers must satisfy both scopes or the router rejects with `FORBIDDEN`.
- The streaming prototype currently relies on session cookies but skips explicit policy checks; do not expose it publicly without adding the same gates.

### Codec handling

- Requests can send M4A/WebM/MP3/Opus/WAV/PCM. The router normalizes every local request through `packages/api/src/voice/codec.ts` so the Python STT server always sees 16 kHz mono PCM.
- Local TTS responses (PCM) are encoded back into the requested format. MIME types are accurate (`audio/mpeg`, `audio/ogg;codecs=opus`, `audio/wav`).

### Example (cURL)

```bash
curl \
  -X POST "http://localhost:3000/trpc/voice.speechToSpeech" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookies>" \
  --data '{"0":{"json":{"audioBase64":"<...>","mimeType":"audio/webm;codecs=opus","thread":"drive-mode","ttsVoice":"alloy"}}}'
```

### Observability

- Logs: `voice speechToSpeech` (start + completion) include provider, duration, and error codes.
- Metrics: `voice_stream_latency_seconds` (labels: `stage=stt|llm|tts|speech_to_speech`).
- Queue drains on native append `voice QueueDrain` logs that reference this endpoint when retrying `kind:"s2s"` items.

### Tests

| Command | Coverage |
| --- | --- |
| `bun test packages/api/test/voice.s2s.test.ts` | Mutation orchestration + error handling (OpenAI-mocked). |
| `bun test apps/web/src/hooks/__tests__/use-voice-session-web.test.tsx` | Web adapter calling the mutation and auto-playing the response. |
| `bun test apps/web/src/routes/__tests__/voice-s2s.route.test.tsx` | UI integration around `useVoiceSessionWeb`. |
| `bun test apps/native/lib/voice/__tests__/queue.test.ts` | Drive Mode queue drain replaying `speechToSpeech` jobs. |

## Streaming prototype

- File: `packages/api/src/voice/streaming.ts`.
- Flag: `VOICE_STREAMING_PROTO=1` enables a Bun WebSocket server on `VOICE_STREAMING_PORT` (default `8788`).
- Contract: See `docs/voice/streaming.md` for message types (`start`, `audio_chunk`, `stop`, `partial_transcript`, `final_transcript`).
- Status: Prototype only—no auth/policy checks yet, PCM-only input, and outbound TTS streaming is not implemented.

## Local provider prerequisites

- Python 3.10+, `uv`, and the Faster-Whisper + Piper deps (`packages/voice/scripts/install-deps.sh`).
- Models: configure `WHISPER_MODEL_PATH`, `PIPER_MODEL_PATH`, `PIPER_VOICE`.
- `ffmpeg` available on `$PATH` or via `VOICE_FFMPEG_PATH` for codec conversion.
- See `docs/voice/s2s.md` for installation details and `docs/reference/native/voice.md` for Drive Mode specifics.

