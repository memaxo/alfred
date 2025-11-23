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

## Outcomes & Retrospective
*   **Success**: Confirmation that the "Holonic" voice loop functions as a coherent system.
*   **Failure**: Discovery of race conditions or state mismatches in `VoiceSession`.
