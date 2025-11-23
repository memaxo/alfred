# ExecPlan: STT Streaming Pipeline Verification

## Purpose
Verify that the `STTPool` and underlying `Process` correctly handle and emit partial transcripts from the NeMo Parakeet server, enabling real-time feedback for the user.

## Plan
1.  **Create Verification Script**: Create `scripts/verify-stt-streaming.ts`.
    *   This should be a standalone script (like the other verify scripts) that spawns the *real* Python process (if available) or a specialized mock that mimics the VAD chunking behavior.
2.  **Refine Unit Test**: Update `packages/voice/test/stt-streaming.test.ts` to mock the `Process` class more realistically, specifically simulating multiple `onPartial` IPC events before the final result.
3.  **Test Scenarios**:
    *   **Partial Emission**: Simulate a long utterance and verify multiple `isPartial: true` events are emitted.
    *   **Finalization**: Verify the final `isPartial: false` event contains the complete, corrected text.
    *   **VAD Interruption**: Simulate a silence gap and verify `endOfUtterance` triggers correctly.

## Outcomes & Retrospective
*   **Success**: Verified contract between Python STT server and TypeScript consumer for partials.
*   **Failure**: Detection of dropped partials or incorrect `isPartial` flags.
