# Voice Architecture

## Overview

The Voice system provides real-time speech-to-speech (S2S) capabilities, text-to-speech (TTS), and speech-to-text (STT). It is designed for low latency, privacy, and expressiveness using local AI models (Maya1, NeMo) or cloud fallbacks (OpenAI).

## Core Components

### 1. Voice Registry (`packages/voice/src/server/registry.ts`)
The central authority for managing voice sessions.
- **Responsibility**: Creates, retrieves, and cleans up `VoiceSession` instances.
- **Lifecycle**: Monitors session idleness and enforces timeouts (5 minutes default).
- **Pattern**: Singleton-like access via `getVoicePools()` in `packages/api`.

### 2. Voice Session (`packages/voice/src/server/session.ts`)
Represents a single conversation context.
- **State**: Maintains transcript buffer, audio buffer, and VAD state.
- **Processing**: Coordinates STT transcription and TTS synthesis.
- **Isolation**: Decouples logic from transport (WebSocket/HTTP).

### 3. Transport Layer
- **WebSocket**: Primary transport for real-time S2S (`VoiceSocketHandler`).
- **Protocol**: 
  - **Binary Frames**: Used for raw audio chunks (PCM/Opus) to minimize overhead.
  - **JSON Frames**: Used for control events (start, stop, status, transcript).
- **Optimization**: Uses `Buffer` directly, avoiding Base64 encoding for audio on the hot path.

### 4. Process Pools (`packages/voice/src/process/`)
Manages persistent Python subprocesses for model inference.
- **STT Pool**: Runs NeMo Parakeet (or Whisper). Handles VAD and transcription.
- **TTS Pool**: Runs Maya1 (or Piper). Handles synthesis.
  - **Dual-Backend**:
    - **MLX** (macOS): Optimized for Apple Silicon using `mlx_lm`. Requires converted weights.
    - **ROCm/CUDA** (Linux): Optimized for AMD/NVIDIA using `transformers` and `bitsandbytes` (4-bit).
- **Management**: `Bun.spawn` with `stdio` IPC. Auto-restarts on crash. Round-robin load balancing.

## Data Flow

### Client to Server (Audio Input)
1. **Capture**: Client records audio (PCM/WebM).
2. **Transport**: Sends binary chunks via WebSocket.
3. **Handler**: `VoiceSocketHandler` receives chunk.
4. **Session**: `VoiceSession.processAudioChunk()` buffers and sends to STT Pool.
5. **Inference**: STT Python process performs VAD and ASR.
6. **Event**: Server emits `vad_state` and `partial_transcript` to client.

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
  - STT: NeMo Parakeet (primary), Faster-Whisper (fallback).
- **Codec**: Native Opus (`@discordjs/opus`) for compression, PCM for raw quality.

## Configuration

Environment variables control the behavior:
- `VOICE_PROVIDER`: `maya1` (default) or `supertonic` (ONNX TTS).
- `WHISPER_MODEL_PATH`: HuggingFace ID for STT model.
- `PIPER_MODEL_PATH`: Path or ID for TTS model (Maya uses internal HF path).
- `VOICE_STT_POOL_SIZE`: Number of concurrent STT processes (default: 2).
- `VOICE_TTS_POOL_SIZE`: Number of concurrent TTS processes (default: 1).

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
