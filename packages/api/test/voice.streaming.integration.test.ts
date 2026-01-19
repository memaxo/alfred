// SKIP: This test uses mock.module() at the top level which causes Bun's module
// cache pollution when run with other tests. The test passes in isolation but
// fails or hangs when run alongside other tests. See test isolation refactor task.
// NOTE: Refactor to use dependency injection instead of mock.module().
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { createServer } from "node:net";

// Gate all module-level side effects behind a flag so they don't pollute other tests
const SHOULD_RUN = process.env.RUN_VOICE_STREAMING_TESTS === "1";

if (SHOULD_RUN) {
  // Install stable, full-surface stubs to prevent cross-test module conflicts.
  await import("./utils/mock-db-client");
  await import("./utils/agent-mock");
  await import("./utils/mock-metrics");

  // Mock auth
  mock.module("@alfred/auth", () => ({
    auth: {
      api: {
        getSession: async () => ({
          user: { id: "test-user", role: "user" },
          session: { id: "test-session" },
        }),
      },
    },
  }));

  // Mock dependencies that require native modules or external services
  mock.module("node-pty", () => ({}));

  mock.module("@alfred/db/repo/policy", () => ({
    createAuditLog: async () => {},
  }));
}

// Dynamic import only when tests should run
let installVoiceTestPools: typeof import("@alfred/test-kit/voice/runtime-fixture").installVoiceTestPools;
type VoiceFixtureHandle = { restore: () => void } | null;

const describeFn = SHOULD_RUN ? describe : describe.skip;

describeFn("voice streaming integration", () => {
  let port = 0;
  let startVoiceStreamingPrototype: any;
  let stopVoiceStreamingPrototype: any;
  let initializeVoicePools: any;
  let shutdownVoicePools: any;
  let voiceFixture: VoiceFixtureHandle | null = null;

  async function getFreePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      server.close();
      throw new Error("free_port_unavailable");
    }
    const p = addr.port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return p;
  }

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = "dummy"; // Satisfy any other checks
    process.env.VOICE_PROVIDER = "maya1";
    process.env.VOICE_STREAMING_PROTO = "1";
    port = await getFreePort();
    process.env.VOICE_STREAMING_PORT = String(port);

    const { installVoiceTestPools: installPools } = await import(
      "@alfred/test-kit/voice/runtime-fixture"
    );
    installVoiceTestPools = installPools;
    voiceFixture = await installVoiceTestPools({
      transcript: "mock transcript",
      chunkText: "stream-chunk",
    });

    const streaming = await import("@alfred/api/voice/streaming");
    startVoiceStreamingPrototype = streaming.startVoiceStreamingPrototype;
    stopVoiceStreamingPrototype = streaming.stopVoiceStreamingPrototype;

    const pools = await import("@alfred/api/voice/pools");
    initializeVoicePools = pools.initializeVoicePools;
    shutdownVoicePools = pools.shutdownVoicePools;

    await initializeVoicePools();
    startVoiceStreamingPrototype();
  });

  afterAll(async () => {
    stopVoiceStreamingPrototype();
    await shutdownVoicePools();
    voiceFixture?.restore();
  });

  it("connects and handles start/stop", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/voice/stream`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Test timed out"));
      }, 5000);

      ws.onopen = () => {
        ws.send(JSON.stringify({ _: "start", language: "en" }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        if (msg._ === "ready") {
          return;
        }

        if (msg._ === "session_started") {
          expect(msg.sessionId).toBeDefined();
          ws.send(JSON.stringify({ _: "stop" }));
        }

        if (msg._ === "final_transcript") {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message || "unknown"}`));
      };
    });
  });
});
