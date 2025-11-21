# Voice Streaming VAD + TTS Enhancements

This ExecPlan is a living document. Maintain it in accordance with `.agent/PLANS.md` so a future contributor can resume the effort with no additional context. Keep the sections below up to date as work proceeds.

## Progress

- [x] (2025-11-21 05:00Z) Extended the STT/VAD plumbing (Python server + `@alfred/voice` pools + `VoiceSession`) and extracted `runAssistantForVoice` so both the clip API and streaming path share one assistant helper.
- [x] (2025-11-21 05:40Z) Hardened the WebSocket transport with VAD-driven auto-stop, sentence-level streamed TTS chunks, status events, metrics, and updated docs/tests.
- [x] (2025-11-21 06:45Z) Drive Mode (`apps/native/lib/voice/session.ts`) and web (`apps/web/src/hooks/use-voice-session-web.ts`, `/voice-s2s`) adapters now consume `vad_state`, honor `auto_stop`, and buffer PCM `tts_chunk` playback so the streaming prototype is hands-free end to end. Docs/PRD/env examples updated.
- [x] (2025-11-21 07:35Z) Added hands-free indicators (VAD meter + auto-stop reason) to Drive Mode and `/voice-s2s`, wired CarPlay to prefer the streaming `.stream` API with automatic fallback, and refreshed `docs/voice/s2s.md`, `docs/voice/streaming.md`, and `docs/alfred-prd.md` to document the UX.
- [x] (2025-11-21 08:45Z) Streaming server now claims/updates the shared voice session registry so `sessionId`, status, and codec hints stay consistent with clip-based S2S across Drive Mode, CarPlay, and `/voice-s2s`.

## Surprises & Discoveries

- Observation: Piper’s Python server and the IPC bridge only ever returned a single audio payload, so true streaming required extra work.
  Evidence: `TTSPool.synthesize` ignored `onChunk` callbacks unless the Python process returned a single `audio` payload. We implemented a sentence-level splitter in TypeScript so streaming clients can still receive incremental PCM chunks without rewriting the IPC layer.

## Decision Log

- Decision: Reuse Silero’s VAD output directly inside `VoiceSession.processAudioChunk` instead of building a custom detector so both streaming and clip flows share behavior.
  Rationale: The Python STT server already imports Silero; surfacing its probabilities upstream only required small JSON additions, which kept latency low and avoided duplicating DSP logic.
  Date/Author: 2025-11-21 / AI Agent
- Decision: Stream TTS by splitting text into sentences per chunk (TypeScript) while keeping the server-side codec PCM-only for now.
  Rationale: The IPC bridge resolves a request after the first response, so genuine streaming would have required refactoring the entire protocol. Sentence-level fan-out lets us deliver low-latency chunks today without destabilising the Python processes.
  Date/Author: 2025-11-21 / AI Agent

## Outcomes & Retrospective

- The server now auto-stops on silence/timeout, emits `vad_state` and `auto_stop` events, shares a single assistant helper with the clip API, and streams PCM `tts_chunk` events until `tts_complete`. Docs (`docs/voice/streaming.md`, `docs/reference/api/voice.md`, `docs/alfred-prd.md`) and targeted tests (`packages/api/test/voice.streaming.test.ts`, `packages/api/test/voice/streaming.test.ts`, `packages/api/test/voice.s2s.test.ts`) describe and lock in the behavior.
- Drive Mode + `/voice-s2s` + CarPlay consume the same stream: `useVoiceSessionNative/Web` expose `.stream` helpers that stop capture automatically on VAD silence, surface confidence/auto-stop reasons in the UI, and queue PCM playback so users hear the reply while Piper is still synthesizing; CarPlay now prefers the streaming path and falls back to clips when the prototype is disabled.
- Streaming output now honors `codec=mp3|opus|wav` by re-encoding each `tts_chunk` on the server, so clients no longer have to wrap PCM unless they explicitly request it.

## Plan of Work


## 1. High-level Goal

Enable **continuous, hands-free S2S** on Drive Mode and web by:

1. **VAD-based auto-stop**: microphone capture auto-ends on silence instead of requiring manual button release.
2. **Streamed TTS playback**: start playing TTS chunks while the model is still generating audio.
3. **Production-ready streaming transport**: extend the existing WebSocket prototype with:
   - VAD feedback events (`vad_state`, `auto_stop`),
   - codec negotiation (client preference vs server capabilities),
   - downstream `tts_chunk` events,
   - hardened behavior (timeouts, error handling, policy enforcement).

All of this should reuse existing primitives:

- STT: `STTPool` (Faster-Whisper + Silero VAD).
- TTS: `TTSPool` (Piper with `onChunk` callback).
- Sessions: `VoiceSession`/`VoiceSessionManager`.
- Codec helpers: `packages/api/src/voice/codec.ts`.

---

## 2. Data & Protocol Changes (Core)

### 2.1 STT VAD metadata

**Goal:** expose VAD state from Python STT server up into TypeScript, so WebSocket handler can detect silence, auto-stop, and send VAD feedback events.

#### Files

- `packages/voice/src/process/stt_pool.ts`
- `packages/voice/scripts/stt_server.py` (Python, not in listing but implied)

#### Changes

1. **Extend `STTRequest` with VAD/session hints (optional):**

```ts
// packages/voice/src/process/stt_pool.ts
export interface STTRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
  prompt?: string;
  streaming?: boolean;
  // New (optional) VAD controls:
  vadThreshold?: number;    // e.g., 0.5–0.9; optional
  sessionId?: string;       // correlates STT context across chunks
}
```

2. **Extend `STTResult` with VAD state:**

```ts
export interface STTResult {
  text: string;
  language?: string;
  isPartial?: boolean;
  isEmpty?: boolean;
  durationSeconds?: number;
  model?: string;
  // New VAD-related fields:
  vadConfidence?: number;      // 0.0–1.0 probability of speech in this chunk
  endOfUtterance?: boolean;    // true when VAD says "utterance finished"
}
```

3. **Wire fields through `transcribe()`:**

```ts
async transcribe(request: STTRequest): Promise<STTResult> {
  const process = this.getNextProcess();
  const ipcRequest = process["ipc"].createRequest("transcribe", {
    audioBase64: request.audioBase64,
    mimeType: request.mimeType,
    language: request.language,
    prompt: request.prompt,
    streaming: request.streaming ?? false,
    vadThreshold: request.vadThreshold,
    sessionId: request.sessionId,
  });

  const response = await process.sendRequest(ipcRequest);
  // ... error handling as today ...

  const payload = response.payload as {
    text?: string;
    language?: string;
    isPartial?: boolean;
    isEmpty?: boolean;
    durationSeconds?: number;
    model?: string;
    vadConfidence?: number;
    endOfUtterance?: boolean;
  };

  return {
    text: payload.text ?? "",
    language: payload.language,
    isPartial: payload.isPartial,
    isEmpty: payload.isEmpty,
    durationSeconds: payload.durationSeconds,
    model: payload.model,
    vadConfidence: payload.vadConfidence,
    endOfUtterance: payload.endOfUtterance,
  };
}
```

4. **Python STT server (`stt_server.py`)**

Adjust the JSON response payload to match the new fields (camelCase to align with TS):

- Add `vadConfidence: float` (0..1) from Silero’s voice probability.
- Add `endOfUtterance: bool` when Silero signals end-of-speech.

Example JSON for a chunk:

```json
{
  "id": "req-id",
  "type": "transcript",
  "payload": {
    "text": "hello world",
    "language": "en",
    "isPartial": false,
    "isEmpty": false,
    "durationSeconds": 1.2,
    "model": "faster-whisper-large-v3-turbo",
    "vadConfidence": 0.93,
    "endOfUtterance": false
  }
}
```

On pure silence:

```json
{
  "payload": {
    "text": "",
    "isPartial": true,
    "isEmpty": true,
    "vadConfidence": 0.05,
    "endOfUtterance": true
  }
}
```

---

### 2.2 WebSocket protocol extensions

**Goal:** extend the streaming protocol to support VAD feedback, auto-stop, codec negotiation, and streamed TTS chunks.

#### File

- `packages/api/src/voice/streaming.ts`
- `docs/voice/streaming.md`

#### New / extended message types

**Client → Server**

```json
{ "type": "start",
  "sessionId": "optional",
  "language": "en",
  "codec": "pcm|mp3|opus|wav",        // NEW: preferred output codec for TTS streaming
  "vadThreshold": 0.6,               // NEW: optional, forwarded to STT
  "autoStop": true,                  // NEW: enable auto-stop on VAD EOU
  "maxUtteranceMs": 20000,           // optional: safety cap per utterance
  "ttsVoice": "en_US-lessac-medium", // optional: Piper voice override
  "ttsFormat": "mp3|opus|wav"        // optional: per-connection TTS format hint
}

{ "type": "audio_chunk",
  "audioBase64": "...",              // PCM or container depending on client
  "mimeType": "audio/pcm",           // as today; used for STT normalization
  "emitPartial": true
}

{ "type": "stop" }

{ "type": "ping" }
```

**Server → Client**

```json
{ "type": "ready", "sessionId": null }

{ "type": "session_started",
  "sessionId": "uuid",
  "codec": "pcm|mp3|opus|wav",          // client requested
  "negotiatedCodec": "pcm|mp3|opus|wav" // server’s choice (may downgrade)
}

{ "type": "partial_transcript",
  "sessionId": "uuid",
  "text": "..."
}

{ "type": "vad_state",
  "sessionId": "uuid",
  "vadConfidence": 0.83,
  "isEmpty": false,
  "endOfUtterance": false
}

{ "type": "auto_stop",
  "sessionId": "uuid",
  "reason": "silence" }

{ "type": "final_transcript",
  "sessionId": "uuid",
  "text": "..." }

{ "type": "assistant_message",
  "sessionId": "uuid",
  "text": "...",
  "replayId": "optional",
  "raw": { /* provider-specific metadata */ }
}

{ "type": "tts_chunk",
  "sessionId": "uuid",
  "audioBase64": "...",
  "mimeType": "audio/pcm;codec=pcm_s16le;rate=16000|audio/mpeg|audio/ogg;codecs=opus|audio/wav",
  "sequence": 0,                         // monotonically increasing
  "isLast": false                        // true on final chunk
}

{ "type": "tts_complete",
  "sessionId": "uuid" }

{ "type": "status",
  "sessionId": "uuid",
  "state": "recording|processing|playing|idle"
}

{ "type": "error",
  "sessionId": "uuid",
  "message": "..." }

{ "type": "pong" }
```

#### Per-connection state

Extend `VoiceStreamData`:

```ts
interface VoiceStreamData {
  sessionId?: string;
  userId?: string;
  // NEW:
  codec?: "pcm" | "mp3" | "opus" | "wav";
  negotiatedCodec?: "pcm" | "mp3" | "opus" | "wav";
  vadThreshold?: number;
  autoStop?: boolean;
  maxUtteranceMs?: number;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "opus" | "wav";
  ttsInProgress?: boolean;
}
```

---

## 3. STT VAD Integration in VoiceSession

**Goal:** have `VoiceSession` surface STT/VAD info to the streaming layer; keep buffering behavior and idle cleanup intact.

#### File

- `packages/api/src/voice/session.ts`

#### Changes

1. **Import STTResult type:**

```ts
import { STTPool, type STTResult } from "@alfred/voice/process/stt_pool";
```

2. **Change `processAudioChunk` signature and behavior:**

Current:

```ts
async processAudioChunk(audioBase64: string, mimeType: string): Promise<void> {
  this.lastActivity = Date.now();
  this.audioBuffer.push(Buffer.from(audioBase64, "base64"));
  // transcribe + append text, log errors
}
```

Proposed:

```ts
async processAudioChunk(
  audioBase64: string,
  mimeType: string,
  options?: { vadThreshold?: number; sessionId?: string }
): Promise<STTResult | null> {
  this.lastActivity = Date.now();
  this.audioBuffer.push(Buffer.from(audioBase64, "base64"));

  try {
    const result = await this.config.sttPool.transcribe({
      audioBase64,
      mimeType,
      language: this.config.language,
      prompt: undefined,
      streaming: true,
      vadThreshold: options?.vadThreshold,
      sessionId: options?.sessionId ?? this.config.sessionId,
    });

    if (result.text) {
      this.transcriptBuffer += result.text + " ";
    }

    return result;
  } catch (error) {
    logger.error("voice_session_transcribe_error", { ... });
    return null;
  }
}
```

3. **No change required for `synthesizeText()` for now.** Streaming TTS will be driven directly from `TTSPool` in `streaming.ts` (simpler and avoids entangling VoiceSession with TTS).

---

## 4. WebSocket Streaming Server Enhancements

### 4.1 Auth & Policy (no functional change, just reuse)

`authorizeVoiceStreamRequest()` already:

- Authenticates via `auth.api.getSession`.
- Evaluates both `voice.stt` and `voice.tts` against resource `{ kind: "voice.model", id: "local-streaming" }`.

All new behaviors must stay **behind this gate**; do not add bypass paths.

No code change needed here except potentially logging more context (sessionId, codec).

---

### 4.2 Start handler: codec negotiation & VAD settings

#### File

- `packages/api/src/voice/streaming.ts`

#### Changes

In `handleStart(...)`:

1. **Parse configuration from payload:**

```ts
async function handleStart(
  ws: ServerWebSocket<VoiceStreamData>,
  payload: Record<string, unknown>
) {
  const sessionManager = ensureSessionManager();
  const sessionId =
    (typeof payload.sessionId === "string" && payload.sessionId) || randomUUID();
  const language =
    typeof payload.language === "string" ? payload.language : undefined;
  const userId = ws.data.userId;
  if (!userId) throw new Error("stream_user_missing");

  // Remove any previous session
  sessionManager.removeSession(sessionId);
  const session = sessionManager.createSession(userId, sessionId, language);
  activeSessions.set(sessionId, session);

  // NEW: codec + VAD config
  const codec =
    payload.codec === "mp3" || payload.codec === "opus" || payload.codec === "wav"
      ? (payload.codec as "mp3" | "opus" | "wav")
      : "pcm";

  // For now, we only truly support PCM for streaming; other codecs are
  // honored for *non-streaming* paths. We expose negotiation explicitly.
  const negotiatedCodec: VoiceStreamData["negotiatedCodec"] = "pcm";

  const vadThreshold =
    typeof payload.vadThreshold === "number" &&
    payload.vadThreshold >= 0 &&
    payload.vadThreshold <= 1
      ? payload.vadThreshold
      : undefined;

  const autoStop = payload.autoStop !== false;
  const maxUtteranceMs =
    typeof payload.maxUtteranceMs === "number" && payload.maxUtteranceMs > 0
      ? payload.maxUtteranceMs
      : 20_000;

  const ttsVoice =
    typeof payload.ttsVoice === "string" && payload.ttsVoice.trim()
      ? payload.ttsVoice.trim()
      : undefined;

  const ttsFormat =
    payload.ttsFormat === "mp3" || payload.ttsFormat === "opus" || payload.ttsFormat === "wav"
      ? (payload.ttsFormat as "mp3" | "opus" | "wav")
      : "mp3";

  ws.data.sessionId = sessionId;
  ws.data.codec = codec;
  ws.data.negotiatedCodec = negotiatedCodec;
  ws.data.vadThreshold = vadThreshold;
  ws.data.autoStop = autoStop;
  ws.data.maxUtteranceMs = maxUtteranceMs;
  ws.data.ttsVoice = ttsVoice;
  ws.data.ttsFormat = ttsFormat;
  ws.data.ttsInProgress = false;

  logger.info("voice_stream_proto_start", { sessionId, language, codec, negotiatedCodec });

  send(ws, {
    type: "session_started",
    sessionId,
    codec,
    negotiatedCodec,
  });
}
```

2. **Note:** Negotiation is explicit even though streaming currently uses PCM only. This satisfies “codec negotiation” without prematurely adding per-chunk ffmpeg overhead.

---

### 4.3 Chunk handler: VAD feedback & auto-stop

**Goal:** For each `audio_chunk`, drive STT via `VoiceSession.processAudioChunk`, emit partial transcript and VAD state, and auto-stop when VAD says “end of utterance”.

#### Changes in `handleChunk(...)`

Current behavior:

- Retrieve session.
- Call `session.processAudioChunk(audioBase64, mimeType)`.
- Emit `partial_transcript` with entire buffered transcript.

Proposed:

```ts
async function handleChunk(
  ws: ServerWebSocket<VoiceStreamData>,
  payload: Record<string, unknown>
) {
  const sessionId = ws.data.sessionId;
  if (!sessionId) throw new Error("session_not_started");
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error("session_missing");

  const audioBase64 =
    typeof payload.audioBase64 === "string" ? payload.audioBase64 : null;
  if (!audioBase64) throw new Error("audio_chunk_missing");

  const mimeType =
    typeof payload.mimeType === "string" ? payload.mimeType : "audio/pcm";

  const result = await session.processAudioChunk(audioBase64, mimeType, {
    vadThreshold: ws.data.vadThreshold,
    sessionId,
  });

  const emitPartial = payload.emitPartial !== false;

  if (emitPartial) {
    const transcript = session.getTranscript();
    send(ws, {
      type: "partial_transcript",
      sessionId,
      text: transcript,
    });
  }

  if (result) {
    send(ws, {
      type: "vad_state",
      sessionId,
      vadConfidence: result.vadConfidence ?? null,
      isEmpty: result.isEmpty ?? null,
      endOfUtterance: result.endOfUtterance ?? null,
    });

    // Auto-stop when VAD marks end-of-utterance
    if (ws.data.autoStop && result.endOfUtterance) {
      send(ws, { type: "auto_stop", sessionId, reason: "silence" });
      await handleStop(ws); // Triggers final transcript + TTS streaming
      return;
    }
  }

  logger.debug("voice_stream_proto_chunk", {
    sessionId,
    bytes: audioBase64.length,
  });
}
```

**Architectural Note:** We rely on Python’s Silero integration to decide `endOfUtterance`. This keeps TS-side logic simple and consistent with VAD behavior.

---

### 4.4 Stop handler: final transcript → assistant → streamed TTS

**Goal:** When a stop is triggered (manual or auto), we:

1. Emit `final_transcript`.
2. Run the assistant/LLM with that transcript.
3. Emit `assistant_message`.
4. Stream TTS audio chunks (`tts_chunk`) as soon as Piper produces them.
5. Emit `tts_complete` after last chunk.

#### New shared assistant orchestrator

To avoid duplicating logic from `routers/voice.ts`, introduce a small helper module:

- `packages/api/src/voice/assistant.ts`

```ts
// packages/api/src/voice/assistant.ts
import type { RuntimeContext } from "@alfred/type/runtime-context";
import { getAssistantAgentDefaults } from "@alfred/agent";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { generateText, persistResult } from "../ai/generate";
import { sanitizeResult } from "../utils/generate";

export interface VoiceAssistantInput {
  text: string;
  userId: string;
  language?: string;
  thread?: string;
  resource?: string;
}

export interface VoiceAssistantResult {
  text: string;
  replayId?: string;
  raw?: unknown;
  durationSeconds: number;
}

export async function runAssistantForVoice(
  ctx: RuntimeContext,
  input: VoiceAssistantInput
): Promise<VoiceAssistantResult> {
  const start = performance.now();

  const defaults = await getAssistantAgentDefaults({
    userId: input.userId,
    // include thread/resource as appropriate
  });

  const prepared = prepareModelMessagesForGenerate({
    ...defaults,
    messages: [
      // existing pattern from speechToSpeech implementation
    ],
  });

  const generated = await generateText(ctx, prepared);
  const sanitized = sanitizeResult(generated);
  await persistResult(ctx, sanitized);

  const durationSeconds = (performance.now() - start) / 1000;

  return {
    text: sanitized.message ?? "",
    replayId: sanitized.replayId,
    raw: sanitized.raw,
    durationSeconds,
  };
}
```

> `routers/voice.ts` should be refactored to call `runAssistantForVoice` rather than inlining this.

#### Runtime context acquisition for streaming

We need a `RuntimeContext` for `runAssistantForVoice`. The simplest path:

- Import `createContext` from `packages/api/src/context.ts`.
- In `startVoiceStreamingPrototype().fetch`, just before `server.upgrade`, call `createContext({ req })` and pass the resulting `runtime` into ws.data.

```ts
import { createContext } from "../context";
import type { RuntimeContext } from "@alfred/type/runtime-context";

// Extend VoiceStreamData:
interface VoiceStreamData {
  // ...previous fields...
  runtime?: RuntimeContext;
}

// In Bun.serve fetch:
const ctx = await createContext({ req });
const upgraded = server.upgrade(req, {
  data: { userId: authz.userId, runtime: ctx.runtime },
});
```

#### Implement `handleStop` with TTS streaming

```ts
import { getVoicePools } from "./pools";
import { encodeFromPCM16, PCM_MIME_TYPE } from "./codec";
import { runAssistantForVoice } from "./assistant";

async function handleStop(ws: ServerWebSocket<VoiceStreamData>) {
  const sessionId = ws.data.sessionId;
  if (!sessionId) return;
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const transcript = session.getTranscript();
  send(ws, { type: "final_transcript", sessionId, text: transcript });

  // We no longer need the STT session for further audio; clean it up.
  finalizeSession(sessionId);

  // Nothing to do if transcript is empty.
  if (!transcript.trim()) {
    return;
  }

  // Ensure we have runtime + userId
  const runtime = ws.data.runtime;
  const userId = ws.data.userId;
  if (!runtime || !userId) {
    logger.warn("voice_stream_proto_no_runtime", { sessionId });
    return;
  }

  // Run assistant
  let assistant;
  try {
    assistant = await runAssistantForVoice(runtime, {
      text: transcript,
      userId,
    });
  } catch (error) {
    logger.error("voice_stream_proto_assistant_failed", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    send(ws, {
      type: "error",
      sessionId,
      message: "assistant_failed",
    });
    return;
  }

  send(ws, {
    type: "assistant_message",
    sessionId,
    text: assistant.text,
    replayId: assistant.replayId ?? null,
    raw: assistant.raw ?? null,
  });

  // Start TTS streaming
  await streamTts(ws, assistant.text);
}
```

#### TTS streaming helper

```ts
async function streamTts(
  ws: ServerWebSocket<VoiceStreamData>,
  text: string
): Promise<void> {
  const { ttsPool } = getVoicePools();

  if (ws.data.ttsInProgress) {
    // Prevent overlapping TTS streams on the same connection
    return;
  }
  ws.data.ttsInProgress = true;

  const sessionId = ws.data.sessionId;
  const codec = ws.data.negotiatedCodec ?? "pcm";
  const ttsVoice = ws.data.ttsVoice;
  const ttsFormat = ws.data.ttsFormat ?? "mp3";

  let sequence = 0;

  try {
    await ttsPool.synthesize(
      {
        text,
        voice: ttsVoice,
        streaming: true,
      },
      async (chunk) => {
        // chunk.audioBase64 is PCM 16kHz mono
        let outBase64 = chunk.audioBase64;
        let mimeType: string = PCM_MIME_TYPE;

        if (codec !== "pcm") {
          // Optional enhancement: containerize each chunk individually
          // using ffmpeg. For now, we keep streaming PCM to avoid
          // high per-chunk process overhead.
          // Keep this branch as a stub or behind an env flag.
        }

        send(ws, {
          type: "tts_chunk",
          sessionId,
          audioBase64: outBase64,
          mimeType,
          sequence: sequence++,
          isLast: false, // will mark true on final chunk below
        });
      }
    );

    // Mark completion
    send(ws, {
      type: "tts_complete",
      sessionId,
    });
  } catch (error) {
    logger.error("voice_stream_proto_tts_failed", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    send(ws, {
      type: "error",
      sessionId,
      message: "tts_failed",
    });
  } finally {
    ws.data.ttsInProgress = false;
  }
}
```

**Note on `isLast`:** The current `TTSPool.synthesize` API returns a final `TTSChunk` after the streaming loop resolves. We can mark the last chunk either by:

- Having `tts_pool.ts` invoke `onChunk` for all segments and also **return the last chunk**, and we send `isLast` from `streamTts` by tracking `sequence` and calling `tts_complete` once; or
- Extending `TTSChunk` with `isLast?: boolean` and letting Python mark the last one.

For minimal change, use `tts_complete` as the explicit end-of-stream marker, and keep `isLast` optional.

---

## 5. TTS Pool Expectations

**File**

- `packages/voice/src/process/tts_pool.ts`
- `packages/voice/scripts/tts_server.py` (Python)

We rely on existing semantics:

- `TTSPool.synthesize(request, onChunk?)`:
  - When `streaming: true` and `onChunk` is provided:
    - Python TTS server emits JSON lines with `type: "audio"` and PCM base64.
    - `onChunk` is invoked **per audio segment** (e.g., per sentence).
  - Method resolves once TTS is fully generated, returning final `TTSChunk`.

For streaming to work as planned, confirm/ensure:

- `TTSChunk` has at least `audioBase64` and `mimeType` (PCM).
- Python server segments outputs into reasonably small PCM chunks (e.g., 0.5–1.0s).

If needed, adjust `tts_server.py` to:

- Use an internal buffer and flush PCM in fixed-size frames or sentence boundaries.
- Include `isLast` in final chunk payload if helpful.

---

## 6. Codec Negotiation Strategy

**Core behavior (austere):**

- For **streaming WebSocket TTS**, the only fully supported codec is **PCM 16kHz mono** (raw).
  - Pros: no per-chunk ffmpeg overhead, minimal latency.
  - Clients (Drive Mode/web) can easily play PCM using:
    - Web: AudioWorklet/AudioBuffer.
    - Native: AVAudioEngine or writing to a temporary WAV container locally.

- `codec` and `negotiatedCodec` fields:
  - Let clients *request* `mp3|opus|wav`.
  - Server can:
    - Immediately downgrade to `"pcm"` and advertise that via `negotiatedCodec`.
    - In a later iteration, if we decide to containerize each chunk (ffmpeg-per-chunk), we can start honoring `mp3|opus|wav` without changing the protocol.

**Clip-based TTS (`speechToSpeech` / `ttsSynthesize`):**

- Continue to use `packages/api/src/voice/codec.ts` to transcode PCM → MP3/Opus/WAV with full files (non-streaming). No change required here.

---

## 7. Drive Mode & Web Client Integration (Design-level Only)

While you requested server-side work, it’s important to specify the client-facing contracts Drive Mode and web should rely on.

### 7.1 Capture behavior (auto-stop)

On both native and web:

- Start:
  - Open WebSocket to `/voice/stream`.
  - Send `{"type": "start", "language": "en", "autoStop": true, "codec": "pcm"}`.
  - Locally start microphone recording.

- During capture:
  - Every N ms (e.g., 200–300ms), stop recorder, extract audio chunk, transcode to **PCM 16kHz mono** using existing converters, then send:

    ```json
    { "type": "audio_chunk", "audioBase64": "<base64>", "mimeType": "audio/pcm" }
    ```

  - Resume recording immediately after sending.

- Auto-stop:
  - Listen for `{type:"auto_stop"}`; when received:
    - Stop local recording immediately.
    - Expect `final_transcript` + `assistant_message` + `tts_chunk` events.

- Manual-stop fallback:
  - User can still hit “stop”; client sends `{"type":"stop"}`.

### 7.2 TTS playback

Drive Mode/web:

- Maintain a playback buffer of `tts_chunk`s per session.
- On first `tts_chunk`:
  - Create an `AudioBufferSourceNode` (web) or feed PCM to AVAudioEngine (native), and start playback immediately.
- On subsequent `tts_chunk`s:
  - Append to buffer or schedule subsequent playback segments.
- On `tts_complete`:
  - Stop queuing new chunks; let playback finish.

Because chunks are PCM, client-side buffering is straightforward and avoids codec mismatch issues.

---

## 8. Hardening & Limits

### 8.1 Timeouts & resource cleanup

Extend `streaming.ts` as follows:

- Per-connection **inactivity timeout**:
  - If no messages (start/chunk/stop/ping) for, say, 30s, close the WebSocket and call `finalizeSession`.
- Per-utterance **max duration** (using `maxUtteranceMs`):
  - When autoStop is enabled, keep a per-session timestamp of `utteranceStartTime` (set on first chunk post `start`).
  - If `Date.now() - utteranceStartTime > maxUtteranceMs`, auto-trigger `handleStop` with reason `"timeout"`.

### 8.2 Error semantics

Standardize error event payloads:

```ts
send(ws, {
  type: "error",
  sessionId: ws.data.sessionId ?? null,
  code: "assistant_failed|tts_failed|stt_failed|invalid_json|...",
  message: messageText,
});
```

Optionally, add `code` field while retaining `message` for human-readable info.

### 8.3 Metrics

Use existing metrics from `.ruler/25-voice-local-models.md`:

- Increment `voice_stream_events_total{event, status}` on:
  - `start`, `audio_chunk`, `stop`, `auto_stop`, `tts_chunk`, `tts_complete`, `error`.
- Record latency in `voice_stream_latency_seconds{stage}`:
  - `stt_chunk` → time from audio_chunk arrival to `partial_transcript`.
  - `assistant` → time from final_transcript to assistant_message.
  - `tts_chunk_first` → time from assistant_message to first tts_chunk.
  - `tts_total` → full TTS duration.

This plugs streaming behavior into the same observability framework as existing voice routes.

---

## 9. Interfaces Summary (Key Types & Signatures)

```xml
<interface path="packages/voice/src/process/stt_pool.ts">
  <type name="STTRequest">
    <field name="audioBase64" type="string" />
    <field name="mimeType" type="string" />
    <field name="language" type="string | undefined" />
    <field name="prompt" type="string | undefined" />
    <field name="streaming" type="boolean | undefined" />
    <field name="vadThreshold" type="number | undefined" />
    <field name="sessionId" type="string | undefined" />
  </type>
  <type name="STTResult">
    <field name="text" type="string" />
    <field name="language" type="string | undefined" />
    <field name="isPartial" type="boolean | undefined" />
    <field name="isEmpty" type="boolean | undefined" />
    <field name="durationSeconds" type="number | undefined" />
    <field name="model" type="string | undefined" />
    <field name="vadConfidence" type="number | undefined" />
    <field name="endOfUtterance" type="boolean | undefined" />
  </type>
  <class name="STTPool">
    <method name="transcribe">
      <param name="request" type="STTRequest" />
      <return>Promise&lt;STTResult&gt;</return>
    </method>
  </class>
</interface>

<interface path="packages/api/src/voice/session.ts">
  <class name="VoiceSession">
    <method name="processAudioChunk">
      <param name="audioBase64" type="string" />
      <param name="mimeType" type="string" />
      <param name="options" type="{ vadThreshold?: number; sessionId?: string } | undefined" />
      <return>Promise&lt;STTResult | null&gt;</return>
    </method>
  </class>
</interface>

<interface path="packages/api/src/voice/assistant.ts">
  <type name="VoiceAssistantInput">
    <field name="text" type="string" />
    <field name="userId" type="string" />
    <field name="language" type="string | undefined" />
    <field name="thread" type="string | undefined" />
    <field name="resource" type="string | undefined" />
  </type>
  <type name="VoiceAssistantResult">
    <field name="text" type="string" />
    <field name="replayId" type="string | undefined" />
    <field name="raw" type="unknown | undefined" />
    <field name="durationSeconds" type="number" />
  </type>
  <fn name="runAssistantForVoice">
    <param name="ctx" type="RuntimeContext" />
    <param name="input" type="VoiceAssistantInput" />
    <return>Promise&lt;VoiceAssistantResult&gt;</return>
  </fn>
</interface>

<interface path="packages/api/src/voice/streaming.ts">
  <type name="VoiceStreamData">
    <field name="sessionId" type="string | undefined" />
    <field name="userId" type="string | undefined" />
    <field name="codec" type='"pcm" | "mp3" | "opus" | "wav" | undefined' />
    <field name="negotiatedCodec" type='"pcm" | "mp3" | "opus" | "wav" | undefined' />
    <field name="vadThreshold" type="number | undefined" />
    <field name="autoStop" type="boolean | undefined" />
    <field name="maxUtteranceMs" type="number | undefined" />
    <field name="ttsVoice" type="string | undefined" />
    <field name="ttsFormat" type='"mp3" | "opus" | "wav" | undefined' />
    <field name="ttsInProgress" type="boolean | undefined" />
    <field name="runtime" type="RuntimeContext | undefined" />
  </type>
  <fn name="handleStart">
    <param name="ws" type="ServerWebSocket&lt;VoiceStreamData&gt;" />
    <param name="payload" type="Record&lt;string, unknown&gt;" />
  </fn>
  <fn name="handleChunk">
    <param name="ws" type="ServerWebSocket&lt;VoiceStreamData&gt;" />
    <param name="payload" type="Record&lt;string, unknown&gt;" />
  </fn>
  <fn name="handleStop">
    <param name="ws" type="ServerWebSocket&lt;VoiceStreamData&gt;" />
  </fn>
  <fn name="streamTts">
    <param name="ws" type="ServerWebSocket&lt;VoiceStreamData&gt;" />
    <param name="text" type="string" />
    <return>Promise&lt;void&gt;</return>
  </fn>
</interface>
```

---

## 10. Concrete Implementation Steps (Summary)

1. **STT VAD propagation**
   - Extend `STTRequest`/`STTResult` in `stt_pool.ts`.
   - Update `transcribe()` to pass `vadThreshold`/`sessionId` and parse `vadConfidence`/`endOfUtterance`.
   - Update `stt_server.py` payloads accordingly.

2. **VoiceSession**
   - Change `processAudioChunk` to return `STTResult | null`.
   - Optionally accept `options` with `vadThreshold`/`sessionId`.

3. **Assistant orchestration**
   - Extract `runAssistantForVoice` into `packages/api/src/voice/assistant.ts`.
   - Refactor `routers/voice.ts` `speechToSpeech` to call this helper.

4. **Streaming runtime context**
   - Import `createContext` in `voice/streaming.ts`.
   - In Bun.serve `fetch`, compute `ctx` and store `ctx.runtime` in `ws.data.runtime`.

5. **Streaming protocol**
   - Extend `VoiceStreamData`.
   - Update `handleStart` to parse codec, VAD, TTS settings, and send `session_started` with `negotiatedCodec`.
   - Update `handleChunk` to:
     - Call `session.processAudioChunk(..., { vadThreshold, sessionId })`.
     - Emit `partial_transcript` & `vad_state`.
     - Auto-call `handleStop` on `endOfUtterance` when `autoStop` is true.

6. **Stop → assistant → TTS**
   - Update `handleStop` to:
     - Emit `final_transcript`.
     - Call `runAssistantForVoice`.
     - Emit `assistant_message`.
     - Call `streamTts` to push `tts_chunk` + `tts_complete`.

7. **Hardening**
   - Add connection/utterance timeouts and close sessions appropriately.
   - Normalize `error` event structure and add metrics for new events/stages.
   - Update `docs/voice/streaming.md` to describe:
     - New message fields and events.
     - VAD auto-stop semantics.
     - TTS streaming behavior and PCM codec constraints.

This plan gives you a minimal but complete path to VAD-driven auto-stop and streamed TTS playback, integrated into the existing local streaming stack and ready for Drive Mode/web clients to consume.
