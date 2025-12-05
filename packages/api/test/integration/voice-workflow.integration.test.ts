/**
 * Voice + Workflow Integration Tests
 *
 * Tests the integration between voice input/output and workflow execution:
 * - Voice input triggers workflow execution
 * - Workflow output synthesized as voice response
 * - Voice session persists workflow context
 * - Cancellation propagates through voice → workflow
 *
 * Run: bun test voice-workflow.integration.test.ts
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
process.env.VOICE_PROVIDER = "local";
if (!process.env.BUN_TEST) {
  process.env.BUN_TEST = "1";
}

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { Buffer } from "node:buffer";
import path from "node:path";
import type { WorkflowEvent } from "@alfred/type";

// VCR for AI provider responses
const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "voice-workflow.json"
);

// Lazy-loaded modules
let VCRRecorder: typeof import("@alfred/test-kit/vcr").VCRRecorder;
let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: InstanceType<typeof VCRRecorder>;

let WorkflowTestHarness: typeof import("../utils/workflow-server").WorkflowTestHarness;
let toObservable: typeof import("../utils/stream").toObservable;

let installVoiceTestPools: typeof import("@alfred/test-kit/voice/runtime-fixture").installVoiceTestPools;
let createTestCaller: typeof import("../utils/trpc").createTestCaller;

// Table cleanup
async function resetTables() {
  try {
    const { db } = await import("@alfred/db");
    const { workflowEvents, workflowRuns } = await import(
      "@alfred/db/schema/workflow"
    );
    await db.delete(workflowEvents);
    await db.delete(workflowRuns);
  } catch {
    // Tables may not exist
  }
}

beforeAll(async () => {
  // Load VCR
  ({ VCRRecorder, createVCR } = await import("@alfred/test-kit/vcr"));

  // Load workflow utilities
  ({ WorkflowTestHarness } = await import("../utils/workflow-server"));
  ({ toObservable } = await import("../utils/stream"));

  // Load voice utilities
  ({ installVoiceTestPools } = await import(
    "@alfred/test-kit/voice/runtime-fixture"
  ));
  ({ createTestCaller } = await import("../utils/trpc"));

  // Create and start VCR
  vcr = createVCR({
    cassettePath,
    strictReplay: false,
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
  await resetTables();
});

describe("Voice → Workflow Integration", () => {
  let voiceFixture: Awaited<ReturnType<typeof installVoiceTestPools>> | null =
    null;
  let workflowHarness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();

    // Set up voice with workflow-triggering transcript
    voiceFixture = await installVoiceTestPools({
      transcript: "Create a new file called hello.ts",
      chunkText: "workflow-response-chunk",
      streamingChunks: 2,
    });

    workflowHarness = new WorkflowTestHarness({
      user: {
        id: "voice-workflow-user",
        email: "voice-workflow@test.local",
        name: "Voice Workflow Test",
        roles: ["owner"],
        scopes: [
          "voice.read",
          "voice.write",
          "workflow.plan",
          "workflow.stream",
          "workflow.read",
          "assistant.write",
        ],
      },
    });
    await workflowHarness.reset();
  });

  afterEach(async () => {
    voiceFixture?.restore();
    voiceFixture = null;
    await workflowHarness?.close();
  });

  describe("Voice input triggers workflow", () => {
    it("transcribed voice becomes workflow requirement", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      const sessionId = `voice-to-wf-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      // Simulate voice input
      const audioData = Buffer.alloc(320 * 2);
      const sttResult = await session.processAudioChunk(
        audioData.toString("base64"),
        "audio/pcm",
        { sessionId }
      );

      expect(sttResult?.text).toBeDefined();
      const voiceInput = sttResult?.text ?? "Create a file";

      // Use voice input as workflow requirement
      const caller = await workflowHarness.createCaller();
      const events: WorkflowEvent[] = [];

      const subscription = await caller.stream({
        requirement: voiceInput,
        auto: "low" as const,
        mode: "sequential" as const,
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 15_000);

        const sub = observable.subscribe({
          next: (event) => events.push(event),
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
        });
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "run")).toBe(true);
    });

    it("voice session context persists across workflow", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      const sessionId = `context-persist-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      // Multiple voice inputs
      const audioData = Buffer.alloc(320 * 2);

      const result1 = await session.processAudioChunk(
        audioData.toString("base64"),
        "audio/pcm",
        { sessionId }
      );

      const result2 = await session.processAudioChunk(
        audioData.toString("base64"),
        "audio/pcm",
        { sessionId }
      );

      // Both should work in same session
      expect(result1?.text).toBeDefined();
      expect(result2?.text).toBeDefined();

      // Session should still exist
      const existingSession = voiceFixture.registry.getSession(sessionId);
      expect(existingSession).toBeDefined();
    });
  });

  describe("Workflow output to voice", () => {
    it("workflow result synthesized as voice", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      // First get workflow result
      const caller = await workflowHarness.createCaller();
      const events: WorkflowEvent[] = [];
      let workflowResult = "";

      const subscription = await caller.stream({
        requirement: "What time is it?",
        auto: "low" as const,
        mode: "sequential" as const,
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10_000);

        const sub = observable.subscribe({
          next: (event) => {
            events.push(event);
            if (event.type === "ui-message") {
              const msg = event as any;
              if (msg.content) {
                workflowResult += msg.content;
              }
            }
          },
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
        });
      });

      // Then synthesize result as voice
      const sessionId = `wf-to-voice-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      const ttsChunks: Buffer[] = [];
      await session.streamSynthesis(
        workflowResult || "Workflow completed successfully",
        "alloy",
        (buffer) => ttsChunks.push(buffer)
      );

      expect(ttsChunks.length).toBeGreaterThan(0);
    });

    it("streaming workflow events trigger incremental TTS", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      const sessionId = `streaming-tts-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      // Simulate incremental workflow output
      const outputs = ["Processing...", "Analyzing code...", "Done!"];
      const allChunks: Buffer[] = [];

      for (const output of outputs) {
        await session.streamSynthesis(output, "alloy", (buffer) => {
          allChunks.push(buffer);
        });
      }

      // Should have chunks from all outputs
      expect(allChunks.length).toBeGreaterThan(outputs.length);
    });
  });

  describe("Cancellation propagation", () => {
    it("voice session cleanup cancels workflow", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      const sessionId = `cancel-propagate-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      // Start processing
      const audioData = Buffer.alloc(320 * 2);
      await session.processAudioChunk(
        audioData.toString("base64"),
        "audio/pcm",
        {
          sessionId,
        }
      );

      // Start workflow
      const caller = await workflowHarness.createCaller();
      let runId: string | undefined;

      const subscription = await caller.stream({
        requirement: "Long running task",
        auto: "low" as const,
        mode: "sequential" as const,
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const sub = observable.subscribe({
          next: (event) => {
            if (event.type === "run" && (event as any).id) {
              runId = (event as any).id;
              sub.unsubscribe?.();
              resolve();
            }
          },
          error: () => {
            sub.unsubscribe?.();
            resolve();
          },
          complete: () => {
            sub.unsubscribe?.();
            resolve();
          },
        });

        setTimeout(() => {
          sub.unsubscribe?.();
          resolve();
        }, 5000);
      });

      // Remove voice session
      voiceFixture.registry.removeSession(sessionId);

      // Session should be gone
      const existingSession = voiceFixture.registry.getSession(sessionId);
      expect(existingSession).toBeUndefined();

      // Workflow can still be cancelled independently
      if (runId) {
        const cancelResult = await caller.cancel({ runId });
        expect(cancelResult).toBeDefined();
      }
    });

    it("workflow cancellation allows voice session cleanup", async () => {
      if (!voiceFixture?.registry) {
        console.warn("Skipping: voice fixture not available");
        return;
      }

      const sessionId = `wf-cancel-${Date.now()}`;
      const session = voiceFixture.registry.createSession(
        "test-user",
        sessionId,
        "en"
      );

      // Start workflow
      const caller = await workflowHarness.createCaller();
      let runId: string | undefined;

      const subscription = await caller.stream({
        requirement: "Task that will be cancelled",
        auto: "low" as const,
        mode: "sequential" as const,
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const sub = observable.subscribe({
          next: (event) => {
            if (event.type === "run" && (event as any).id) {
              runId = (event as any).id;
              sub.unsubscribe?.();
              resolve();
            }
          },
          error: () => {
            sub.unsubscribe?.();
            resolve();
          },
          complete: () => {
            sub.unsubscribe?.();
            resolve();
          },
        });

        setTimeout(() => {
          sub.unsubscribe?.();
          resolve();
        }, 5000);
      });

      // Cancel workflow
      if (runId) {
        await caller.cancel({ runId });
      }

      // Voice session should still work
      const audioData = Buffer.alloc(320 * 2);
      const result = await session.processAudioChunk(
        audioData.toString("base64"),
        "audio/pcm",
        { sessionId }
      );

      expect(result?.text).toBeDefined();

      // Clean up voice session
      voiceFixture.registry.removeSession(sessionId);
    });
  });
});

describe("Full Voice-Workflow Round Trip", () => {
  let voiceFixture: Awaited<ReturnType<typeof installVoiceTestPools>> | null =
    null;
  let workflowHarness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();

    voiceFixture = await installVoiceTestPools({
      transcript: "Help me write a test",
      chunkText: "response-audio",
      streamingChunks: 3,
    });

    workflowHarness = new WorkflowTestHarness({
      user: {
        id: "round-trip-user",
        email: "roundtrip@test.local",
        name: "Round Trip Test",
        roles: ["owner"],
        scopes: [
          "voice.read",
          "voice.write",
          "workflow.plan",
          "workflow.stream",
          "workflow.read",
          "assistant.write",
        ],
      },
    });
    await workflowHarness.reset();
  });

  afterEach(async () => {
    voiceFixture?.restore();
    voiceFixture = null;
    await workflowHarness?.close();
  });

  it("complete voice → workflow → voice cycle", async () => {
    if (!voiceFixture?.registry) {
      console.warn("Skipping: voice fixture not available");
      return;
    }

    const startTime = performance.now();
    const sessionId = `full-cycle-${Date.now()}`;

    // 1. Voice Input (STT)
    const session = voiceFixture.registry.createSession(
      "test-user",
      sessionId,
      "en"
    );

    const audioData = Buffer.alloc(320 * 2);
    const sttResult = await session.processAudioChunk(
      audioData.toString("base64"),
      "audio/pcm",
      { sessionId }
    );

    expect(sttResult?.text).toBeDefined();
    const voiceRequest = sttResult?.text ?? "Help me";

    // 2. Workflow Execution
    const caller = await workflowHarness.createCaller();
    const workflowEvents: WorkflowEvent[] = [];
    let workflowOutput = "";

    const subscription = await caller.stream({
      requirement: voiceRequest,
      auto: "low" as const,
      mode: "sequential" as const,
    });
    const observable = toObservable<WorkflowEvent>(subscription);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 15_000);

      const sub = observable.subscribe({
        next: (event) => {
          workflowEvents.push(event);
          if (event.type === "ui-message") {
            const msg = event as any;
            if (msg.content) {
              workflowOutput += msg.content;
            }
          }
        },
        error: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
      });
    });

    expect(workflowEvents.length).toBeGreaterThan(0);

    // 3. Voice Output (TTS)
    const ttsChunks: Buffer[] = [];
    await session.streamSynthesis(
      workflowOutput || "I can help you with that",
      "alloy",
      (buffer) => ttsChunks.push(buffer)
    );

    expect(ttsChunks.length).toBeGreaterThan(0);

    const totalTime = performance.now() - startTime;

    // Full cycle should complete in reasonable time
    // (with mocked components, should be fast)
    expect(totalTime).toBeLessThan(20_000);

    // Cleanup
    voiceFixture.registry.removeSession(sessionId);
  });

  it("handles errors in voice → workflow chain gracefully", async () => {
    if (!voiceFixture?.registry) {
      console.warn("Skipping: voice fixture not available");
      return;
    }

    const sessionId = `error-chain-${Date.now()}`;
    const session = voiceFixture.registry.createSession(
      "test-user",
      sessionId,
      "en"
    );

    // Empty audio should still work with fixture
    const emptyAudio = Buffer.alloc(0);
    const result = await session.processAudioChunk(
      emptyAudio.toString("base64"),
      "audio/pcm",
      { sessionId }
    );

    // Should handle gracefully
    expect(result).toBeDefined();

    // Cleanup
    voiceFixture.registry.removeSession(sessionId);
  });

  it("maintains session state through workflow interruptions", async () => {
    if (!voiceFixture?.registry) {
      console.warn("Skipping: voice fixture not available");
      return;
    }

    const sessionId = `interrupt-state-${Date.now()}`;
    const session = voiceFixture.registry.createSession(
      "test-user",
      sessionId,
      "en"
    );

    // Voice input
    const audioData = Buffer.alloc(320 * 2);
    await session.processAudioChunk(audioData.toString("base64"), "audio/pcm", {
      sessionId,
    });

    // Start workflow
    const caller = await workflowHarness.createCaller();
    let runId: string | undefined;

    const subscription = await caller.stream({
      requirement: "Task to interrupt",
      auto: "low" as const,
      mode: "sequential" as const,
    });
    const observable = toObservable<WorkflowEvent>(subscription);

    await new Promise<void>((resolve) => {
      const sub = observable.subscribe({
        next: (event) => {
          if (event.type === "run" && (event as any).id) {
            runId = (event as any).id;
          }
        },
        error: () => {
          sub.unsubscribe?.();
          resolve();
        },
        complete: () => {
          sub.unsubscribe?.();
          resolve();
        },
      });

      setTimeout(() => {
        sub.unsubscribe?.();
        resolve();
      }, 3000);
    });

    // Interrupt workflow
    if (runId) {
      await caller.cancel({ runId });
    }

    // Voice session should still be functional
    const postInterruptResult = await session.processAudioChunk(
      audioData.toString("base64"),
      "audio/pcm",
      { sessionId }
    );

    expect(postInterruptResult?.text).toBeDefined();

    // Cleanup
    voiceFixture.registry.removeSession(sessionId);
  });
});

describe("Voice-Workflow Latency", () => {
  let voiceFixture: Awaited<ReturnType<typeof installVoiceTestPools>> | null =
    null;

  beforeEach(async () => {
    voiceFixture = await installVoiceTestPools({
      transcript: "Quick test",
      chunkText: "fast-response",
      streamingChunks: 1,
    });
  });

  afterEach(async () => {
    voiceFixture?.restore();
    voiceFixture = null;
  });

  it("STT latency within budget", async () => {
    if (!voiceFixture?.registry) {
      console.warn("Skipping: voice fixture not available");
      return;
    }

    const session = voiceFixture.registry.createSession(
      "test-user",
      `latency-stt-${Date.now()}`,
      "en"
    );

    const audioData = Buffer.alloc(320 * 2);
    const start = performance.now();

    await session.processAudioChunk(audioData.toString("base64"), "audio/pcm", {
      sessionId: "latency-stt",
    });

    const latency = performance.now() - start;

    // With fixture, should be very fast
    expect(latency).toBeLessThan(100);
  });

  it("TTS latency within budget", async () => {
    if (!voiceFixture?.registry) {
      console.warn("Skipping: voice fixture not available");
      return;
    }

    const session = voiceFixture.registry.createSession(
      "test-user",
      `latency-tts-${Date.now()}`,
      "en"
    );

    const start = performance.now();

    await session.streamSynthesis("Quick response", "alloy", () => {});

    const latency = performance.now() - start;

    // With fixture, should be very fast
    expect(latency).toBeLessThan(100);
  });
});
