import { describe, expect, it, mock } from "bun:test";
import type { ExecutionPlan } from "@alfred/cognitive/schemas";

// Mock Agent Defaults
const mockTools = {
  "test-tool": {
    execute: mock(async (params: any) => `executed with ${params.value}`),
  },
  "fail-tool": {
    execute: mock(async () => {
      throw new Error("Tool failed");
    }),
  },
};

mock.module("@alfred/agent", () => ({
  getAssistantAgentDefaults: () => ({
    tools: mockTools,
  }),
}));

// Mock Cognitive Repo
mock.module("@alfred/db", () => ({
  cognitiveRepo: {
    getLatestSnapshot: mock(async () => null),
    saveSnapshot: mock(async () => {}),
  },
}));

// Dynamic import to allow mocks to apply
// import { PlanRunner } from "../src/loops/plan-runner";

describe("PlanRunner", () => {
  const streamId = "test-stream-id";

  it("executes a successful plan", async () => {
    const { PlanRunner } = await import("../src/loops/plan-runner");
    const runner = new PlanRunner(streamId, mockTools);
    const plan: ExecutionPlan = {
      steps: [
        {
          action: "test-tool",
          params: { value: "foo" },
          description: "Testing",
          timeout: 1000,
          retryable: false,
        },
      ],
      goal: "test",
      duration: 0,
      confidence: 1,
    };

    await runner.executePlan(plan);

    expect(mockTools["test-tool"].execute).toHaveBeenCalled();
    expect(mockTools["test-tool"].execute.mock.calls[0][0]).toEqual({
      value: "foo",
    });
  });

  it("throws on tool failure", async () => {
    const { PlanRunner } = await import("../src/loops/plan-runner");
    const runner = new PlanRunner(streamId, mockTools);
    const plan: ExecutionPlan = {
      steps: [
        {
          action: "fail-tool",
          params: {},
          description: "Failing",
          timeout: 1000,
          retryable: false,
        },
      ],
      goal: "fail",
      duration: 0,
      confidence: 1,
    };

    expect(runner.executePlan(plan)).rejects.toThrow(
      "Step failed: fail-tool - Tool failed"
    );
  });
});
