# ExecPlan: End-to-End Voice Session Test

## Purpose
Validate the full voice interaction loop (S2S) from client audio input to client audio output, ensuring that STT, Agent/LLM, and TTS components work together with the new streaming architecture.

## Plan
1.  **Create E2E Test**: Create `packages/api/test/voice.s2s.e2e.test.ts`.
2.  **Setup Test Environment**:
    *   Use `createTestDb` for isolated database state.
    *   Mock the *actual* Python processes (to avoid heavy model loading) but keep the `Process` class logic intact to test IPC.
    *   Alternatively, use a "Lightweight" mock mode for the Python scripts if possible, or stick to high-level mocks of `STTPool` and `TTSPool`.
3.  **Test Flow**:
    *   **Input**: Simulate a client sending an audio buffer (Base64 PCM).
    *   **STT**: Verify `VoiceRegistry` receives the audio and calls `STTPool`.
    *   **Agent**: Verify the STT text triggers a workflow/agent response (mocked LLM output).
    *   **TTS**: Verify the agent response is sent to `TTSPool`.
    *   **Output**: Verify the `TTSPool` output stream is sent back to the client session.
4.  **Assertions**:
    *   Verify latency (mocked processing time) matches expectations.
    *   Verify event sequence: `listening` -> `processing` -> `speaking`.

## Progress
- **2025-11-26**: Added browser-run Playwright spec `apps/web/tests/voice-session.e2e.spec.ts` that spins up a deterministic mock WebSocket server backed by `@alfred/test-kit/voice/runtime-fixture`. Coverage now includes binary chunk streaming, assistant message delivery, timeout/cleanup, server error surfacing, and concurrent session management.
- **2025-11-26**: Landed `packages/voice/test/e2e/session.test.ts` to exercise `VoiceSession` + `VoiceRegistry` at the library boundary (capturing audio, streaming synthesis, registry stats, and TTS failure handling) so lower layers fail fast before API wiring.

## Surprises & Discoveries
- Playwright workers cannot call `Bun.serve`, so the WebSocket harness had to be rewritten with `ws` while still reusing the deterministic voice registry fixture. This led to adding a lightweight `createVoiceFixture` helper to `@alfred/test-kit`.
- The existing runtime fixture depended on `vi` mocks; exporting a non-mocking helper lets both Node-based Playwright tests and Bun unit tests share the same deterministic pools without extra scaffolding.

## Decision Log
1. **Reuse deterministic pools for all protocol tests.** Rather than duplicating mocks, `createVoiceFixture` exposes the registry so every environment (Bun + Node) can drive STT/TTS with identical outputs.
2. **Protocol-first Playwright coverage.** Instead of UI automation, the new spec uses `VoiceStreamClient` directly to keep failure signals tight and avoid dealing with browser media APIs in CI.

## Outcomes & Retrospective
*   **Success**: Confirmation that the "Holonic" voice loop functions as a coherent system.
*   **Failure**: Discovery of race conditions or state mismatches in `VoiceSession`.
