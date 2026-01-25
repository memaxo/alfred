import type { ExecutionPlan } from "@alfred/cognitive";

import { initialAutonomy } from "@alfred/cognitive/state";
import { beforeEach, describe, expect, it, mock } from "bun:test";

import { PlanRunner } from "../src/loops/plan-runner";

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

type SnapshotLike = {
  lastEventId: string;
  state: Record<string, unknown>;
} | null;
const getLatestSnapshotMock = mock(async (): Promise<SnapshotLike> => null);
const saveSnapshotMock = mock(async () => {});
const appendEventMock = mock(
  async (
    _streamId: string,
    _type: string,
    _payload: Record<string, unknown>
  ) => ({
    id: "00000000-0000-0000-0000-000000000001",
  })
);

mock.module("@alfred/db", () => ({
  db: {}, // Mock db to prevent export errors in other tests
  cognitiveRepo: {
    getLatestSnapshot: getLatestSnapshotMock,
    saveSnapshot: saveSnapshotMock,
    appendEvent: appendEventMock,
  },
}));

const repo = {
  getLatestSnapshot: getLatestSnapshotMock,
  saveSnapshot: saveSnapshotMock,
  appendEvent: appendEventMock,
} as any;

beforeEach(() => {
  process.env.RUNTIME_DISABLE_SAFETY_EMBED = "1";
  process.env.RUNTIME_FORCE_PLAN_RISK_LEVEL = undefined;
  appendEventMock.mockClear();
  getLatestSnapshotMock.mockReset();
  saveSnapshotMock.mockReset();
  getLatestSnapshotMock.mockImplementation(async () => null);
  saveSnapshotMock.mockImplementation(async () => {});
});

// Dynamic import to allow mocks to apply
// import { PlanRunner } from "../src/loops/plan-runner";

describe("PlanRunner", () => {
  const streamId = "test-stream-id";

  it("executes a successful plan", async () => {
    getLatestSnapshotMock.mockImplementationOnce(async () => ({
      lastEventId: "00000000-0000-0000-0000-000000000000",
      state: { auto: { ...initialAutonomy(0), level: 0.5 } as any },
    }));
    const runner = new PlanRunner(streamId, mockTools, repo);
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
    expect(appendEventMock).toHaveBeenCalledTimes(1);
    expect(appendEventMock.mock.calls[0]?.[1]).toBe("cognitive_step_complete");
    const payload = appendEventMock.mock.calls[0]?.[2] as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      v: 1,
      type: "cognitive_step_complete",
      resource: "user",
    });
    expect(payload.data).toMatchObject({
      _: "cognitive_step_complete",
      step: 0,
      action: "test-tool",
      status: "completed",
    });
  });

  it("throws on tool failure", async () => {
    getLatestSnapshotMock.mockImplementationOnce(async () => ({
      lastEventId: "00000000-0000-0000-0000-000000000000",
      state: { auto: { ...initialAutonomy(0), level: 0.5 } as any },
    }));
    const runner = new PlanRunner(streamId, mockTools, repo);
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

    let thrown: unknown;
    await runner.executePlan(plan).catch((error) => {
      thrown = error;
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(
      "Step failed: fail-tool - Tool failed"
    );

    // Step completion event is still emitted for observability.
    expect(appendEventMock).toHaveBeenCalled();
    const lastCall = appendEventMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe("cognitive_step_complete");
    const payload = lastCall?.[2] as Record<string, unknown>;
    expect(payload).toMatchObject({
      v: 1,
      type: "cognitive_step_complete",
      resource: "user",
    });
    expect(payload.data).toMatchObject({
      _: "cognitive_step_complete",
      step: 0,
      action: "fail-tool",
      status: "failed",
    });
  });

  it("suspends on tool suspension", async () => {
    getLatestSnapshotMock.mockImplementationOnce(async () => ({
      lastEventId: "00000000-0000-0000-0000-000000000000",
      state: { auto: { ...initialAutonomy(0), level: 0.5 } as any },
    }));
    const suspendTools = {
      "suspend-tool": {
        execute: mock(async () => {
          const err = new Error("suspended");
          err.name = "SuspendedError";
          throw err;
        }),
      },
    };

    const { PlanRunner } = await import("../src/loops/plan-runner");
    const runner = new PlanRunner(streamId, suspendTools);
    const plan: ExecutionPlan = {
      steps: [
        {
          action: "suspend-tool",
          params: {},
          description: "Suspending",
          timeout: 1000,
          retryable: false,
        },
      ],
      goal: "suspend",
      duration: 0,
      confidence: 1,
    };

    // Should not throw
    await runner.executePlan(plan);
    expect(suspendTools["suspend-tool"].execute).toHaveBeenCalled();
    expect(appendEventMock).toHaveBeenCalledTimes(1);
    const payload = appendEventMock.mock.calls[0]?.[2] as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      v: 1,
      type: "cognitive_step_complete",
      resource: "user",
    });
    expect(payload.data).toMatchObject({
      _: "cognitive_step_complete",
      step: 0,
      action: "suspend-tool",
      status: "suspended",
    });
  });

  it("blocks execution when autonomy is insufficient for assessed risk", async () => {
    process.env.RUNTIME_FORCE_PLAN_RISK_LEVEL = "high";

    const runner = new PlanRunner(streamId, mockTools, repo);
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
    await expect(runner.executePlan(plan)).rejects.toThrow(/Execution gated/);
    process.env.RUNTIME_FORCE_PLAN_RISK_LEVEL = undefined;
  });
});
