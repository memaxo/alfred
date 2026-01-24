# Voice Integration Guide

Complete guide for integrating ALFRED's voice capabilities into web and native applications.

## Overview

ALFRED's voice system provides:

- **STT (Speech-to-Text)**: Nemotron Speech Streaming (0.6B parameters, cache-aware streaming)
- **TTS (Text-to-Speech)**: Maya1 (MLX on macOS) or Supertonic (lightweight ONNX fallback)
- **S2S (Speech-to-Speech)**: End-to-end voice conversation with assistant integration

## Quick Start

### Web App

```tsx
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";

function VoiceButton() {
  const { stream, state } = useVoiceSessionWeb();

  const handlePress = async () => {
    if (!stream.isActive) {
      await stream.start();
    } else {
      await stream.stop();
      console.log("Transcription:", stream.transcript);
    }
  };

  return (
    <button onClick={handlePress}>{stream.isActive ? "Stop" : "Start"}</button>
  );
}
```

### Native App (React Native / Expo)

```tsx
import { useVoiceSessionNative } from "@/lib/voice/session";
import { trpc } from "@/utils/trpc";

function VoiceButton() {
  const { stream } = useVoiceSessionNative(trpc);

  const handlePress = async () => {
    if (!stream.isActive) {
      await stream.start();
    } else {
      await stream.stop();
      console.log("Transcription:", stream.transcript);
    }
  };

  return (
    <Pressable onPress={handlePress}>
      <Text>{stream.isActive ? "Stop" : "Start"}</Text>
    </Pressable>
  );
}
```

## API Endpoints

All voice endpoints are exposed via tRPC at `voice.*`:

### Basic Transcription

```typescript
// Batch transcription (non-streaming)
const result = await trpc.voice.sttTranscribe.mutate({
  audioBase64: "...", // Base64-encoded audio
  mimeType: "audio/webm", // Or audio/pcm, audio/wav, etc.
  language: "en", // Optional language hint
});

console.log(result.text); // "Hello, how are you?"
console.log(result.provider); // "nemotron"
console.log(result.model); // "nvidia/nemotron-speech-streaming-en-0.6b"
```

### Streaming Transcription (Real-time)

For lower latency and progressive results:

```typescript
// Start a streaming session
const sessionId = crypto.randomUUID();

// Send audio chunks as they arrive
const result = await trpc.voice.sttTranscribeStreaming.mutate({
  audioBase64: chunk,
  mimeType: "audio/pcm",
  sessionId, // Same ID routes to same worker
  chunkSize: "medium", // "fast" | "low" | "medium" | "accurate"
  clearCache: false, // Set true for new utterance
});

console.log(result.text); // Current transcription
console.log(result.isPartial); // true for intermediate results

// Clear cache when starting new utterance
await trpc.voice.sttClearCache.mutate({ sessionId });

// Release session when done
await trpc.voice.sttReleaseSession.mutate({ sessionId });
```

### Text-to-Speech

```typescript
const result = await trpc.voice.ttsSynthesize.mutate({
  text: "Hello! How can I help you today?",
  voice: "en_US-lessac-medium", // Piper voice
  format: "mp3", // "mp3" | "opus" | "wav"
});

// Play the audio
const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
await audio.play();
```

### Speech-to-Speech (Full Conversation)

For complete voice conversations with the assistant:

```typescript
const result = await trpc.voice.speechToSpeech.mutate({
  audioBase64: recordedAudio,
  mimeType: "audio/webm",
  thread: "thread-id", // Optional conversation thread
  ttsVoice: "en_US-lessac-medium",
  ttsFormat: "mp3",
});

console.log(result.transcript.text); // What user said
console.log(result.assistant.text); // What assistant replied
// result.audio contains the spoken response
```

### Health Check

Monitor voice pipeline health:

```typescript
const health = await trpc.voice.health.query({
  runRoundtrip: true, // Optional: run TTS→STT test
});

console.log(health.stt.ok); // true if STT workers healthy
console.log(health.tts.ok); // true if TTS workers healthy
console.log(health.roundtrip?.latencyMs); // Pipeline latency
```

## Session Affinity (Streaming)

Nemotron's cache-aware streaming requires session affinity:

1. **Same `sessionId`** routes requests to the same worker process
2. Worker maintains decoder state between chunks
3. **Call `sttClearCache`** when starting a new utterance
4. **Call `sttReleaseSession`** when the session ends

```typescript
// Streaming session lifecycle
const sessionId = crypto.randomUUID();

// Stream audio chunks
for (const chunk of audioChunks) {
  const result = await trpc.voice.sttTranscribeStreaming.mutate({
    audioBase64: chunk,
    mimeType: "audio/pcm",
    sessionId,
  });
  updateUI(result.text);
}

// User pauses - clear cache for next utterance
await trpc.voice.sttClearCache.mutate({ sessionId });

// Session ends
await trpc.voice.sttReleaseSession.mutate({ sessionId });
```

## WebSocket Streaming Start Payload (Advanced)

When using the WebSocket streaming protocol (`/voice/stream`), the client sends a `start` event.
You can tune Nemotron latency vs accuracy via `sttChunkSize`:

```typescript
// Sent over WebSocket as JSON
{
  _: "start",
  sessionId: "uuid",
  surface: "web",
  // Streaming output codec (current clients expect PCM16)
  codec: "pcm",
  // Incoming audio mime-type (required for binary frames)
  inputMimeType: "audio/raw;codec=pcm_s16le;rate=16000",
  // Nemotron streaming chunk size:
  // "fast" | "low" | "medium" | "accurate"
  sttChunkSize: "fast",
  vadThreshold: 0.5,
  maxUtteranceMs: 20_000,
}
```

## Chunk Size Configuration

Balance latency vs accuracy with `chunkSize`:

| Chunk Size | Latency | Accuracy | Use Case                  |
| ---------- | ------- | -------- | ------------------------- |
| `fast`     | ~80ms   | Lower    | Real-time dictation       |
| `low`      | ~160ms  | Medium   | Quick commands            |
| `medium`   | ~560ms  | Good     | General use (default)     |
| `accurate` | ~1.1s   | Highest  | High-stakes transcription |

## Audio Format Requirements

### STT Input

- **Sample rate**: 16kHz (resampling handled automatically)
- **Format**: PCM16 (mono), WebM, WAV, or Opus
- **Max size**: 5 MiB per request

### TTS Output

- **Sample rate**: 24kHz (Maya1) or varies (Supertonic)
- **Format**: MP3, Opus, or WAV

## Web Hooks

### `useVoiceSessionWeb`

Main hook for web voice sessions:

```typescript
const {
  start, // Start recording
  stopAndTranscribe, // Stop and get transcription
  speak, // Synthesize and play text
  speechToSpeech, // Full S2S conversation
  clear, // Reset session
  state, // { capture, transcript, playback }
} = useVoiceSessionWeb({
  defaultVoice: "en_US-lessac-medium",
  onTranscript: (text) => console.log("Got:", text),
  onError: (error) => console.error("Voice error:", error),
});
```

### `useVoiceCapture`

Simplified capture-only hook:

```typescript
const { isRecording, startCapture, stopCapture, transcript } = useVoiceCapture({
  onTranscript: (text) => setInput(text),
});
```

## Native Integration

### Platform Adapter

Native apps implement `PlatformAdapter`:

```typescript
interface PlatformAdapter {
  configureSession(): Promise<void>;
  startCapture(): Promise<void>;
  stopCapture(): Promise<{ audioBase64: string; mimeType: string }>;
  play(audioBase64: string, mimeType: string): Promise<void>;
}
```

### Expo Audio

For Expo apps, use `ExpoCapture` from `@/lib/voice/capture`:

```typescript
import { ExpoCapture } from "@/lib/voice/capture";

const adapter = new ExpoCapture();
await adapter.configureSession();
await adapter.startCapture();
// ... recording ...
const { audioBase64, mimeType } = await adapter.stopCapture();
```

## Troubleshooting

### STT Returns Empty Transcriptions

1. **Check audio duration**: Very short audio (<0.5s) may not transcribe
2. **Check audio levels**: Silent audio won't produce output
3. **Verify sample rate**: Ensure 16kHz PCM or let API resample

```typescript
// Debug: Log audio info before transcription
const buffer = Buffer.from(audioBase64, "base64");
const samples = buffer.length / 2; // PCM16 = 2 bytes per sample
const durationSec = samples / 16000;
console.log(`Audio: ${durationSec.toFixed(2)}s, ${buffer.length} bytes`);
```

### TTS Generates Truncated Audio

1. **Try Supertonic**: Set `TTS_PROVIDER=supertonic` for more reliable synthesis
2. **Wait for warmup**: First synthesis after cold start may be slow
3. **Check text length**: Very long text (>600 chars) is rejected

### High Latency

1. **Use streaming**: `sttTranscribeStreaming` for progressive results
2. **Reduce chunk size**: Use `chunkSize: "fast"` for lower latency
3. **Check pool size**: Increase `VOICE_STT_POOL_SIZE` if saturated

### Pool Saturated Errors

If you see `voice_stt_pool_saturated`:

1. Increase pool size: `VOICE_STT_POOL_SIZE=4`
2. Add backpressure in client code
3. Release sessions promptly with `sttReleaseSession`

## Environment Variables

```bash
# Production deployment (recommended)
# - Proxy `/voice/stream` through the main domain (no extra public port)
# - Enable streaming server
VOICE_STREAMING_PROTO=1

# Optional dev fallback (direct port)
# VITE_VOICE_STREAMING_PORT=8788
# EXPO_PUBLIC_VOICE_STREAM_PORT=8788

# STT Configuration
VOICE_STT_MODEL=nvidia/nemotron-speech-streaming-en-0.6b
VOICE_STT_DEVICE=auto  # auto, cpu, cuda, mps
VOICE_STT_POOL_SIZE=2
VOICE_STT_CHUNK_SIZE=medium  # fast, low, medium, accurate

# TTS Configuration
TTS_PROVIDER=maya1  # maya1 or supertonic
VOICE_TTS_VOICE=en_US-lessac-medium

# General
VOICE_PROVIDER=maya1  # Default provider
```

## Performance Budgets

| Operation       | Target | Notes                  |
| --------------- | ------ | ---------------------- |
| STT (batch)     | <2s    | For 10s audio          |
| STT (streaming) | <500ms | Per chunk              |
| TTS             | <1s    | For short text         |
| S2S roundtrip   | <5s    | Full conversation turn |

## Examples

### Voice Command Handler

```typescript
async function handleVoiceCommand() {
  const session = useVoiceSessionWeb();

  // Record user command
  await session.start();
  await sleep(3000); // Record for 3 seconds
  const result = await session.stopAndTranscribe();

  if (!result?.text) {
    await session.speak({ text: "I didn't catch that. Please try again." });
    return;
  }

  // Process command
  const response = await processCommand(result.text);

  // Speak response
  await session.speak({ text: response });
}
```

### Continuous Dictation

```typescript
function ContinuousDictation() {
  const [text, setText] = useState("");
  const sessionId = useRef(crypto.randomUUID());

  const handleChunk = async (audioChunk: string) => {
    const result = await trpc.voice.sttTranscribeStreaming.mutate({
      audioBase64: audioChunk,
      mimeType: "audio/pcm",
      sessionId: sessionId.current,
      chunkSize: "fast",
    });

    if (result.isPartial) {
      // Update preview
      setPreview(result.text);
    } else {
      // Finalize text
      setText((prev) => prev + " " + result.text);
      setPreview("");
    }
  };

  // ... audio capture logic
}
```

## See Also

- [`packages/voice/README.md`](../../packages/voice/README.md) - Package documentation
- [`docs/architecture/voice.md`](../architecture/voice.md) - Architecture details
- [`packages/voice/test/e2e/`](../../packages/voice/test/e2e/) - E2E test examples
