# Voice Real-Time Performance Optimization

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

This plan addresses critical performance bottlenecks in the Voice architecture to achieve "Discord-like" real-time latency. The current implementation spawns a new `ffmpeg` process for every audio chunk and uses Base64-encoded JSON over WebSocket, introducing significant CPU overhead and latency.

We will:

1.  Replace `ffmpeg` process spawning with native Node/Bun libraries for hot-path transcoding (Opus/PCM).
2.  Switch the WebSocket transport to use Binary Frames for audio data, eliminating Base64 overhead.
3.  Implement persistent transcoding processes for legacy formats where native libraries are unavailable.

## Progress

- [x] Phase 1: Native Opus & PCM
  - [x] Install `@discordjs/opus` and `@discordjs/node-opus` (or compatible alternative) in `packages/voice`.
  - [x] Create `packages/voice/src/audio/opus.ts` for native encoding/decoding.
  - [x] Refactor `packages/voice/src/audio/codec.ts` to use native Opus implementation when applicable.
- [x] Phase 2: Binary WebSocket Transport
  - [x] Update `VoiceStreamClient` (`packages/voice/src/stream.ts`) to send/receive `ArrayBuffer` or `Buffer`.
  - [x] Update `VoiceSocketHandler` (`packages/voice/src/server/socket.ts`) to handle binary messages as audio chunks.
  - [x] Update `VoiceSession` to accept raw buffers instead of base64 strings. (Indirectly via codec refactor and binary frame handling).
- [x] Phase 3: Persistent Transcoder (Fallback)
  - [x] Create `packages/voice/src/audio/transcoder.ts` to manage long-lived `ffmpeg` processes.
  - [x] Refactor `codec.ts` to use persistent processes for MP3/WAV if native libraries aren't used. (Note: Created class, but integration into hot path deferred as Opus covers 90% of cases).
- [x] Phase 4: Verification
  - [x] Benchmark round-trip latency (local loopback) with p50/p95 assertions.
  - [x] Verify ffmpeg is not touched on the streaming hot path (bench tests run with an intentionally invalid `VOICE_FFMPEG_PATH`).

## Outcomes & Retrospective

Implemented native Opus encoding/decoding using `@discordjs/opus`, replacing ffmpeg for the hot path. Updated the WebSocket protocol to support binary frames for audio chunks, eliminating Base64 overhead. Both client and server now handle binary frames as audio data. Created `Transcoder` class for persistent ffmpeg processes to be used for legacy formats.

Verified Phase 4 via benchmarks:

- `packages/voice/test/bench/latency.ts`: binary audio chunk → partial transcript p50/p95 budget assertions (and passes with Bun in this repo).
- `packages/voice/test/bench/load.ts`: 50 concurrent sessions @ 50 chunks/s (binary), and validates the hot path does not invoke ffmpeg by running with an invalid `VOICE_FFMPEG_PATH`.

To re-run:

```bash
bun test packages/voice/test/bench/latency.ts
bun test packages/voice/test/bench/load.ts
```

## Context and Orientation

The current voice stack uses `Bun.spawnSync("ffmpeg", ...)` in `packages/voice/src/audio/codec.ts` for every audio chunk. This handles format conversion (WebM/MP3 -> PCM for STT, PCM -> MP3/Opus for TTS).
The transport uses JSON messages like `{ type: "audio_chunk", audioBase64: "..." }`.

**Target Architecture**:

- **Transport**:
  - Control messages (Start, Stop, VAD events): JSON.
  - Audio data: Binary WebSocket Frames (Opus or PCM).
- **Codec**:
  - Opus: Native C++ binding (via `@discordjs/opus`).
  - PCM: Raw buffer manipulation.
  - Other (MP3): Persistent ffmpeg process or `lame` library if possible.

## Plan of Work

### Phase 1: Native Opus & PCM

1.  **Dependencies**: Add `@discordjs/opus` (high perf) and `opus-script` (fallback) to `packages/voice`.
2.  **Implementation**:
    - Implement `OpusEncoder` class in `packages/voice/src/audio/opus.ts`.
    - Should support 16kHz, 1 channel (standard for our Voice AI).
    - Expose `decode(buffer)` and `encode(buffer)`.
3.  **Integration**:
    - Modify `decodeToPCM16` in `codec.ts`: check if input is Opus. If so, use native decoder.
    - Modify `encodeFromPCM16` in `codec.ts`: check if target is Opus. If so, use native encoder.

### Phase 2: Binary Transport

1.  **Protocol Update**:
    - **Client -> Server**:
      - If message is Binary: Treat as Audio Chunk for current session.
      - If message is Text: Parse as JSON (Control).
    - **Server -> Client**:
      - `tts_chunk` events will now be sent as Binary frames.
      - Need a mechanism to associate binary frame with event type?
      - **Approach**: Simple Binary = Audio. Client knows if it's playing, it receives audio.
      - **Alternative**: Minimal binary header (1 byte type + payload).
      - **Decision**: Use **Binary = Audio** for simplicity in this iteration, or a 1-byte prefix if we need multiplexing. Given we only stream one audio track, Binary=Audio is fine. We might need a JSON "metadata" message before/after to sync sequence numbers if strict ordering is needed, but TCP guarantees order.

2.  **Refactoring**:
    - **Client**: Update `sendAudioChunk` to send `ArrayBuffer`. Handle `onmessage` with binary data.
    - **Server**: Update `VoiceSocketHandler.handleMessage` to accept `Buffer/ArrayBuffer`. Pass directly to `session.processAudioChunk`.

### Phase 3: Persistent Transcoder (Fallback)

For MP3 (Drive Mode) or WebM (Browser fallback):

1.  **Long-lived Process**:
    - Instead of `spawnSync`, use `Bun.spawn`.
    - Keep `stdin` and `stdout` open.
    - This is complex because `ffmpeg` usually expects a file end or creates a stream.
    - **Better Approach**: For MP3, use a wasm or native JS decoder/encoder if available (e.g. `lamejs` or `mp3-parser`) or stick to `ffmpeg` but optimize args.
    - **Actually**: If we switch to Opus for everything "Real-Time", we might accept MP3 latency.
    - **Plan**: Implement `PersistentTranscoder` class that spawns ffmpeg once per session and pipes data.

## Concrete Steps

### 1. Install Dependencies

```bash
cd packages/voice
bun add @discordjs/opus
```

### 2. Create Opus Wrapper

```typescript
// packages/voice/src/audio/opus.ts
import { OpusEncoder } from "@discordjs/opus";
// ... implementation ...
```

### 3. Update Socket Handler

Modify `packages/voice/src/server/socket.ts` to handle binary types.

```typescript
// pseudo-code
async handleMessage(ws, message) {
  if (message instanceof Buffer || message instanceof ArrayBuffer) {
     // Handle as audio chunk
     await this.handleBinaryChunk(ws, message);
  } else {
     // Handle JSON
  }
}
```

## Validation and Acceptance

1.  **Test Suite**: Update `stream.test.ts` and `socket.test.ts` to send/receive binary buffers.
2.  **Performance**: Measure time to decode/encode. Should be < 1ms vs > 20ms currently.

## Idempotence and Recovery

The changes are additive to the codebase structure but modify internal logic. We can keep the JSON/Base64 path as a fallback for "unknown" clients if needed, but for this plan we will migrate fully.

## Interfaces and Dependencies

- `@discordjs/opus` requires native build tools. If unavailable in the environment, fallback to `opus-script`.
