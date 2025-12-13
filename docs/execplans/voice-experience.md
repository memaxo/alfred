# Voice Experience & Reliability Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

This plan focuses on elevating the Voice experience from "functional" to "conversational" and "observable". We will implement low-latency interruptibility (barge-in), integrate real-time voice state into the Mindscape UI, and establish comprehensive telemetry to monitor session quality.

After this change:
1.  **Conversational Feel**: The assistant will stop speaking immediately when the user interrupts.
2.  **Visual Feedback**: The UI will react to voice activity in real-time.
3.  **Observability**: We will have visibility into network quality and component latency.

## Progress

- [x] Phase 1: VAD-Driven Interruptibility (Barge-In)
    - [x] Update `@alfred/type` to include `voice_interrupt` event.
    - [x] Update `VoiceSocketHandler` (Server) to emit `voice_interrupt` when VAD triggers during TTS playback.
    - [x] Update `VoiceStreamClient` (Client) to handle `voice_interrupt` by clearing audio queues.
    - [x] Update `useVoiceSessionWeb` to stop local playback on interrupt.
    - [x] Update `useVoiceSessionNative` to handle interrupt event (clearing queue).
- [x] Phase 2: Mindscape Visualization
    - [x] Expose `vadLevel` (volume/confidence) from `useVoiceSessionWeb`. (Via global store)
    - [x] Update `OrbNode` or `VoiceNode` in Mindscape to animate based on `vadLevel`.
    - [x] Connect streaming status (connecting, listening, speaking) to the visualizer.
- [x] Phase 3: Telemetry & Monitoring
    - [x] Define telemetry events in `@alfred/type` (packet_loss, jitter, latencies).
    - [x] Instrument `VoiceStreamClient` to track sequence numbers and report loss (Handled via existing events, added report type).
    - [x] Instrument `VoiceSession` to record granular component latencies (STT, LLM, TTS).
    - [x] Create a basic dashboard or log sink for voice metrics. (Admin stats endpoint + Prometheus metrics)

## Outcomes & Retrospective

Implemented VAD-driven interruptibility across the stack.
- **Protocol**: Added `interrupt` event.
- **Server**: Logic added to detect barge-in (VAD > threshold + TTS playing) and signal client.
- **Clients**: Web and Native hooks updated to handle the signal and reset playback state/queues.

Implemented real-time Mindscape visualization.
- **State**: Created `useVoiceVisualizerStore` to share VAD/Analyser state without prop drilling.
- **Component**: Updated `OrbNode` to visualize VAD energy levels and map stream status (recording/processing/playing) to Orb states (listening/thinking/speaking).
- **Hook**: `useVoiceSessionWeb` now updates the global store with VAD analyser node and stream status.

Telemetry: Added `telemetry_report` event type to schema and handlers, plus server-side component latency instrumentation (STT, assistant/LLM, TTS).

Telemetry: Added granular server-side latency instrumentation for STT/TTS (streaming `VoiceSession`) and LLM/orchestrator latency (streaming `VoiceSocketHandler`), surfaced via Prometheus and the existing admin stats endpoint.

**Implementation evidence (Phase 3):**
- `packages/voice/src/server/session.ts` instruments streaming STT/TTS and records Prometheus metrics (`stt_stream_transcribe`, `tts_stream_synthesize`) plus `voice_stt_*` / `voice_tts_*` counters+histograms (see lines 47-120).
- `packages/voice/src/server/socket.ts` records assistant latency/count on the streaming stop path (see lines 463-510).
- `packages/voice/src/metrics.ts` adds `voice_assistant_*` metrics and `recordVoiceAssistant()` helper (see lines 70-126).
- `packages/api/src/voice/telemetry.ts` includes `assistantLatency` in `collectVoiceTelemetry()` so `admin.getVoiceStats` reports it (see lines 1-50).

This completes the core experience improvements for voice. The system now supports barge-in, visual feedback, and has both network-quality telemetry (`telemetry_report`) and server-side component latency instrumentation.

## Context and Orientation

The current system streams audio bi-directionally using binary frames. However, if the user speaks while the assistant is talking, the assistant keeps talking until the server processes the new input and decides to stop. This creates an awkward "talking over each other" experience.

The UI is also static regarding voice state, mostly showing text status updates.

## Plan of Work

### Phase 1: VAD-Driven Interruptibility

1.  **Protocol**: Add `type: "interrupt"` to server events.
2.  **Server Logic (`socket.ts`)**:
    - In `handleChunk`, if `vadState.startOfSpeech` is detected AND `ttsInProgress` is true:
        - Stop TTS stream.
        - Send `interrupt` event to client.
        - Clear server-side TTS buffer.
3.  **Client Logic (`stream.ts`, `useVoiceSessionWeb.ts`)**:
    - Listen for `interrupt`.
    - On receipt: `audioContext.suspend()` or clear buffer queue immediately.

### Phase 2: Mindscape Visualization

1.  **Hook Update**:
    - `useVoiceSessionWeb` should return a `visualizer` object with `fft` data or simple volume levels if available from `EnergyVAD`.
    - Currently `EnergyVAD` is internal. We need to expose the `AnalyserNode`.
2.  **Component Update**:
    - `apps/web/src/components/mindscape/nodes/orb-node.tsx`:
    - Subscribe to `visualizer` data.
    - Use `requestAnimationFrame` to drive a canvas or SVG/CSS animation (e.g., pulsing ring).

### Phase 3: Telemetry

1.  **Client-Side Metrics**:
    - Track `lastSequenceId`. If a chunk arrives with `seq != last + 1`, increment `packetLoss`.
    - Periodically send `telemetry_report` to server via WebSocket.
2.  **Server-Side Metrics**:
    - We already have Prometheus metrics. We will expand them to include "interruption_count" and "client_reported_loss".

## Concrete Steps

```bash
# No new files needed immediately, will modify existing.
```

## Validation and Acceptance

1.  **Barge-in Test**: Start assistant speaking long text. Speak into mic. Assistant should stop within < 500ms.
2.  **Visual Test**: Speaking into mic should make the Orb node pulse.
3.  **Metrics**: Logs should show interruption events.

## Idempotence and Recovery

Changes are additive to protocol. Old clients will ignore `interrupt` events (graceful degradation).

## Interfaces and Dependencies

- Web Audio API (`AnalyserNode`) for visualization.
