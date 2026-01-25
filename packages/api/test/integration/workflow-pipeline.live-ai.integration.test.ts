/**
 * Live-AI Workflow Pipeline Integration (opt-in)
 *
 * This test is intentionally skipped unless `ALFRED_TEST_LIVE_AI=1` is set.
 * It runs the real workflow pipeline using the configured AI providers.
 */
import type { PipelineEvent } from "@alfred/pipeline";

import { beforeEach, describe, expect, it } from "bun:test";

type WorkflowHarnessCtor = new (args: {
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    scopes: string[];
  };
}) => {
  reset: () => Promise<void>;
  createCaller: () => Promise<{
    streamPipeline: (input: {
      requirement: string;
      auto: "low";
      mode: "sequential";
    }) => Promise<unknown>;
  }>;
  close: () => Promise<void>;
};

interface ObservableLike<T> {
  subscribe: (handlers: {
    next: (event: T) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }) => { unsubscribe?: () => void };
}

type ToObservableFn = <T>(sub: unknown) => ObservableLike<T>;

let WorkflowTestHarness: WorkflowHarnessCtor;
let toObservable: ToObservableFn;

describe("Workflow Pipeline Live-AI (opt-in)", () => {
  beforeEach(async () => {
    process.env.DISABLE_TRPC_METRICS = "1";
    process.env.DISABLE_METRICS_HOOKS = "1";

    ({ WorkflowTestHarness } =
      (await import("../utils/workflow-server")) as unknown as {
        WorkflowTestHarness: WorkflowHarnessCtor;
      });
    ({ toObservable } = (await import("../utils/stream")) as unknown as {
      toObservable: ToObservableFn;
    });
  });

  it.skipIf(process.env.ALFRED_TEST_LIVE_AI !== "1")(
    "streams workflow events with real providers",
    async () => {
      const harness = new WorkflowTestHarness({
        user: {
          id: "live-ai-test-user",
          email: "live-ai@test.local",
          name: "Live AI Test",
          roles: ["owner"],
          scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
        },
      });
      await harness.reset();
      try {
        const caller = await harness.createCaller();
        const events: PipelineEvent[] = [];

        const subscription = await caller.streamPipeline({
          requirement: "Create a minimal hello-world function in TypeScript",
          auto: "low" as const,
          mode: "sequential" as const,
        });
        const observable = toObservable<PipelineEvent>(subscription);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Workflow stream timeout (live-ai)"));
          }, 120_000);

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

        const runEvent = events.find((e) => e.type === "pipeline:start");
        expect(runEvent).toBeDefined();
        expect(runEvent?.runId).toBeDefined();
      } finally {
        await harness.close();
      }
    }
  );
});
