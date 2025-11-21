# Voice Performance Testing

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

This plan upgrades the Voice testing suite from functional verification to performance validation. We will verify the binary transport path, simulate load to check for event loop blocking, and measure end-to-end latency to ensure the architecture delivers a "Real-Time" feel.

After this change:
1.  We will have proof that binary audio frames are processed correctly.
2.  We will know the system's capacity (concurrent sessions).
3.  We will have a baseline latency metric for the streaming pipeline.

## Progress

- [ ] Phase 1: Binary Path Verification
    - [ ] Update `packages/voice/src/server/socket.test.ts` to send/receive `Buffer` frames.
    - [ ] Verify `VoiceSocketHandler` correctly routes binary data to `VoiceSession`.
- [ ] Phase 2: Latency Benchmark
    - [ ] Create `packages/voice/test/latency.bench.ts`.
    - [ ] Implement a test using `VoiceStreamClient` and a local server to measure RTT.
    - [ ] Use "delay-mocked" pools to simulate inference time.
- [ ] Phase 3: Load Testing
    - [ ] Create `packages/voice/test/load.bench.ts`.
    - [ ] Simulate 50+ concurrent clients sending 50 chunks/sec (20ms pcm).
    - [ ] Measure event loop lag or processing time.

## Surprises & Discoveries

- Observation: ...
  Evidence: ...

## Decision Log

- Decision: ...
  Rationale: ...
  Date/Author: ...

## Outcomes & Retrospective

...

## Context and Orientation

We previously implemented binary transport and native Opus support. However, current tests only check the JSON control path. We need to verify the hot path (binary audio) and ensure the system scales.

## Plan of Work

### Phase 1: Binary Path Verification

1.  **Socket Test Update**:
    - Modify `packages/voice/src/server/socket.test.ts`.
    - Add a test case `should handle binary audio message`.
    - Create a `Buffer`, pass it to `handleMessage`.
    - Assert `mockSession.processAudioChunk` was called with the base64 string (since internal logic converts it for now) or raw buffer if we optimized that deep. *Note: Internal logic currently converts to base64 string for STT pool compatibility.*

### Phase 2: Latency Benchmark

1.  **Benchmark Script**:
    - Use `Bun.serve` to spin up a real WebSocket server using `VoiceSocketHandler`.
    - Use `VoiceStreamClient` to connect.
    - `MockSTTPool` should instantly return text to measure pure overhead, or sleep 10ms to simulate fast inference.
    - Send `AudioChunk` -> Measure time until `PartialTranscript` received.

### Phase 3: Load Testing

1.  **Load Script**:
    - Similar to benchmark, but spawn 50 clients.
    - Each client sends 50 messages/sec.
    - Server should log "processed" count.
    - Check if server crashes or lags.

## Concrete Steps

```bash
# Create benchmark files
mkdir -p packages/voice/test/bench
touch packages/voice/test/bench/latency.ts
touch packages/voice/test/bench/load.ts
```

## Validation and Acceptance

1.  **Binary Test**: `bun test packages/voice/src/server/socket.test.ts` passes.
2.  **Benchmarks**: Run `bun packages/voice/test/bench/latency.ts` and output RTT < 50ms (excluding inference).

## Artifacts and Notes

None yet.
