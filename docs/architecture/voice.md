# Voice Architecture

## Overview

The Voice system provides real-time speech-to-speech (S2S) capabilities, text-to-speech (TTS), and speech-to-text (STT). It is designed for low latency, privacy, and expressiveness using local AI models (Nemotron, Maya1) or cloud fallbacks (OpenAI).

## Core Components

### 1. Voice Registry (`packages/voice/src/server/registry.ts`)

The central authority for managing voice sessions.

- **Responsibility**: Creates, retrieves, and cleans up `VoiceSession` instances.
- **Lifecycle**: Monitors session idleness and enforces timeouts (5 minutes default).
- **Pattern**: Singleton-like access via `getVoicePools()` in `packages/api`.

### 2. Voice Session (`packages/voice/src/server/session.ts`)

Represents a single conversation context.

- **State**: Maintains transcript buffer, audio buffer, VAD state, and STT cache affinity.
- **Processing**: Coordinates STT transcription (with session affinity) and TTS synthesis.
- **Isolation**: Decouples logic from transport (WebSocket/HTTP).
- **Cache Management**: Manages STT cache lifecycle for cache-aware streaming.

### 3. Transport Layer

- **WebSocket**: Primary transport for real-time S2S (`VoiceSocketHandler`).
- **Protocol**:
  - **Binary Frames**: Used for raw audio chunks (PCM/Opus) to minimize overhead.
  - **JSON Frames**: Used for control events (start, stop, status, transcript).
- **Optimization**: Uses `Buffer` directly, avoiding Base64 encoding for audio on the hot path.

### 4. Process Pools (`packages/voice/src/process/`)

Manages persistent Python subprocesses for model inference.

- **STT Pool**: Runs Nemotron Speech (default) with cache-aware streaming. Handles VAD and transcription with session affinity.
- **TTS Pool**: Runs Maya1 (or Piper). Handles synthesis.
  - **Dual-Backend**:
    - **MLX** (macOS): Optimized for Apple Silicon using `mlx_lm`. Requires converted weights.
    - **ROCm/CUDA** (Linux): Optimized for AMD/NVIDIA using `transformers` and `bitsandbytes` (4-bit).
- **Management**: `Bun.spawn` with `stdio` IPC. Auto-restarts on crash. Session-affinity load balancing for STT.

## STT Architecture: Cache-Aware Streaming

### Nemotron Speech 0.6B

The default STT model is **nvidia/nemotron-speech-streaming-en-0.6b**, a 600M parameter FastConformer-RNNT model with:

- **Native punctuation and capitalization**: No post-processing needed.
- **Cache-aware streaming**: Maintains encoder state between chunks, eliminating redundant computation.
- **Configurable latency/accuracy**: Runtime-tunable chunk sizes from 80ms to 1.12s.

### Session Affinity

To enable cache-aware streaming, the STT pool implements **session affinity**:

```
Session A (chunk 1) → Process 1 → Cache A stored
Session A (chunk 2) → Process 1 → Cache A reused (efficient!)
Session B (chunk 1) → Process 2 → Cache B stored
```

Each session is assigned to a specific Python process, ensuring cache continuity.

### Chunk Size Configuration

| Setting    | Chunk Size | Latency  | Accuracy | Use Case              |
| ---------- | ---------- | -------- | -------- | --------------------- |
| `fast`     | 80ms       | Lowest   | Lower    | Real-time feedback    |
| `low`      | 160ms      | Very Low | Good     | Voice assistants      |
| `medium`   | 560ms      | Balanced | High     | General use (default) |
| `accurate` | 1.12s      | Higher   | Highest  | Transcription tasks   |

Configure via `VOICE_STT_CHUNK_SIZE` environment variable.

## Data Flow

### Client to Server (Audio Input)

1. **Capture**: Client records audio (PCM/WebM).
2. **Transport**: Sends binary chunks via WebSocket.
3. **Handler**: `VoiceSocketHandler` receives chunk.
4. **Session**: `VoiceSession.processAudioChunk()` buffers and sends to STT Pool with session affinity.
5. **Inference**: STT Python process performs VAD and cache-aware ASR with Nemotron.
6. **Event**: Server emits `vad_state` and `partial_transcript` (punctuated) to client.

### Server to Client (Audio Output)

1. **Trigger**: Assistant generates text response.
2. **Synthesis**: `VoiceSession.streamSynthesis()` sends text to TTS Pool.
3. **Inference**: TTS Python process generates audio chunks (24kHz/16kHz).
4. **Encoding**: Server encodes PCM to Opus (if negotiated) or raw PCM.
5. **Transport**: Sends binary chunks to client.
6. **Playback**: Client buffers and plays audio (via AudioContext or AudioWorklet).

## Key Technologies

- **Runtime**: Bun (Server), React (Web), React Native (Mobile).
- **Languages**: TypeScript (Core), Python (ML).
- **Models**:
  - TTS: Maya1 (primary), Piper (fallback/legacy).
  - STT: Nemotron Speech 0.6B (primary), Parakeet 120M (legacy fallback).
- **Codec**: Native Opus (`@discordjs/opus`) for compression, PCM for raw quality.

## Configuration

Environment variables control the behavior:

### STT Configuration

- `VOICE_STT_MODEL`: HuggingFace model ID (default: `nvidia/nemotron-speech-streaming-en-0.6b`)
- `VOICE_STT_DEVICE`: Device to use (`cuda`, `mps`, `cpu`, or auto-detect)
- `VOICE_STT_CHUNK_SIZE`: Latency/accuracy tradeoff (`fast`, `low`, `medium`, `accurate`)
- `VOICE_STT_POOL_SIZE`: Number of concurrent STT processes (default: 2)

### TTS Configuration

- `VOICE_PROVIDER`: `maya1` (default) or `supertonic` (ONNX TTS).
- `PIPER_MODEL_PATH`: Path or ID for TTS model (Maya uses internal HF path).
- `VOICE_TTS_POOL_SIZE`: Number of concurrent TTS processes (default: 1).

### Legacy Variables (Deprecated)

- `WHISPER_MODEL_PATH`: Use `VOICE_STT_MODEL` instead.
- `WHISPER_DEVICE`: Use `VOICE_STT_DEVICE` instead.

## Local validation (macOS / Apple Silicon)

Validate pools + STT/TTS without the full app stack:

```bash
cd /path/to/alfred
export VOICE_PROVIDER=maya1 VOICE_STT_DEVICE=mps ALFRED_API_AUTO_INIT=false
bun scripts/voice/validate.ts
bun scripts/voice/verify-runtime.ts
```

## Barge-In Interruptibility

Users can interrupt TTS playback by speaking:

1. **VAD Detection**: Server-side VAD detects speech activity during TTS playback
2. **Interrupt Event**: Server emits `voice_interrupt` event to client
3. **Client Handling**: Client stops TTS playback and switches to STT input
4. **State Management**: `ttsInProgress` flag tracks TTS state for interrupt detection

**Implementation:** `packages/voice/src/server/socket.ts` - VAD monitoring during TTS

**Client Integration:** `packages/voice/src/stream.ts` handles `interrupt` events (lines 376-378)

## Mindscape Visualization

Voice state is visualized in the Mindscape UI:

- **OrbNode Component**: Displays voice session state (`apps/web/src/components/mindscape/nodes/orb-node.tsx`)
- **VAD Levels**: Real-time VAD confidence visualized
- **Voice Visualizer Store**: Zustand store (`apps/web/src/store/voice-visualizer.ts`) tracks:
  - VAD levels
  - Speech detection state
  - Session metadata

**Integration:** OrbNode subscribes to `useVoiceVisualizerStore()` for real-time updates

## Admin Dashboard

Voice admin dashboard at `/admin/voice` (`apps/web/src/routes/admin/voice.tsx`):

**Features:**

- **Pool Management**: Restart STT/TTS pools (`restartVoicePool`)
- **Session Management**: Clear active sessions (`clearVoiceSessions`)
- **Statistics**: View voice stats (`getVoiceStats`)
- **Telemetry**: View aggregated telemetry (`collectVoiceTelemetry`)

**API Endpoints:**

- `POST /api/admin/voice/restart-pool` - Restart STT or TTS pool
- `POST /api/admin/voice/clear-sessions` - Clear all active sessions
- `GET /api/admin/voice/stats` - Get voice statistics

**Access:** Requires admin authentication

## Telemetry

### Prometheus Metrics

Metrics exposed on `/api/metrics`:

- `voiceSessionDurationSeconds` - Histogram of session durations
- `voicePacketLossTotal` - Counter of lost packets
- `voiceJitterSeconds` - Histogram of jitter measurements
- `voiceRttSeconds` - Histogram of round-trip time
- `voiceVadLevel` - Gauge of current VAD confidence
- `voicePoolSize` - Gauge of pool size (STT/TTS)
- `voicePoolUtilization` - Gauge of pool utilization percentage
- `voiceProcessCrashesTotal` - Counter of process crashes

**Location:** `packages/api/src/voice/telemetry.ts`

### Telemetry Collection

`collectVoiceTelemetry()` aggregates telemetry from active sessions:

- Packet loss, jitter, RTT per session
- Pool utilization and saturation
- Process health and crash counts

**Usage:** Admin dashboard and monitoring systems

## Model Comparison

| Model         | Parameters | WER (avg) | Punctuation | Streaming   | VRAM   |
| ------------- | ---------- | --------- | ----------- | ----------- | ------ |
| Nemotron 0.6B | 600M       | 7.16%     | Native      | Cache-aware | ~1.5GB |
| Parakeet 120M | 120M       | ~9%       | None        | Buffered    | ~0.5GB |

The default Nemotron model provides significantly better accuracy and native punctuation at the cost of additional memory.

## Troubleshooting

### STT Returns Empty Transcriptions

**Symptoms:** Model loads successfully, processes audio (non-zero RTF), but returns empty text.

**Common causes:**

1. **Streaming configuration breaking batch mode:** The STT server must NOT call `change_attention_model()` at init time. This permanently alters model state and breaks batch transcription. The server should only enable streaming flag, not reconfigure attention.

2. **MPS device issues:** Apple Metal (MPS) can produce empty results for some NeMo models. Try `VOICE_STT_DEVICE=cpu` to verify.

3. **Audio too short:** Nemotron requires minimum ~0.3s of audio. Very short chunks may produce empty results.

**Debugging:**

```python
# Add to server.py _transcribe_batch():
logger.info(f"Raw result: type={type(result)}, value={result}")
```

### TTS Generates Truncated Audio

**Symptoms:** Audio duration is much shorter than expected (e.g., 0.26s for "Hello, how are you today?").

**Common causes:**

1. **Maya1 MLX backend issues:** The MLX backend may generate truncated audio. Use `TTS_PROVIDER=supertonic` for reliable results.

2. **Warmup race condition:** TTS warmup runs in background and can race with actual requests. Wait 2-3s after initialization before sending requests.

**Validation:**

```typescript
const audioDuration = pcm.length / sampleRate;
const expectedMin = wordCount * 0.1; // ~0.1s per word
if (audioDuration < expectedMin) {
  console.warn(
    `Audio too short: ${audioDuration}s vs expected ${expectedMin}s`
  );
}
```

### Pipeline Test Failures

**Running pipeline tests:**

```bash
# Use Supertonic TTS for reliable audio generation
VOICE_PIPELINE_TEST=1 TTS_PROVIDER=supertonic VOICE_STT_DEVICE=cpu \
  bun test test/e2e/pipeline-roundtrip.test.ts
```

**Expected results:**

- Average WER: < 10%
- Average similarity: > 90%

**If tests fail:**

1. Check audio duration (should be ~0.1s per word minimum)
2. Check audio levels (RMS > 100, max > 1000)
3. Try CPU device for STT
4. Use Supertonic instead of Maya1 for TTS
