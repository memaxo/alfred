# Speech-to-Speech (S2S) Quick Start

This guide explains how to run the end-to-end speech-to-speech pipeline across the local model stacks (Maya1 vs Supertonic) and across surfaces (web, native Drive Mode, CarPlay). Pair this with `docs/voice/streaming.md` if you need the streaming prototype.

## Prerequisites

| Requirement | Purpose |
| --- | --- |
| Bun 1.2.18+ | API + web dev servers |
| Node 20+ (optional) | Expo tooling |
| Python 3.10+ with [`uv`](https://github.com/astral-sh/uv) | Local STT/TTS models |
| `ffmpeg` 6+ | Transcoding between PCM and client codecs |
| Expo CLI + iOS/Android simulators | Drive Mode + CarPlay testing |

## Environment Variables

| Variable | Description |
| --- | --- |
| `VOICE_PROVIDER` | `maya1` (default) or `supertonic` (lightweight ONNX TTS) |
| `WHISPER_MODEL_PATH` | Faster-Whisper model path (local) |
| `PIPER_MODEL_PATH` / `PIPER_VOICE` | Piper model + voice |
| `VOICE_FFMPEG_PATH` | Optional path override for `ffmpeg` |
| `VOICE_STREAMING_PROTO` | `1` to enable the WebSocket streaming prototype |
| `VOICE_STREAMING_PORT` | Port for the prototype server (default `8788`) |
| `EXPO_PUBLIC_SERVER_URL` / `EXPO_PUBLIC_VOICE_STREAM_URL` | Expo native app API + streaming endpoints |
| `VITE_VOICE_STREAMING_URL` / `VITE_VOICE_STREAMING_PORT` | Optional overrides for the web streaming endpoint |

## Session management

- Clients now send an optional `sessionId` + `surface` with every `speechToSpeech` call (or streaming `start` event). When omitted, the server allocates an ID and returns a snapshot alongside the transcript/audio payload.
- The API keeps an in-memory registry keyed by `{userId, sessionId}` so Drive Mode, CarPlay, and the `/voice-s2s` route can display continuity: current status (`recording`, `processing`, `responding`), last transcript/assistant text, and codec hints.
- Hook APIs surface the snapshot as `voice.session` (native) or `useVoiceSessionWeb().session`. Native queue replays preserve `sessionId` so offline jobs update the same record once they succeed.
- Query `voice.sessions` (tRPC) any time you need to refresh the current snapshot without waiting for another mutation/stream. The web/native adapters call this on mount and expose `refreshSession()` helpers that simply refetch the list and update their panels.

## Installing Local Models

```bash
cd packages/voice
./scripts/install-deps.sh        # installs Python deps via uv
python3 scripts/download_models.py
```

The script downloads `large-v3-turbo` for Faster-Whisper and `en_US-lessac-medium` for Piper. Update the env vars above if you change model locations.

## Local validation scripts (macOS)

Use these when validating the local voice runtime on Apple Silicon (MPS) without starting the full web/native stack:

```bash
cd /path/to/alfred
export VOICE_PROVIDER=maya1 WHISPER_DEVICE=mps ALFRED_API_AUTO_INIT=false
bun scripts/voice/validate.ts      # explicit pools + STT/TTS cold/warm + saves tmp/voice/tts.wav
bun scripts/voice/verify-runtime.ts # stable runtime check (STT via `say`, TTS + PCM decode)
```

Notes:
- The Python STT subprocess consumes **PCM16**; prefer `transcribeLocal()`/`voice.sttTranscribe` (they decode containers via `decodeToPCM16`) over calling `STTPool.transcribe` with WAV/WebM bytes.

## Running the API

```bash
cd packages/api
VOICE_PROVIDER=maya1 bun dev
VOICE_PROVIDER=maya1 \
  VOICE_STREAMING_PROTO=1 \
  VOICE_STREAMING_PORT=8788 \
  bun dev                                # Local + streaming prototype
```

Key commands:
- `bun test test/voice.s2s.test.ts` – regression test for the `speechToSpeech` mutation.
- `bun test test/voice/codec.test.ts` – verifies ffmpeg-based transcoding.

## Web (apps/web)

1. Start the API as above.
2. In another terminal:

   ```bash
   cd apps/web
   bun dev
   ```

3. Visit `http://localhost:3000/voice-s2s`.
   - Click the large button to start recording. The button state reflects `idle → recording → processing`.
   - Release to call `voice.speechToSpeech`; the transcript and assistant reply appear, and the synthesized reply plays automatically.
   - Toggle the "Streaming Prototype" button to exercise the WebSocket transport (`VOICE_STREAMING_PROTO=1`). Partial transcripts and VAD confidence update in real time, and the reply audio starts playing sentence-by-sentence while Piper is still generating.
   - The streaming panel includes a hands-free status badge plus a VAD meter so you can verify that auto-stop is armed before you take your finger off the mouse. Auto-stop reasons (silence/timeout/manual) are displayed inline whenever the transport releases the mic.
   - A session card under the controls mirrors the registry snapshot (ID, surface, last update). This mirrors the native panels so QA can correlate Drive Mode + web behavior quickly.

## Native Drive Mode

1. Ensure `EXPO_PUBLIC_SERVER_URL` points to your API instance.
2. Start Expo:

   ```bash
   cd apps/native
   bun start
   ```

3. In Drive Mode:
   - Hold the mic button to capture audio; on release, Drive Mode calls `voice.speechToSpeech` (falling back to legacy STT/TTS if unavailable).
   - Offline recordings are queued as `kind: "s2s"` jobs and retried automatically when the device regains connectivity. The queue uses exponential backoff (starting at 1s, max 30s) and persists in `AsyncStorage` under `voice:queue:v1`.
   - When `VOICE_STREAMING_PROTO=1` and `EXPO_PUBLIC_VOICE_STREAM_URL` (or `EXPO_PUBLIC_SERVER_URL`) is reachable, the same mic button uses the streaming transport. Partial transcripts update live, `auto_stop` releases the mic automatically on silence, and PCM `tts_chunk` events start playing immediately (Drive Mode wraps them in WAV and queues them through `expo-av` so replies overlap generation).
   - The Drive UI now surfaces a “Hands-free streaming” panel that shows the live VAD confidence (Silero probability), the current streaming status, the latest auto-stop reason, and the active `sessionId` + timestamp. Drivers immediately know when the mic is armed vs. when the assistant is responding without guessing.

### Drive Mode queue drain coverage

- Queue drain happens in three places:
  1. `registerQueueDrain` schedules a background fetch task that invokes `drain(processPendingItem)` every few minutes while Drive Mode is installed.
  2. An `AppState` listener in `apps/native/app/(drawer)/(tabs)/drive.tsx` forces an immediate drain when the app returns to the foreground so queued clips replay without waiting for the background task.
  3. Manual drains run whenever the Drive Mode screen mounts to keep the queue empty before the user speaks.
- Tests live at `apps/native/lib/voice/__tests__/queue.test.ts` and can be run directly via `bun test apps/native/lib/voice/__tests__/queue.test.ts`. The suite covers successful `s2s` job replays, exponential backoff, and retry bookkeeping so Drive Mode and CarPlay share a proven queue.
- Logs are prefixed with `voice QueueDrain` (see `drive.tsx`) to make it obvious when replay succeeds or fails; include these logs when filing Drive Mode bugs.

## CarPlay

- CarPlay uses the same `useVoiceSessionNative` abstraction. When streaming is enabled (`VOICE_STREAMING_PROTO=1` + native env vars), the CarPlay voice control button now calls `voice.stream.start()` and waits for the server’s `auto_stop` / `tts_chunk` events before surfacing the reply, so the driver never has to hold the button. If streaming fails or is disabled, the module falls back to the legacy start → stop-and-transcribe flow automatically.
- Test with a physical device + CarPlay head unit or an iOS simulator paired with the CarPlay simulator.

## Streaming Prototype (optional)

Follow `docs/voice/streaming.md` for the WebSocket contract. Minimal sample:

```bash
wscat -c ws://localhost:8788/voice/stream
> {"type":"start","language":"en"}
> {"type":"audio_chunk","audioBase64":"<pcm>","mimeType":"audio/pcm"}
> {"type":"stop"}
```

You should see `partial_transcript`, `vad_state`, and `final_transcript` events in real time. The Drive Mode + `/voice-s2s` UIs provide buttons to exercise the prototype without touching `wscat`.

## Validation Checklist

- `bun test test/session.core.test.ts` (packages/voice) – shared session core.
- `bun test test/voice.s2s.test.ts` (packages/api) – S2S mutation.
- Drive Mode or CarPlay returns a spoken reply with `VOICE_PROVIDER=maya1` (default) and `VOICE_PROVIDER=supertonic` (optional ONNX path).
- `/voice-s2s` route in the web app records, transcribes, and plays a reply.
- (Optional) streaming prototype returns `partial_transcript` events while audio chunks are in flight.
- `bun test packages/api/test/voice.streaming.test.ts` – streaming auth/policy helper.
- `bun test apps/native/lib/voice/__tests__/queue.test.ts` – native queue enqueue/drain logic.
