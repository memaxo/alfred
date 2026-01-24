# Level 5 Testing: Comprehensive E2E Environment

This ExecPlan outlines the strategy to "unmock" the system and establish a Domain-Driven Testing Environment that supports Real World ("Level 5") validation.

## Purpose

To transition from "Plumbing Verification" (Level 4) to "Behavioral Validation" (Level 5). We must prove that the **Brain** (LLM) can reason, the **Senses** (Voice) can hear/speak, and the **Hands** (Codex) can affect the world, all within a reusable, reproducible harness.

## The Three Pillars of Reality

We will replace mocks with three distinct "Reality Layers":

1.  **Cognitive Layer (The Brain)**:
    - _Current_: `MockModel` (Hardcoded events).
    - _Target_: **Hybrid VCR/Live Router**.
      - **Replay Mode**: Uses recorded interactions for deterministic CI.
      - **Live Mode**: Connects to real OpenAI/Anthropic/Ollama for behavioral validation.

2.  **Physical Layer (The Senses)**:
    - _Current_: Mock Pools (No-op).
    - _Target_: **Hardware Probe & Service Containers**.
      - Detects if local Voice/GPU services are running.
      - If yes -> runs real inference.
      - If no -> spins up "Lite" versions (CPU-quantized) or gracefully degrades to "Synthetic Signal" (mathematically generated audio).

3.  **Kinetic Layer (The Hands)**:
    - _Current_: `RUNTIME_DISABLE_CODEX=1` (Simulated filesystem).
    - _Target_: **Ephemeral Sandboxes**.
      - Uses `testcontainers` to spin up disposable Docker execution environments.
      - The Agent actually runs `rm -rf` or `npm install` inside the container.

## Architecture: The `TestKit` Domain

We will introduce a new package `@alfred/test-kit` to centralize testing infrastructure, avoiding circular dependencies and scattered scripts.

```
packages/test-kit/
├── src/
│   ├── cognitive/       # LLM VCR, Replay logic, Semantic assertions
│   ├── kinetic/         # Docker/Sandbox management, Container factories
│   ├── physical/        # Audio signal generators, Hardware probes
│   └── env/             # Environment setup (DB, Redis, Config)
```

## Phase 1: The Kinetic Layer (Unmocking Execution)

**Goal**: Verify the agent can actually execute code in a safe, isolated environment.

1.  **Container Factory**:
    - Implement `packages/test-kit/src/kinetic/sandbox.ts`.
    - Use `testcontainers` to spawn `alfred-codex` (or a base Node/Python image).
    - Expose a `CodexBackend` implementation that talks to this dynamic container.

2.  **Integration**:
    - Update `toolCodex` to accept an external `containerId` or `Socket` provided by the test runner.
    - Avoid backend selection hacks; if containerized Codex execution is required, make it an explicit orchestrator feature (not a runtime backend toggle).

## Phase 2: The Cognitive Layer (Unmocking Intelligence)

**Goal**: Verify the agent's reasoning capability without burning API credits on every run.

1.  **Interaction Recorder (VCR)**:
    - Implement `packages/test-kit/src/cognitive/vcr.ts`.
    - Wrap the `LanguageModel` interface.
    - **Record**: Save inputs (prompts) and outputs (streams) to `.cassette.json` files.
    - **Replay**: Match inputs (fuzzy hash) and yield stored streams.

2.  **Semantic Assertions**:
    - String equality fails for LLMs. We need _Semantic_ matching.
    - Implement `expect(result).toBeSemanticallyEquivalentTo("file was created")`.
    - Uses a small, cheap LLM (e.g., `gpt-4o-mini` or local) to grade the test output.

## Phase 3: The Physical Layer (Unmocking Voice)

**Goal**: Verify codec integrity and model inference on real hardware.

1.  **Hardware Probes**:
    - Implement `packages/test-kit/src/physical/probe.ts`.
    - Check availability of NVIDIA GPU / MPS.
    - Check reachability of `localhost:8000` (Voice Server).

2.  **Synthetic Signals**:
    - Instead of hardcoded base64 strings, use `packages/test-kit/src/physical/signal.ts` to generate valid PCM sine waves on the fly with specific frequencies (e.g., "440Hz = Wake Word").

3.  **Test Profile**:
    - `bun test --filter "voice-real"` runs only if Hardware Probe succeeds.

## Progress

- [x] **Step 1: Scaffold `@alfred/test-kit`**
  - Created package structure, `package.json`, `tsconfig.json`.
  - Installed `testcontainers` (v10.16.0).
- [x] **Step 2: Implement Kinetic Sandbox**
  - Implemented `DockerSandbox` in `src/kinetic/sandbox.ts`.
  - Added `packages/test-kit/test/kinetic/sandbox.test.ts`.
  - _Issue_: `testcontainers` seems stuck on a default `LogWaitStrategy` looking for `/.*Started.*/` despite overrides. Requires debugging of environment/library interaction.
- [x] **Step 3: Implement Cognitive VCR**
  - Created `packages/test-kit/src/cognitive/vcr.ts` with `CognitiveVCR` class.
  - Implemented `record`, `save`, `load`, and `findMatch`.
  - Verified with unit tests in `packages/test-kit/test/cognitive/vcr.test.ts`.
- [ ] **Step 4: Refactor Verification Scripts**

## Success Criteria

- **Level 5 Test**: `bun test e2e/agent-coding.test.ts`
  - **Real**: Spins up Docker.
  - **Real**: Agent writes `console.log("hello")` to a file inside Docker.
  - **Real**: Agent runs `node file.js`.
  - **Real**: Test captures stdout from Docker and asserts it equals "hello".
  - **Mocked (Optional)**: LLM is replayed from cassette for speed, OR live for "Deep Validation".

- **Level 5 Test**: `bun test e2e/voice-conversation.test.ts`
  - **Real**: Generates PCM audio.
  - **Real**: Sends to local Python server.
  - **Real**: Python server returns text.
  - **Real**: Text goes to LLM.
  - **Real**: LLM reply goes to TTS.
  - **Real**: Audio returns.
