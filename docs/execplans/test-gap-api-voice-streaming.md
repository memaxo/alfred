# ExecPlan: API-Level Voice Streaming Integration Test

## Purpose
Verify that the `voice` tRPC router correctly streams audio chunks from the `TTSPool` to the client, ensuring that the partial chunk emission logic implemented in Maya/Supertonic is preserved through the API layer.

## Plan
1.  **Create Integration Test**: Create `packages/api/test/voice.router.streaming.test.ts`.
2.  **Setup Test Context**:
    *   Mock `TTSPool` to emit known chunks via the `onChunk` callback.
    *   Instantiate the `voice` router with the mocked pool.
3.  **Test Cases**:
    *   **Happy Path**: Request TTS with `streaming: true` and verify that `onChunk` events are received by the caller (via a mocked `trpc` subscription or generator, depending on implementation).
    *   **Format Verification**: Assert that received chunks are Base64 encoded PCM Int16 (as required by the client).
    *   **Error Propagation**: Simulate a stream error in the pool and verify it propagates to the client.
    *   **Provider Selection**: Verify `VOICE_PROVIDER` env var correctly toggles between `maya1` and `supertonic` paths in the router.

## Outcomes & Retrospective
*   **Success**: A passing test suite confirming low-latency chunk delivery.
*   **Failure**: Identification of buffering or blocking logic in the `voice` router or `VoiceRegistry`.
