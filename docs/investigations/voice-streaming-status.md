# Voice Streaming Implementation Investigation

**Date:** January 2025  
**Status:** Investigation Complete

## Executive Summary

The voice streaming infrastructure is **~40% complete**. Core capture/playback works, but streaming, background resilience, and queue management are incomplete. The current implementation uses a clip-based model (record → transcribe → speak) rather than true streaming.

## 1. `voice.stream` tRPC Procedure Status

### Current Implementation

```319:325:packages/api/src/routers/voice.ts
  stream: authedProcedure.input(voiceStreamInput.optional()).subscription(() =>
    observable<{ type: "noop" }>((emit) => {
      emit.next({ type: "noop" });
      emit.complete();
      return () => {};
    })
  ),
```

**Status:** ❌ **Noop stub** - Returns a single `{ type: "noop" }` event and immediately completes.

### Expected Behavior

Based on `docs/native/voice.md` and the workflow stream pattern, `voice.stream` should:

1. **Accept input:**
   - `mode: "clip" | "stream"` (default: "stream")
   - Optional session identifier for resuming

2. **Emit events:**
   ```typescript
   type VoiceStreamEvent =
     | { type: "status"; status: "connecting" | "connected" | "disconnected" }
     | { type: "audio_chunk"; audioBase64: string; mimeType: string; ts: number }
     | { type: "transcript_partial"; text: string; ts: number }
     | { type: "transcript_final"; text: string; language?: string; ts: number }
     | { type: "synthesis_chunk"; audioBase64: string; mimeType: string; ts: number }
     | { type: "error"; message: string; code?: string }
     | { type: "complete" }
   ```

3. **Support bidirectional streaming:**
   - Client sends audio chunks → Server processes STT → Server streams transcripts
   - Server streams TTS audio chunks → Client plays incrementally

4. **Handle background resilience:**
   - Maintain websocket connection
   - Queue events when connection drops
   - Flush queue on reconnect

### Reference Implementation Pattern

The `workflow.stream` subscription provides a good pattern:

```245:286:packages/api/src/routers/workflow.ts
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        const session = ctx.session;
        if (!session) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        // Enforce obligations for medium/high autonomy workflows
        if (input.auto === "medium" || input.auto === "high") {
          try {
            ensureObligations(ctx);
          } catch (error) {
            emit.error(error);
            return () => {};
          }
        }

        const abortController = new AbortController();
        let cancelled = false;
        let timerClosed = false;

        const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };

        const recordEvent = (
          event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
        ) => {
          workflowStreamEventsTotal.inc({ event });
        };

        const push = (event: WorkflowEvent) => {
          if (cancelled) return;
          recordEvent(event.type === "progress" ? "progress" : "chunk");
          emit.next(event);
        };
```

### Missing Components

1. **Real-time audio chunk processing** - No incremental STT/TTS
2. **WebSocket/SSE transport** - Currently uses mutations only
3. **Event queuing** - No persistence for background resilience
4. **Metrics integration** - No telemetry for stream events
5. **Policy enforcement** - No policy checks in stream handler

## 2. Voice Queue/Task System Status

### Current Implementation

#### Queue System (`apps/native/lib/voice/queue.ts`)

```1:48:apps/native/lib/voice/queue.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PendingItem {
  ts: number;
  kind: "stt" | "tts";
  payload: unknown;
}

const KEY = "voice:queue:v1";
const LIMIT = 50;

async function readQueue(): Promise<PendingItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      return value as PendingItem[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(item: PendingItem): Promise<void> {
  const items = await readQueue();
  items.push(item);
  while (items.length > LIMIT) {
    items.shift();
  }
  await writeQueue(items);
}

export async function drain(
  processor: (item: PendingItem) => Promise<void>
): Promise<void> {
  const items = await readQueue();
  if (items.length === 0) return;
  await writeQueue([]);
  for (const item of items) {
    await processor(item);
  }
}
```

**Status:** ✅ **Basic structure exists** but **not integrated**

**Issues:**
- Queue exists but nothing enqueues items
- `drain` is called with empty processor in drive screen
- No type safety for `payload` field
- No error handling or retry logic

#### Task System (`apps/native/lib/voice/task.ts`)

```1:26:apps/native/lib/voice/task.ts
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

export const TASK_VOICE_FLUSH = "VOICE_STREAM_FLUSH";
const MIN_INTERVAL_SECONDS = 15 * 60;

let defined = false;

export function registerVoiceTasks(flush: () => Promise<void>): void {
  if (!defined) {
    TaskManager.defineTask(TASK_VOICE_FLUSH, async () => {
      try {
        await flush();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
    defined = true;
  }
  void BackgroundFetch.registerTaskAsync(TASK_VOICE_FLUSH, {
    minimumInterval: MIN_INTERVAL_SECONDS,
    stopOnTerminate: false,
    startOnBoot: true,
  }).catch(() => {});
}
```

**Status:** ⚠️ **Partially implemented** - Registered but not functional

**Issues:**
- Task is registered but `flush` callback is empty
- No connection to voice session or queue system
- No error recovery or logging
- 15-minute interval is too long for voice streaming

#### Integration in Drive Screen

```38:42:apps/native/app/(drawer)/(tabs)/drive.tsx
  useEffect(() => {
    registerVoiceTasks(async () => {
      await drain(async (_item) => {});
    });
  }, []);
```

**Status:** ❌ **Not functional** - Empty processor, no queue population

### Expected Behavior

Per `docs/native/voice.md`:

1. **Queue population:**
   - When websocket drops, enqueue audio chunks and stream events
   - Store in AsyncStorage with timestamp and type

2. **Background task:**
   - Flush queue when app resumes
   - Retry failed items with exponential backoff
   - Limit retry attempts

3. **Integration:**
   - Voice session should enqueue on connection loss
   - Drive screen should drain on mount/resume
   - Background task should drain periodically

### Missing Components

1. **Queue integration** - Voice session doesn't enqueue
2. **Error handling** - No retry logic or failure tracking
3. **Type safety** - `payload` is `unknown`
4. **Metrics** - No telemetry for queue operations
5. **Connection state** - No websocket state tracking

## 3. Voice Streaming Architecture

### Current Architecture (Clip-Based)

```
User presses button
  ↓
Start recording (ExpoCapture)
  ↓
User releases button
  ↓
Stop recording → Get audio blob
  ↓
Send to voice.sttTranscribe (mutation)
  ↓
Wait for full transcript
  ↓
Send to assistant.generate (mutation)
  ↓
Get full response text
  ↓
Send to voice.ttsSynthesize (mutation)
  ↓
Wait for full audio
  ↓
Play audio
```

**Limitations:**
- No incremental processing
- High latency (wait for full transcript/audio)
- No background resilience
- No real-time feedback

### Expected Architecture (Streaming)

```
User presses button
  ↓
Start recording (ExpoCapture)
  ↓
Subscribe to voice.stream
  ↓
[Streaming Loop]
  ├─ Send audio chunks → Server
  ├─ Receive partial transcripts ← Server
  ├─ Receive final transcript ← Server
  ├─ Send transcript to assistant.stream
  ├─ Receive response chunks ← Server
  ├─ Receive TTS audio chunks ← Server
  └─ Play audio incrementally
  ↓
User releases button
  ↓
Stop recording
  ↓
Flush remaining audio
  ↓
Wait for final transcript
  ↓
Complete stream
```

**Benefits:**
- Low latency (incremental processing)
- Real-time feedback
- Background resilience (queue on disconnect)
- Better UX (progressive updates)

### Missing Components

1. **Incremental STT** - OpenAI Whisper API doesn't support streaming
   - **Solution:** Use OpenAI Realtime API or Faster-Whisper with streaming
   
2. **Incremental TTS** - OpenAI TTS API doesn't support streaming
   - **Solution:** Use OpenAI Realtime API or chunk text and synthesize incrementally

3. **WebSocket transport** - tRPC subscriptions use HTTP polling
   - **Solution:** Use tRPC WebSocket transport or SSE

4. **Audio chunking** - Current implementation records full clip
   - **Solution:** Stream audio chunks during recording

5. **State management** - No connection state tracking
   - **Solution:** Track websocket state and queue on disconnect

## Recommendations

### Priority 1: Implement Basic Streaming (Week 1-2)

1. **Replace noop stub with real implementation:**
   - Accept audio chunks via subscription input
   - Emit transcript events as they arrive
   - Emit TTS chunks incrementally

2. **Integrate queue system:**
   - Enqueue audio chunks on connection loss
   - Drain queue on reconnect
   - Add retry logic with exponential backoff

3. **Add metrics:**
   - Track stream events (connect, disconnect, chunk, error)
   - Measure latency (capture → transcript → TTS)
   - Monitor queue depth

### Priority 2: Background Resilience (Week 2-3)

1. **Wire task system:**
   - Connect `flush` to queue drain
   - Add error recovery
   - Reduce interval to 1-2 minutes for voice

2. **Connection state tracking:**
   - Track websocket state
   - Queue events on disconnect
   - Flush on reconnect

3. **Error handling:**
   - Retry failed queue items
   - Limit retry attempts
   - Log failures for debugging

### Priority 3: Real-Time Processing (Week 3-4)

1. **Incremental STT:**
   - Evaluate OpenAI Realtime API
   - Or implement Faster-Whisper streaming
   - Emit partial transcripts

2. **Incremental TTS:**
   - Chunk text into sentences
   - Synthesize incrementally
   - Stream audio chunks

3. **Audio chunking:**
   - Stream audio during recording
   - Buffer chunks client-side
   - Send chunks to server

## Implementation Plan

### Phase 1: Basic Streaming (Current Priority)

**Files to modify:**
- `packages/api/src/routers/voice.ts` - Implement real stream subscription
- `packages/voice/src/transport/trpc.ts` - Add stream client method
- `apps/native/lib/voice/session.ts` - Integrate streaming
- `apps/native/lib/voice/queue.ts` - Add type safety and error handling

**Key changes:**
1. Replace noop stub with observable that processes audio chunks
2. Emit transcript events incrementally
3. Emit TTS chunks incrementally
4. Add connection state tracking
5. Integrate queue system

### Phase 2: Background Resilience

**Files to modify:**
- `apps/native/lib/voice/task.ts` - Wire flush callback
- `apps/native/lib/voice/queue.ts` - Add retry logic
- `apps/native/app/(drawer)/(tabs)/drive.tsx` - Integrate queue drain

**Key changes:**
1. Connect task flush to queue drain
2. Add retry logic with exponential backoff
3. Track connection state and queue on disconnect
4. Flush queue on reconnect

### Phase 3: Real-Time Processing

**Files to create/modify:**
- `packages/api/src/routers/voice.ts` - Add Realtime API integration
- `packages/voice/src/adapters/native.ts` - Stream audio chunks
- `apps/native/lib/voice/capture.ts` - Emit chunks during recording

**Key changes:**
1. Integrate OpenAI Realtime API or Faster-Whisper
2. Stream audio chunks during recording
3. Emit partial transcripts
4. Stream TTS chunks incrementally

## Testing Strategy

1. **Unit tests:**
   - Queue enqueue/drain operations
   - Stream event emission
   - Error handling and retry logic

2. **Integration tests:**
   - Full streaming flow (record → transcript → TTS)
   - Queue persistence and recovery
   - Background task execution

3. **E2E tests:**
   - Drive mode voice interaction
   - Background resilience (app suspend/resume)
   - CarPlay integration

## Metrics to Track

1. **Stream events:**
   - `voice_stream_events_total{event="connect|disconnect|chunk|error"}`

2. **Latency:**
   - `voice_stream_latency_seconds{stage="capture|stt|tts"}`

3. **Queue operations:**
   - `voice_queue_depth_current`
   - `voice_queue_drain_duration_seconds`
   - `voice_queue_retry_total{outcome="success|failure"}`

4. **Background tasks:**
   - `voice_background_task_executions_total{outcome="success|failure"}`

## Conclusion

The voice streaming infrastructure is **foundational but incomplete**. Core capture/playback works, but streaming, background resilience, and queue management need implementation. The current clip-based model provides a working baseline but lacks the real-time capabilities required for a production voice interface.

**Next steps:**
1. Implement basic streaming subscription (replace noop stub)
2. Integrate queue system with error handling
3. Wire background task system
4. Add metrics and telemetry
5. Evaluate real-time STT/TTS options

