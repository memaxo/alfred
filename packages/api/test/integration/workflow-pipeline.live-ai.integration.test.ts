/**
 * Live-AI Workflow Pipeline Integration (opt-in)
 *
 * This test is intentionally skipped unless `ALFRED_TEST_LIVE_AI=1` is set.
 * It runs the real workflow pipeline using the configured AI providers.
 */

process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import { beforeEach, describe, expect, it } from "bun:test";
import type { PipelineEvent } from "@alfred/pipeline";

let WorkflowTestHarness: typeof import("../utils/workflow-server").WorkflowTestHarness;
let toObservable: typeof import("../utils/stream").toObservable;

describe("Workflow Pipeline Live-AI (opt-in)", () => {
  beforeEach(async () => {
    ({ WorkflowTestHarness } = await import("../utils/workflow-server"));
    ({ toObservable } = await import("../utils/stream"));
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
