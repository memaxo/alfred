import { beforeAll, describe, expect, it, mock } from "bun:test";
import type { PipelineEvent } from "@alfred/pipeline";
import { installPipelineMocks } from "./utils/pipeline";
import { setupTestEnv } from "./utils/router-helpers";
import { toObservable } from "./utils/stream";

setupTestEnv();
installPipelineMocks({
  dbRepo: true,
  sessionRecovery: true,
  linear: true,
  runtimeLinear: true,
  preferenceRefresh: true,
});

mock.module("../src/workflow/access", () => ({
  enforceWorkflowPlanPolicy: async () => ({ obligations: [] }),
}));

const { createWorkflowCaller } = await import("./utils/workflow-caller");

describe("workflow pipeline stream", () => {
  let caller: Awaited<ReturnType<typeof createWorkflowCaller>>;

  beforeAll(async () => {
    caller = await createWorkflowCaller();
  });

  it("streams PipelineEvent values in order", async () => {
    const observable = toObservable<PipelineEvent>(
      await caller.streamPipeline({
        requirement: "test pipeline stream",
      })
    );

    const events: PipelineEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        next: (event) => events.push(event),
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.type).toBe("pipeline:start");
    expect(events.some((event) => event.type === "stage:progress")).toBe(true);
    expect(events.at(-1)?.type).toBe("pipeline:complete");
  });

  it("persists escalation events to workflow events history", async () => {
    const observable = toObservable<PipelineEvent>(
      await caller.streamPipeline({
        requirement: "test pipeline persist",
      })
    );

    const events: PipelineEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        next: (event) => events.push(event),
        error: (err) => reject(err),
        complete: () => resolve(),
      });
    });

    const runId = events.find((e) => e.type === "pipeline:start")?.runId;
    expect(typeof runId).toBe("string");
    expect(runId?.length).toBeGreaterThan(0);

    const persisted = await caller.events({ runId: runId ?? "" });
    const escalation = persisted.find((e) => {
      const env = e.eventData as unknown as { data?: unknown } | null;
      const data =
        env &&
        typeof env === "object" &&
        env.data &&
        typeof env.data === "object"
          ? (env.data as Record<string, unknown>)
          : null;
      return e.eventType === "notice" && data?.kind === "escalation";
    });
    expect(escalation).toBeTruthy();
  });
});
