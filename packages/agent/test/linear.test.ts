import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const executeMock = mock(() =>
  Promise.resolve({ id: "activity-123", ok: true })
);

mock.module("../src/orchestrator/tool/ticket", () => ({
  toolTicket: {
    execute: executeMock,
  },
}));

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

// Use shared mocks for assertions
const loggerWarnMock = loggerMocks.warn;
const loggerInfoMock = loggerMocks.info;
const loggerErrorMock = loggerMocks.error;
const loggerDebugMock = loggerMocks.debug;

mock.module("p-retry", () => {
  const pRetry = <T>(fn: (attemptNumber: number) => T | Promise<T>) =>
    Promise.resolve(fn(1));
  class AbortError extends Error {}
  return { AbortError, default: pRetry };
});

const { emitLinearActivity, extractIssueIdFromSession } =
  await import("../src/orchestrator/linear");
const metricMocks = {
  durationStart: mock(() => () => {}),
  emissionsInc: mock(),
  sessionInc: mock(),
};

mock.module("../src/workflow/metrics", () => ({
  linearActivityDurationSeconds: {
    startTimer: metricMocks.durationStart,
  },
  linearActivityEmissionsTotal: { inc: metricMocks.emissionsInc },
  linearSessionOperationsTotal: { inc: metricMocks.sessionInc },
}));
const { ensureLinearTicket } = await import("../src/workflow/linear");

describe("linear helpers", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    executeMock.mockReset();
    loggerWarnMock.mockReset();
    loggerInfoMock.mockReset();
    loggerErrorMock.mockReset();
    loggerDebugMock.mockReset();
    metricMocks.emissionsInc.mockReset();
    metricMocks.durationStart.mockReset();
    metricMocks.durationStart.mockImplementation(() => () => {});
    metricMocks.sessionInc.mockReset();
  });

  it("emitLinearActivity forwards parameters and records success metrics", async () => {
    executeMock.mockResolvedValueOnce({ id: "activity-321", ok: true });

    const result = await emitLinearActivity("thought", {
      authz: "Bearer token",
      body: "Body text",
      ephemeral: true,
      parameter: "param",
      result: "result",
      sessionId: "session-id",
      space: "workspace-1",
      title: "Title",
    });

    expect(result).toEqual({ id: "activity-321", ok: true });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith({
      input: {
        action: "activity.thought",
        authz: "Bearer token",
        description: "Body text",
        ephemeral: true,
        parameter: "param",
        result: "result",
        sessionId: "session-id",
        space: "workspace-1",
        title: "Title",
      },
    });
    expect(metricMocks.emissionsInc).toHaveBeenCalledWith({
      status: "success",
      type: "thought",
    });
    expect(metricMocks.durationStart).toHaveBeenCalledTimes(1);
  });

  it("emitLinearActivity returns failure without throwing when tool errors", async () => {
    executeMock.mockRejectedValueOnce(new Error("linear-fault"));

    const result = await emitLinearActivity("action", {
      authz: "token",
      sessionId: "sess",
      space: "workspace",
    });

    expect(result).toEqual({ ok: false });
    expect(metricMocks.emissionsInc).toHaveBeenCalledWith({
      status: "failure",
      type: "action",
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
      authzLinear: "Bearer token",
      linear: {
        space: "workspace",
        sessionId: "existing-session",
      } as any,
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
      id: "ISSUE-123",
      ok: true,
      url: "https://linear.app/workspace/issue/ISSUE-123",
    });

    const result = await ensureLinearTicket({
      authzLinear: "Bearer token",
      linear: {
        space: "workspace",
        teamId: "team-1",
        title: "Fix bug",
        description: "details",
      } as any,
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
      authzLinear: "Bearer token",
      linear: {
        space: "workspace",
        title: "Fix bug",
      } as any,
      requirement: "Fix bug",
    });

    expect(result.linear).toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "linear_ticket_team_missing",
      expect.any(Object)
    );
  });
});
