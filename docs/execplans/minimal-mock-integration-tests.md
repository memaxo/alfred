# Minimal-Mock Integration Test Harness

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Our current integration suites rely on bespoke mocks that hide real regressions. After implementing this plan a contributor will be able to run the API voice streaming tests, speech-to-speech end-to-end tests, and workflow runtime integration tests against real subsystems (voice registry, streaming prototype, workflow runtime) while mocking only true external boundaries such as auth or third-party APIs. A new `packages/test-kit` voice runtime fixture will give every suite identical deterministic STT/TTS behavior. The workflow runtime suite will execute actual runs, emit metrics, and talk to a stubbed Linear HTTP surface, proving that resumes, cancellations, and streaming events behave correctly.

## Progress

- [x] (2025-11-24 05:45Z) Captured current state and requirements in this ExecPlan.
- [ ] Implement shared voice runtime fixture under `packages/test-kit/src/voice`.
- [ ] Adopt the shared fixture in `packages/api/test/voice.streaming.integration.test.ts` and related suites, ensuring no direct STT/TTS mocks remain.
- [ ] Build a workflow runtime fixture, migrate `packages/api/test/workflow.runtime-integration.test.ts`, and document acceptance evidence.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Use deterministic PCM chunks and transcripts in the shared voice fixture instead of real ffmpeg or Python processes to keep tests fast while still running the true registry and streaming code.  
  Rationale: Determinism plus real registry behavior exposes orchestration bugs without introducing heavy dependencies or GPU requirements.  
  Date/Author: 2025-11-24 / Codex

## Outcomes & Retrospective

This section must be updated when each milestone completes to summarize achieved behavior, outstanding gaps, and lessons learned.

## Context and Orientation

The voice stack lives under `packages/voice` and exposes pools (`process/stt.ts`, `process/tts.ts`), a `VoiceRegistry` (`packages/voice/src/server/registry.ts`), and WebSocket handling (`packages/voice/src/server/socket.ts`). API tests currently mock these classes inline, e.g. `packages/api/test/voice.streaming.integration.test.ts`. The new fixture will live inside `packages/test-kit`, which already houses reusable test helpers (see `packages/test-kit/src/physical`). Workflow integration tests run in `packages/api/test/workflow.runtime-integration.test.ts` and presently mock runtime, Linear integration, and metrics via `packages/api/test/utils/router-helpers.ts`.

Key repos modules:

- `packages/api/src/voice/pools.ts` exposes `initializeVoicePools`, `shutdownVoicePools`, and `getVoicePools`. Tests normally import and override these functions to supply test pools.
- `packages/api/src/voice/streaming.ts` starts the WebSocket prototype; it depends on the pools being initialized with Maya1 or Supertonic providers.
- `packages/api/src/workflow` contains runtime routers and metrics; `workflow.runtime-integration.test.ts` exercises this flow but currently replaces everything with stubs.
- `packages/test-kit` is the canonical place for reusable fixtures. It currently exports `src/physical`, `src/cognitive`, etc., but nothing voice-specific yet.

Terminology reminders:

- “Voice runtime fixture” refers to a module that constructs deterministic STT and TTS pools, wires them into the existing voice registry, and offers helpers to override API tests’ pool initialization.
- “Workflow runtime fixture” will spin up the actual workflow runtime (the orchestrator that consumes `WorkflowEvent` streams) while substituting the Linear HTTP boundary with a stub server that returns canned responses.

## Plan of Work

First, move the current ad-hoc voice fixture (added in `packages/api/test/utils/voice-fixture.ts`) into `packages/test-kit/src/voice/runtime-fixture.ts`. Expose two helpers: `createVoiceTestRegistry(config)` for direct registry access and `installVoiceTestPools(config)` that monkey patches `initializeVoicePools`/`getVoicePools` to return deterministic pools. Each helper must accept overrides for transcript text and chunk sample so tests can tailor outputs. Export them via `packages/test-kit/src/index.ts`.

Next, update `packages/api/test/voice.streaming.integration.test.ts`, `voice.s2s.e2e.test.ts`, and `voice.streaming.e2e.test.ts` to import the new fixture instead of defining their own mocks. Remove inline `mock.module("@alfred/voice/process/*")` blocks. Ensure each suite calls `voiceFixture.restore()` in `afterAll` to undo spies. When a test needs custom transcripts or chunk payloads, pass them through the fixture config rather than rewriting the pool classes. Confirm no direct dependency on `@discordjs/opus` or Python remains in these suites.

Third, create documentation inside `packages/test-kit/README.md` explaining how to consume the voice fixture, noting that it does not require ffmpeg or GPU and that it is deterministic. Include examples showing how to override transcripts or chunk content.

Fourth, design the workflow runtime fixture. Create `packages/test-kit/src/workflow/runtime-fixture.ts`. This fixture should:

1. Start the real workflow runtime by importing `packages/runtime/src/index.ts` (or the concrete runner the API uses) and providing in-memory repositories for runs and telemetry.
2. Replace the Linear HTTP integration by spinning up a local Bun server (e.g., using `Bun.serve`) that mimics the endpoints our runtime calls (`/graphql` or REST). Provide canned responses for creating delegates, posting activity, and fetching tickets.
3. Expose helper methods like `withWorkflowRuntime(async fn)` that initializes the runtime + stub server, runs `fn` with a context containing references to the runtime, stub server URL, and tear-down logic, then cleans up.

Fifth, refactor `packages/api/test/workflow.runtime-integration.test.ts` to use the workflow fixture. Remove `mockWorkflowRepo`, `mockRunRegistry`, and `mockWorkflowRuntime` from `packages/api/test/utils/router-helpers.ts` for this suite. In the test setup:

- Call `withWorkflowRuntime` to obtain a runtime context.
- Configure the API caller to point to the stub Linear server (e.g., via env var `LINEAR_BASE_URL` consumed by the integration module).
- Run the existing scenarios (e.g., linear session mapping, metrics recording) against the real runtime, asserting on emitted TRPC events and stub Linear calls (e.g., the stub server should log activity payloads).

Finally, update the docs section `docs/testing/voice-runtime-fixture.md` (create if absent) summarizing how to run these integration tests locally:

1. `bun test packages/api/test/voice.streaming.integration.test.ts`
2. `bun test packages/api/test/workflow.runtime-integration.test.ts`

Document the expected log snippets (voice session creation, workflow runtime start) so a novice can validate success.

## Concrete Steps

1. Move the existing fixture code from `packages/api/test/utils/voice-fixture.ts` to `packages/test-kit/src/voice/runtime-fixture.ts`, update exports, and delete the old file. Update import paths in the two voice test files accordingly.
2. Edit `packages/test-kit/src/index.ts` to `export * from "./voice/runtime-fixture";`.
3. Update `packages/test-kit/README.md` with a new “Voice runtime fixture” section demonstrating usage.
4. Update `packages/api/test/voice.streaming.integration.test.ts`, `voice.s2s.e2e.test.ts`, and `voice.streaming.e2e.test.ts` to import `installVoiceTestPools`/`createVoiceTestRegistry` from `@alfred/test-kit/voice/runtime-fixture`.
5. Create `packages/test-kit/src/workflow/runtime-fixture.ts` implementing the helper described above; expose it via `packages/test-kit/src/index.ts`.
6. Refactor `packages/api/test/workflow.runtime-integration.test.ts` to use `withWorkflowRuntime`. Remove obsolete mocks and ensure the test now waits for real workflow events.
7. Add `docs/testing/voice-runtime-fixture.md` summarizing setup and validation commands.
8. Run targeted tests:
   - `bun test packages/api/test/voice.s2s.e2e.test.ts`
   - `bun test packages/api/test/voice.streaming.integration.test.ts`
   - `bun test packages/api/test/voice.streaming.e2e.test.ts`
   - `bun test packages/api/test/workflow.runtime-integration.test.ts`
   capture short expected outputs for the docs.

## Validation and Acceptance

Acceptance requires demonstrating that the new fixtures power the integration suites without bespoke mocks.

1. In the repo root, run `bun test packages/api/test/voice.s2s.e2e.test.ts` and observe logs such as  
   `voice_session_created` followed by `voice_session_removed`. The test should pass, proving the real registry handled STT and TTS via the shared fixture.
2. Run `bun test packages/api/test/voice.streaming.integration.test.ts` and check for `voice_stream_proto_listening` plus `voice_session_created`. The WebSocket client should receive the ready/session/final messages.
3. Run `bun test packages/api/test/workflow.runtime-integration.test.ts`. The workflow runtime fixture should log the stub Linear calls and the test should assert on real stream events.
4. Confirm that `docs/testing/voice-runtime-fixture.md` describes the above commands and expected outputs.

If any test fails, fix the underlying issue or update the plan accordingly. The change is accepted only when all suites pass against the real fixtures as described.

## Idempotence and Recovery

Fixture helpers must be safe to reuse. `installVoiceTestPools` should be idempotent: calling it multiple times should replace previous spies cleanly, and `restore()` should always be safe even if initialization failed midway. The workflow fixture should ensure the stub Linear server shuts down even if a test panics; wrap setup in `try/finally` blocks. If a WebSocket test crashes, rerunning the test file after calling `stopVoiceStreamingPrototype()` is sufficient; the plan does not require manual cleanup.

## Artifacts and Notes

Example voice streaming test output:

    $ bun test packages/api/test/voice.streaming.integration.test.ts
    🎤 voice_stream_proto_listening port=8799
    🎤 voice_session_created sessionId=123 ...
    ✔ voice streaming integration > connects and handles start/stop

Example workflow runtime test output will include stub Linear logs such as:

    [linear-stub] POST /activity payload={"issueId":"LIN-1","message":"workflow started"}

Include these snippets in the docs so a novice can verify success.

## Interfaces and Dependencies

Expose the following from the voice fixture module:

    // packages/test-kit/src/voice/runtime-fixture.ts
    export type VoiceTestOptions = {
        transcript?: string;
        chunkText?: string;
    };

    export function createVoiceTestRegistry(options?: VoiceTestOptions): {
        registry: VoiceRegistry;
        sttPool: STTPool;
        ttsPool: TTSPool;
    };

    export function installVoiceTestPools(options?: VoiceTestOptions): Promise<{
        registry: VoiceRegistry;
        sttPool: STTPool;
        ttsPool: TTSPool;
        restore(): void;
    }>;

The workflow fixture should export:

    export type WorkflowRuntimeHandle = {
        runtime: WorkflowRuntime;
        linearStubUrl: string;
        stop(): Promise<void>;
    };

    export async function withWorkflowRuntime(
        fn: (handle: WorkflowRuntimeHandle) => Promise<void>
    ): Promise<void>;

The stub Linear server can be implemented with `Bun.serve`, responding to the exact endpoints `packages/agent/src/integrations/linear.ts` invokes.

---

Revision 0 (2025-11-24): Initial plan drafted to align integration suites with minimal-mock expectations. Updates must note changes here.
