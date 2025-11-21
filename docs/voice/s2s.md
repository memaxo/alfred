# Speech-to-Speech (S2S) Quick Start

This guide explains how to run the end-to-end speech-to-speech pipeline across providers (OpenAI vs local Faster-Whisper/Piper) and across surfaces (web, native Drive Mode, CarPlay). Pair this with `docs/voice/streaming.md` if you need the streaming prototype.

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
| `VOICE_PROVIDER` | `openai` (default) or `local` |
| `OPENAI_API_KEY` | Required for OpenAI STT/TTS |
| `WHISPER_MODEL_PATH` | Faster-Whisper model path (local) |
| `PIPER_MODEL_PATH` / `PIPER_VOICE` | Piper model + voice |
| `VOICE_FFMPEG_PATH` | Optional path override for `ffmpeg` |
| `VOICE_STREAMING_PROTO` | `1` to enable the WebSocket streaming prototype |
| `VOICE_STREAMING_PORT` | Port for the prototype server (default `8788`) |

## Installing Local Models

```bash
cd packages/voice
./scripts/install-deps.sh        # installs Python deps via uv
python3 scripts/download_models.py
```

The script downloads `large-v3-turbo` for Faster-Whisper and `en_US-lessac-medium` for Piper. Update the env vars above if you change model locations.

## Running the API

```bash
cd packages/api
VOICE_PROVIDER=openai bun dev            # OpenAI path
VOICE_PROVIDER=local bun dev             # Local path
VOICE_PROVIDER=local \
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

### Drive Mode queue drain coverage

- Queue drain happens in three places:
  1. `registerQueueDrain` schedules a background fetch task that invokes `drain(processPendingItem)` every few minutes while Drive Mode is installed.
  2. An `AppState` listener in `apps/native/app/(drawer)/(tabs)/drive.tsx` forces an immediate drain when the app returns to the foreground so queued clips replay without waiting for the background task.
  3. Manual drains run whenever the Drive Mode screen mounts to keep the queue empty before the user speaks.
- Tests live at `apps/native/lib/voice/__tests__/queue.test.ts` and can be run directly via `bun test apps/native/lib/voice/__tests__/queue.test.ts`. The suite covers successful `s2s` job replays, exponential backoff, and retry bookkeeping so Drive Mode and CarPlay share a proven queue.
- Logs are prefixed with `voice QueueDrain` (see `drive.tsx`) to make it obvious when replay succeeds or fails; include these logs when filing Drive Mode bugs.

## CarPlay

- CarPlay uses the same `useVoiceSessionNative` abstraction. When CarPlay is connected, pressing the mic button triggers `speechToSpeech`; otherwise it falls back to stop-and-transcribe.
- Test with a physical device + CarPlay head unit or an iOS simulator paired with the CarPlay simulator.

## Streaming Prototype (optional)

Follow `docs/voice/streaming.md` for the WebSocket contract. Minimal sample:

```bash
wscat -c ws://localhost:8788/voice/stream
> {"type":"start","language":"en"}
> {"type":"audio_chunk","audioBase64":"<pcm>","mimeType":"audio/pcm"}
> {"type":"stop"}
```

You should see `partial_transcript` and `final_transcript` events in real time.

## Validation Checklist

- `bun test test/session.core.test.ts` (packages/voice) – shared session core.
- `bun test test/voice.s2s.test.ts` (packages/api) – S2S mutation.
- Drive Mode or CarPlay returns a spoken reply with `VOICE_PROVIDER=openai` and `VOICE_PROVIDER=local`.
- `/voice-s2s` route in the web app records, transcribes, and plays a reply.
- (Optional) streaming prototype returns `partial_transcript` events while audio chunks are in flight.
- `bun test apps/native/lib/voice/__tests__/queue.test.ts` – native queue enqueue/drain logic.
