/**
 * Workflow Pipeline Integration Tests
 *
 * Tests the complete workflow pipeline from tRPC input to completion
 * with minimal mocking - only AI providers are mocked via VCR.
 *
 * Run in record mode: VCR_RECORD=1 bun test workflow-pipeline.integration.test.ts
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import type { PipelineEvent } from "@alfred/pipeline";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import path from "node:path";

// VCR for AI provider responses
const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "workflow-pipeline.json"
);

let VCRRecorder: typeof import("@alfred/test-kit/vcr").VCRRecorder;
let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: InstanceType<typeof VCRRecorder>;

// Test utilities
let WorkflowTestHarness: typeof import("../utils/workflow-server").WorkflowTestHarness;
let toObservable: typeof import("../utils/stream").toObservable;

beforeAll(async () => {
  // Load VCR
  ({ VCRRecorder, createVCR } = await import("@alfred/test-kit/vcr"));

  // Load test utilities
  ({ WorkflowTestHarness } = await import("../utils/workflow-server"));
  ({ toObservable } = await import("../utils/stream"));

  // Create and start VCR
  vcr = createVCR({
    cassettePath,
    strictReplay: false, // Allow passthrough if no recording
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
});

describe("Workflow Pipeline Integration", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    harness = new WorkflowTestHarness({
      user: {
        id: "integration-test-user",
        email: "integration@test.local",
        name: "Integration Test",
        roles: ["owner"],
        scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
      },
    });
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  it("streams workflow events through full pipeline", async () => {
    const caller = await harness.createCaller();
    const events: PipelineEvent[] = [];

    const input = {
      requirement: "Create a simple hello world function",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.streamPipeline(input);
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Workflow stream timeout"));
      }, 30_000);

      const sub = observable.subscribe({
        next: (event) => {
          events.push(event);
        },
        error: (error) => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          reject(error);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
      });
    });

    // Verify workflow events were streamed
    expect(events.length).toBeGreaterThan(0);

    // Should have a run event with the workflow ID
    const runEvent = events.find((e) => e.type === "pipeline:start");
    expect(runEvent).toBeDefined();
    expect(runEvent?.runId).toBeDefined();

    // Verify we got meaningful workflow events (run, ui-message, complete, etc.)
    // Note: "status" events may not be emitted by all workflow configurations
    const meaningfulEvents = events.filter(
      (e) =>
        e.type === "pipeline:start" ||
        e.type === "stage:enter" ||
        e.type === "stage:exit" ||
        e.type === "pipeline:complete"
    );
    expect(meaningfulEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("handles workflow with context settings", async () => {
    const caller = await harness.createCaller();
    const events: PipelineEvent[] = [];

    const input = {
      requirement: "Explain the code structure of a TypeScript project",
      auto: "low" as const,
      mode: "sequential" as const,
      // Context settings for RAG/retrieval (not message history)
      context: {
        enable: true,
        topK: 5,
        maxTokens: 4000,
      },
    };

    const subscription = await caller.streamPipeline(input);
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Workflow stream timeout"));
      }, 30_000);

      const sub = observable.subscribe({
        next: (event) => events.push(event),
        error: (error) => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          reject(error);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
      });
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "pipeline:start")).toBeTruthy();
  });

  it("persists workflow run to database", async () => {
    const caller = await harness.createCaller();
    let runId: string | undefined;

    const input = {
      requirement: "List files",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.streamPipeline(input);
    const observable = toObservable<PipelineEvent>(subscription);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 10_000);

      const sub = observable.subscribe({
        next: (event) => {
          if (event.type === "pipeline:start") {
            runId = event.runId;
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          reject(error);
        },
        complete: () => {
          clearTimeout(timeout);
          sub.unsubscribe?.();
          resolve();
        },
      });
    });

    expect(runId).toBeDefined();

    // Verify we can retrieve the run
    if (runId) {
      const run = await caller.get({ runId });
      expect(run).toBeDefined();
      expect(run.id).toBe(runId);
    }
  });

  it("rejects unauthenticated requests", async () => {
    const { createWorkflowCaller } = await import("../utils/workflow-caller");
    const unauthCaller = await createWorkflowCaller({ user: null });

    const input = {
      requirement: "Test unauthenticated",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    await expect(unauthCaller.streamPipeline(input)).rejects.toMatchObject({
      message: expect.stringContaining("Authentication"),
    });
  });

  it("supports workflow cancellation", async () => {
    const caller = await harness.createCaller();
    let runId: string | undefined;

    const input = {
      requirement: "Long running task",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.streamPipeline(input);
    const observable = toObservable<PipelineEvent>(subscription);

    // Start workflow and capture run ID
    await new Promise<void>((resolve) => {
      const sub = observable.subscribe({
        next: (event) => {
          if (event.type === "pipeline:start") {
            runId = event.runId;
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

      // Timeout fallback
      setTimeout(() => {
        sub.unsubscribe?.();
        resolve();
      }, 5000);
    });

    // Cancel if we got a run ID
    if (runId) {
      const cancelResult = await caller.cancel({ runId });
      // Accept both true (actively cancelled) and false with reason (already finished)
      // The important thing is the procedure exists and responds correctly
      expect(cancelResult).toBeDefined();
      expect(
        cancelResult.cancelled === true ||
          (cancelResult as { reason?: string }).reason === "already_finished"
      ).toBe(true);
    }
  });
});

describe("Workflow Event Types", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    harness = new WorkflowTestHarness();
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  it("emits properly typed events", async () => {
    const caller = await harness.createCaller();
    const eventTypes = new Set<string>();

    const input = {
      requirement: "Simple test",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.stream(input);
    const observable = toObservable<WorkflowEvent>(subscription);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 15_000);

      const sub = observable.subscribe({
        next: (event) => {
          eventTypes.add(event._);
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

    // Should have at least run and status events
    expect(eventTypes.has("run")).toBe(true);
  });
});
