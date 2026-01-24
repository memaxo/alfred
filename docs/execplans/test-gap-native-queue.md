# ExecPlan: Native App Voice Queue Validation

## Purpose

Ensure the native mobile app's offline/retry queue (`VoiceQueue`) functions correctly with the new `VOICE_PROVIDER` configuration, preventing data loss when local models are unavailable or the network is flaky.

## Plan

1.  **Update Test Suite**: Edit `apps/native/lib/voice/__tests__/queue.test.ts`.
2.  **Test Cases**:
    - **Offline Queueing**: Simulate network failure/model unavailability and verify requests are persisted to `AsyncStorage`.
    - **Retry Logic**: Trigger a "reconnect" event and verify queued items are processed in order.
    - **Provider Fallback**: Ensure retries stay within the configured local stack (`maya1` or `supertonic`)—no cloud fallback.
    - **TTL/Expiry**: Verify that stale voice requests (older than 5 mins) are discarded.

## Progress

- **2025-11-26**: Added `apps/native/tests/voice-queue.test.ts` to cover mixed-job draining, retry persistence, overflow limits, and playback sequencing with mocked `expo-av` + `expo-file-system`. The suite runs under Bun with deterministic AsyncStorage and verifies that audio session configuration (background flag) is invoked before playback.

## Surprises & Discoveries

- Playback queuing logic lived inside the React hook, so exercising platform APIs required higher-level tests that import `playBase64` directly while stubbing Expo modules. This validated file I/O and audio calls without a simulator.

## Decision Log

1. **Externalize playback validation.** Rather than duplicating queue tests under `__tests__`, a new `apps/native/tests` target hosts higher-level specs that mimic native runtime behaviour with mocks for Expo AV/FileSystem.

## Outcomes & Retrospective

- **Success**: Robust offline capability for the native client.
- **Failure**: Potential for lost voice commands or infinite retry loops.
