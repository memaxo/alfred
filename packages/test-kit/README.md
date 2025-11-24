# @alfred/test-kit

Reusable fixtures for integration and end-to-end suites.

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
