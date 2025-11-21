# Voice Architecture Testing

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

This plan implements a comprehensive test suite for the refactored Voice architecture. This ensures the reliability of the new streaming components, session management, and protocol handling without relying on manual verification or real audio hardware.

After this change:
1.  `packages/voice` will have a full suite of unit and integration tests.
2.  `VoiceSocketHandler` will be verified to handle WebSocket events correctly.
3.  `VoiceSession` will be tested for audio chunk processing and TTS streaming.
4.  Regressions in voice streaming will be detectable via `bun test`.

## Progress

- [x] Phase 1: Unit Tests for Voice Package
    - [x] Create `packages/voice/src/server/session.test.ts`
    - [x] Create `packages/voice/src/server/socket.test.ts`
    - [x] Create `packages/voice/src/stream.test.ts` (Client-side)
- [x] Phase 2: Integration Tests
    - [x] Update `packages/api/test/voice/streaming.test.ts` to test the new architecture
    - [x] Fix `packages/api/test/voice.streaming.integration.test.ts` mocking
- [x] Phase 3: Verification
    - [x] Run all voice tests to ensure pass

## Outcomes & Retrospective

Successfully implemented a comprehensive test suite for the refactored voice architecture.
- `packages/voice` now has unit tests covering both server-side (`VoiceSession`, `VoiceSocketHandler`) and client-side (`VoiceStreamClient`) logic.
- Integration tests in `packages/api` verify the full WebSocket streaming loop with mocked pools.
- Fixed several mocking issues related to Bun's module resolution and global overrides.
- All voice-related tests are passing.

## Context and Orientation

We recently refactored the voice architecture to move logic from `packages/api` to `packages/voice`. The API tests were updated to import from the new locations, but we lack dedicated tests for the new `VoiceSocketHandler` logic within `packages/voice`.

Key components to test:
- `VoiceSocketHandler`: Manages the WebSocket protocol state machine.
- `VoiceSession`: Orchestrates STT and TTS pools.
- `VoiceSessionManager`: Lifecycle management of sessions.

## Plan of Work

### Phase 1: Unit Tests for Voice Package

1.  **Session Tests**:
    - Create `packages/voice/src/server/session.test.ts`.
    - Mock `STTPool` and `TTSPool`.
    - Verify `processAudioChunk` calls STT and updates transcript.
    - Verify `streamSynthesis` calls TTS and invokes callback.

2.  **Socket Tests**:
    - Create `packages/voice/src/server/socket.test.ts`.
    - Mock `VoiceSessionManager` and `VoiceSession`.
    - Test `handleStart` creates session and sends "session_started".
    - Test `handleChunk` processes audio and sends VAD/transcript updates.
    - Test `handleStop` triggers assistant run and TTS streaming.

### Phase 2: Integration Tests

1.  **API Integration**:
    - Review `packages/api/test/voice/streaming.test.ts`.
    - Ensure it creates a real (mocked) server and connects a client.
    - Verify the full loop: Client -> Socket -> Handler -> Session -> Assistant -> TTS -> Socket -> Client.

## Concrete Steps

```bash
# Create test files
touch packages/voice/src/server/session.test.ts
touch packages/voice/src/server/socket.test.ts
```

### Test Implementation Details

**session.test.ts**:
- Use `mock.module` or manual mocks for Pools.
- Test `createSession`, `processAudioChunk`, `streamSynthesis`.

**socket.test.ts**:
- Mock `ServerWebSocket` structure.
- Mock `VoiceSessionManager`.
- Send simulated JSON messages to `handleMessage`.
- Assert `ws.send` calls receive expected JSON payloads.

## Validation and Acceptance

1.  **Run Tests**:
    ```bash
    bun test packages/voice
    ```
2.  **Expectation**: All tests pass with high coverage for the new files.

## Idempotence and Recovery

Tests are non-destructive. If they fail, fix the implementation or the test.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

- `bun:test` for test runner.
- Mocks for `ws` and `pools`.
