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

describe("workflow.compilation.get", () => {
  let caller: Awaited<ReturnType<typeof createWorkflowCaller>>;

  beforeAll(async () => {
    caller = await createWorkflowCaller();
  });

  it("persists compilation for a pipeline run and returns it", async () => {
    const runId = crypto.randomUUID();

    const observable = toObservable<PipelineEvent>(
      await caller.streamPipeline({
        requirement: "test compilation persistence",
        runId,
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

    expect(events.at(0)?.type).toBe("pipeline:start");
    expect(events.at(-1)?.type).toBe("pipeline:complete");

    const compilation = await caller.compilation.get({ runId });
    expect(compilation).not.toBeNull();
    expect(compilation?.runId).toBe(runId);
    expect(compilation?.summaryText).toBe(
      "Implemented changes and updated docs."
    );
    expect(compilation?.fileChanges.modified).toContain(
      "apps/web/src/example.tsx"
    );
    expect(compilation?.fileChanges.created).toContain("docs/report.md");
    expect(compilation?.agents.length).toBeGreaterThan(0);
    expect(compilation?.agents[0]?.agentId).toBe("agent-1");
  });
});
