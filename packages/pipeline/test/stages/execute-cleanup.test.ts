import {
  ensureServer,
  __internals as serverRegistry,
  stopAllServers,
} from "@alfred/agent/orchestrator/tool/shared/server";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { createPipelineContext } from "../../src/context";
import { DEFAULT_CONFIG } from "../../src/pipeline";
import { ExecuteStage } from "../../src/stages/execute";

describe("ExecuteStage cleanup parity", () => {
  beforeEach(() => {
    serverRegistry.reset();
  });

  afterEach(async () => {
    await stopAllServers("test_end");
  });

  it("stops executor servers on completion", async () => {
    const stop = mock(async (_reason?: string) => {});
    await ensureServer({
      key: "agentfs:test:codex:server",
      start: async () => ({ stop }),
    });

    const stage = new ExecuteStage();
    const ctx = createPipelineContext({
      runId: "run-cleanup-1",
      requirement: "test",
      workspace: process.cwd(),
      userId: "test-user",
      config: { ...DEFAULT_CONFIG, enableLearning: false },
      signal: new AbortController().signal,
      emit: () => {},
      initialContext: [],
      emitContextEvents: false,
    });

    ctx.set("planOutput", {
      subtasks: [],
      execPlans: new Map(),
      rootPlanPath: "root.md",
    });

    await stage.execute(
      {
        waves: [],
        executionMode: "sequential",
        estimatedDuration: 0,
      },
      ctx
    );

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]?.[0]).toBe("workflow_complete");
  });
});
