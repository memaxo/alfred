import { beforeEach, describe, expect, it, mock } from "bun:test";

const executeMock = mock(async () => ({ ok: true, id: "activity-123" }));

mock.module("../src/orchestrator/tool/ticket", () => ({
  toolTicket: {
    execute: executeMock,
  },
}));

const loggerWarnMock = mock();

mock.module("@alfred/logger", () => ({
  logger: {
    warn: loggerWarnMock,
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
const { ensureLinearTicket } = await import("../src/workflow/linear");

describe("linear helpers", () => {
  beforeEach(() => {
    executeMock.mockReset();
    loggerWarnMock.mockReset();
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
      extractIssueIdFromSession("session_abc123_2025-11-12T07:00:00.000Z")
    ).toBe("session_abc123_2025-11-12T07:00:00.000Z");
  });

  it("ensureLinearTicket reuses existing session without creation", async () => {
    const result = await ensureLinearTicket({
      linear: {
        space: "workspace",
        sessionId: "existing-session",
      } as any,
      authzLinear: "Bearer token",
      requirement: "Do work",
    });

    expect(result.linear?.sessionId).toBe("existing-session");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("ensureLinearTicket degrades gracefully when authz missing", async () => {
    const result = await ensureLinearTicket({
      linear: {
        space: "workspace",
        teamId: "team-1",
        title: "Title",
      } as any,
      requirement: "Do work",
    });

    expect(result.linear).toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "linear_ticket_auth_missing",
      expect.any(Object)
    );
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("ensureLinearTicket creates a ticket when inputs are valid", async () => {
    executeMock.mockResolvedValueOnce({
      ok: true,
      id: "ISSUE-123",
      url: "https://linear.app/workspace/issue/ISSUE-123",
    });

    const result = await ensureLinearTicket({
      linear: {
        space: "workspace",
        teamId: "team-1",
        title: "Fix bug",
        description: "details",
      } as any,
      authzLinear: "Bearer token",
      requirement: "Fix bug",
    });

    expect(executeMock).toHaveBeenCalledWith({
      input: expect.objectContaining({
        action: "create",
        teamId: "team-1",
        title: "Fix bug",
      }),
    });
    expect(result.ticket?.issueId).toBe("ISSUE-123");
    expect(result.linear?.sessionId).toBe("ISSUE-123");
  });

  it("ensureLinearTicket disables Linear linkage when team is missing", async () => {
    const result = await ensureLinearTicket({
      linear: {
        space: "workspace",
        title: "Fix bug",
      } as any,
      authzLinear: "Bearer token",
      requirement: "Fix bug",
    });

    expect(result.linear).toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "linear_ticket_team_missing",
      expect.any(Object)
    );
  });
});
