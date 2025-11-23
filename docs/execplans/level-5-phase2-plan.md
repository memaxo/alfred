# Level 5 Testing: Phase 2 - Voice & Advanced Scenarios

This ExecPlan focuses on expanding the Level 5 Testing infrastructure to cover Voice S2S (Physical Layer) and complex multi-step Agent workflows.

## Purpose
To prove that the "Physical Layer" (Sensors/Actuators) works on real hardware, and that the "Cognitive Layer" can handle complex, multi-turn reasoning tasks that modify state over time.

## Goals
1.  **Voice Unmocking**: Verify STT/TTS pipelines using `SyntheticSignal` and real local models (where available).
2.  **Advanced Cassettes**: Record a library of "Golden Cassettes" for standard coding tasks (e.g., "Refactor this file", "Write a test").
3.  **Semantic Assertions**: Implement `expect(result).toBeSemanticallyEquivalentTo(...)` to allow for LLM variability in Replay mode (if VCR fuzzy match is too strict).

## Progress
- [ ] **Step 1: Voice E2E Test**
  - Create `packages/test-kit/test/e2e/voice.test.ts`.
  - Use `SyntheticSignal.sine(440)` as input.
  - Send to `voiceRouter.speechToSpeech`.
  - *Conditional*: If `HardwareProbe.gpu` is true, use `VOICE_PROVIDER=local` (real Whisper). Else, use `VOICE_PROVIDER=mock` (or VCR).
  - Assert output is valid audio (header check).

- [ ] **Step 2: Complex Coding Scenario**
  - Create `packages/test-kit/test/e2e/agent-coding.test.ts`.
  - Scenario: "Create a Fastify server in `server.js` and a test in `test.js`. Run the test."
  - Record this interaction (VCR_MODE=record).
  - Replay in CI.
  - Validate `DockerSandbox` handles multiple `codex` calls (write file, run shell, read file).

- [ ] **Step 3: Semantic Matcher**
  - Implement `packages/test-kit/src/cognitive/matcher.ts`.
  - Use a cheap LLM (or deterministic heuristics) to grade agent outputs.

## Success Criteria
*   `bun test test/e2e/voice.test.ts` passes on Mac (with GPU) and Linux (CI, skipping GPU parts).
*   `bun test test/e2e/agent-coding.test.ts` proves the agent can perform a multi-step task (write code -> run code -> fix error -> run code).
