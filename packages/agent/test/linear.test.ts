import { beforeEach, describe, expect, it, mock } from "bun:test";

const executeMock = mock(async () => ({ ok: true, id: "activity-123" }));

mock.module("../src/orchestrator/tool/ticket", () => ({
  toolTicket: {
    execute: executeMock,
  },
}));

mock.module("p-retry", () => {
  const pRetry = <T>(fn: (attemptNumber: number) => T | Promise<T>) =>
    Promise.resolve(fn(1));
  class AbortError extends Error {}
  return { default: pRetry, AbortError };
});

const { emitLinearActivity, extractIssueIdFromSession } = await import(
  "../src/orchestrator/linear"
);
const { configureLinearMetrics } = await import(
  "../src/orchestrator/linearmetrics"
);

describe("linear helpers", () => {
  beforeEach(() => {
    executeMock.mockReset();
    configureLinearMetrics({
      linearActivityEmissionsTotal: { inc: () => {} },
      linearActivityDurationSeconds: { startTimer: () => () => {} },
      linearSessionOperationsTotal: { inc: () => {} },
    });
  });

  it("emitLinearActivity forwards parameters and records success metrics", async () => {
    const emissionsInc = mock();
    const timerStop = mock();

    configureLinearMetrics({
      linearActivityEmissionsTotal: { inc: emissionsInc },
      linearActivityDurationSeconds: {
        startTimer: () => () => timerStop(),
      },
      linearSessionOperationsTotal: { inc: () => {} },
    });

    executeMock.mockResolvedValueOnce({ ok: true, id: "activity-321" });

    const result = await emitLinearActivity("thought", {
      sessionId: "session-id",
      space: "workspace-1",
      authz: "Bearer token",
      title: "Title",
      body: "Body text",
      parameter: "param",
      result: "result",
      ephemeral: true,
    });

    expect(result).toEqual({ ok: true, id: "activity-321" });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith({
      input: {
        space: "workspace-1",
        action: "activity.thought",
        sessionId: "session-id",
        authz: "Bearer token",
        title: "Title",
        description: "Body text",
        parameter: "param",
        result: "result",
        ephemeral: true,
      },
    });
    expect(emissionsInc).toHaveBeenCalledWith({
      type: "thought",
      status: "success",
    });
    expect(timerStop).toHaveBeenCalledTimes(1);
  });

  it("emitLinearActivity returns failure without throwing when tool errors", async () => {
    const emissionsInc = mock();
    configureLinearMetrics({
      linearActivityEmissionsTotal: { inc: emissionsInc },
      linearActivityDurationSeconds: { startTimer: () => () => {} },
      linearSessionOperationsTotal: { inc: () => {} },
    });

    executeMock.mockRejectedValueOnce(new Error("linear-fault"));

    const result = await emitLinearActivity("action", {
      sessionId: "sess",
      space: "workspace",
      authz: "token",
    });

    expect(result).toEqual({ ok: false });
    expect(emissionsInc).toHaveBeenCalledWith({
      type: "action",
      status: "failure",
    });
  });

  it("extractIssueIdFromSession validates session identifier shape", () => {
    expect(extractIssueIdFromSession("")).toBeNull();
    expect(extractIssueIdFromSession("   ")).toBeNull();
    expect(
      extractIssueIdFromSession(
        "session_abc123_2025-11-12T07:00:00.000Z"
      )
    ).toBe("session_abc123_2025-11-12T07:00:00.000Z");
  });
});
