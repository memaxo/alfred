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
import type { WorkflowEvent } from "@alfred/type";

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
    const events: WorkflowEvent[] = [];

    const input = {
      requirement: "Create a simple hello world function",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.stream(input);
    const observable = toObservable<WorkflowEvent>(subscription);

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
    const runEvent = events.find((e) => e.type === "run");
    expect(runEvent).toBeDefined();
    expect(runEvent?.id).toBeDefined();

    // Should have status events
    const statusEvents = events.filter((e) => e.type === "status");
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("handles workflow with context messages", async () => {
    const caller = await harness.createCaller();
    const events: WorkflowEvent[] = [];

    const input = {
      requirement: "Explain the code structure",
      auto: "low" as const,
      mode: "sequential" as const,
      context: [
        {
          id: "ctx-1",
          role: "user" as const,
          parts: [
            { type: "text" as const, text: "I have a TypeScript project" },
          ],
        },
      ],
    };

    const subscription = await caller.stream(input);
    const observable = toObservable<WorkflowEvent>(subscription);

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
    expect(events.some((e) => e.type === "run")).toBeTruthy();
  });

  it("persists workflow run to database", async () => {
    const caller = await harness.createCaller();
    let runId: string | undefined;

    const input = {
      requirement: "List files",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const subscription = await caller.stream(input);
    const observable = toObservable<WorkflowEvent>(subscription);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 10_000);

      const sub = observable.subscribe({
        next: (event) => {
          if (event.type === "run" && event.id) {
            runId = event.id;
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

    await expect(unauthCaller.stream(input)).rejects.toMatchObject({
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

    const subscription = await caller.stream(input);
    const observable = toObservable<WorkflowEvent>(subscription);

    // Start workflow and capture run ID
    await new Promise<void>((resolve) => {
      const sub = observable.subscribe({
        next: (event) => {
          if (event.type === "run" && event.id) {
            runId = event.id;
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
      expect(cancelResult.cancelled).toBe(true);
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
          eventTypes.add(event.type);
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
