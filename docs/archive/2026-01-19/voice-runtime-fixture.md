# Voice Runtime Fixture

Owner: cognition

Deterministic STT/TTS pools now live in `@alfred/test-kit/voice/runtime-fixture`. The helper installs predictable voice pools, wires them into the real voice registry, and exposes convenience methods for registry-only scenarios. Voice and workflow integration suites use this fixture to exercise the real streaming prototype and runtime without bespoke mocks or Python dependencies.

## Setup

- Export `OPENAI_API_KEY` (any value) so shared router helpers satisfy guardrails.
- No Python or ffmpeg installs are required; the fixture emits static PCM payloads in-process.
- When tests finish, call `voiceFixture.restore()` (the suites already do this in `afterAll`).

## Commands

- `bun test packages/api/test/voice.streaming.integration.test.ts`
- `bun test packages/api/test/voice.streaming.e2e.test.ts`
- `bun test packages/api/test/voice.s2s.e2e.test.ts`
- `bun test packages/api/test/workflow.runtime-integration.test.ts`

## Expected Output

- Voice suites log streaming bootstrap messages similar to:
  - `🎤 voice_stream_proto_listening port=8799`
  - `🎤 voice_session_created sessionId=...`
  - `voice streaming integration > connects and handles start/stop`
- Workflow suite logs the Linear stub interactions (e.g., `[Linear] { action: "activity.thought", sessionId: "lin-123", ... }`) and test summaries such as:
  - `workflow runtime integration (minimal-mock) > persists Linear metadata and emits Linear activity events`
  - `workflow runtime integration (minimal-mock) > records workflow stream metrics for successful runs`

Use these snippets to confirm the fixtures powered the real registry/runtime rather than inline mocks.
