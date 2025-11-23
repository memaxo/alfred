# ExecPlan: Native App Voice Queue Validation

## Purpose
Ensure the native mobile app's offline/retry queue (`VoiceQueue`) functions correctly with the new `VOICE_PROVIDER` configuration, preventing data loss when local models are unavailable or the network is flaky.

## Plan
1.  **Update Test Suite**: Edit `apps/native/lib/voice/__tests__/queue.test.ts`.
2.  **Test Cases**:
    *   **Offline Queueing**: Simulate network failure/model unavailability and verify requests are persisted to `AsyncStorage`.
    *   **Retry Logic**: Trigger a "reconnect" event and verify queued items are processed in order.
    *   **Provider Fallback**: (If applicable) Verify that if `local` fails, it doesn't blindly retry against `openai` unless configured, or vice-versa.
    *   **TTL/Expiry**: Verify that stale voice requests (older than 5 mins) are discarded.

## Outcomes & Retrospective
*   **Success**: Robust offline capability for the native client.
*   **Failure**: Potential for lost voice commands or infinite retry loops.
