# @alfred/test-kit

Reusable fixtures for integration and end-to-end suites.

## Test Sandbox

Use `createTestSandbox()` for tests that create temporary files. This ensures files are created in `os.tmpdir()` instead of polluting the repository.

```ts
import { createTestSandbox, type TestSandbox } from "@alfred/test-kit";
import { writeFileSync } from "node:fs";

describe("My Test", () => {
  let sandbox: TestSandbox;

  beforeEach(() => {
    sandbox = createTestSandbox("my-test-");
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it("writes files safely", () => {
    // All files go to /tmp/my-test-xxxxx/
    writeFileSync(sandbox.path("file.txt"), "content");

    // Create subdirectories
    const venvDir = sandbox.mkdir(".venv/bin");
  });
});
```

### Available utilities

- `createTestSandbox(prefix)` - Creates an isolated temp directory
- `createTrackedSandbox(prefix)` - Auto-cleanup on process exit
- `createWorkspaceFixture(prefix)` - Standard workspace + outside dir structure
- `assertInSandbox(path)` - Throws if path is outside temp directory
- `cleanupAllSandboxes()` - Clean up all tracked sandboxes

### Important rules

1. **Never use** `path.join(process.cwd(), "tmp")` for temp files
2. **Always cleanup** in `afterEach` or use `createTrackedSandbox()`
3. **Security tests are an exception** - they must use repo-relative paths to test `openDirectorySecure()` boundary enforcement

## Voice runtime fixture

`@alfred/test-kit/voice/runtime-fixture` exposes deterministic STT/TTS pools that exercise the real voice registry and WebSocket stack without python processes or ffmpeg. The helper keeps behavior identical across suites and allows overriding transcripts/chunks when needed.

```ts
import { installVoiceTestPools } from "@alfred/test-kit/voice/runtime-fixture";

const voiceFixture = await installVoiceTestPools({
  transcript: "mock transcript",
  chunkText: "pcm-sample",
});

const { initializeVoicePools } = await import("@alfred/api/voice/pools");
await initializeVoicePools(); // stubbed to a no-op by the fixture

// ...run your test...

voiceFixture.restore();
```

Use `createVoiceTestRegistry` when you only need a `VoiceRegistry` instance (e.g., speech-to-speech unit tests) and `installVoiceTestPools` when the test invokes the voice streaming server.
