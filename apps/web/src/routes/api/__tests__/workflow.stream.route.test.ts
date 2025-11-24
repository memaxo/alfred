import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const getSessionMock = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

const enforceWorkflowPlanPolicyMock = vi
  .fn()
  .mockResolvedValue({ obligations: [] as string[] });
mock.module("@alfred/api/workflow/access", () => ({
  enforceWorkflowPlanPolicy: enforceWorkflowPlanPolicyMock,
}));

const orchestrateWorkflowStreamMock = vi.fn();
mock.module("@alfred/agent/workflow/orchestrator", () => ({
  orchestrateWorkflowStream: orchestrateWorkflowStreamMock,
}));

mock.module("@alfred/api/preference/refresh", () => ({
  triggerPreferenceRefresh: vi.fn(),
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { handleWorkflowStreamRequest } = await import("../workflow/stream");

const basePayload = {
  requirement: "Plan project",
  auto: "low",
  mode: "sequential",
};

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/workflow/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/workflow/stream SSE route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceWorkflowPlanPolicyMock.mockResolvedValue({ obligations: [] });
    orchestrateWorkflowStreamMock.mockImplementation((_input, _session, callbacks) => {
      callbacks.emitNext({ type: "run", eventId: "evt-run" } as any);
      callbacks.emitUiMessages?.(
        [
          {
            id: "msg-1",
            role: "assistant",
            parts: [{ type: "text", text: "Hello" }],
          },
        ],
        {
          runId: "run-123",
          eventId: "evt-run",
          eventType: "run",
          originalEvent: { type: "run" } as any,
        }
      );
      callbacks.emitComplete();
      return Promise.resolve(() => {});
    });
  });

  it("streams workflow and ui-message events", async () => {
    const response = await handleWorkflowStreamRequest(
      createRequest(basePayload)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await response.text();
    expect(text).toContain("event: workflow-event");
    expect(text).toContain("\"eventId\":\"evt-run\"");
    expect(text).toContain("event: ui-message");
    expect(text).toContain("\"runId\":\"run-123\"");
    expect(text).toContain("event: complete");

    expect(enforceWorkflowPlanPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining(basePayload) })
    );
    expect(orchestrateWorkflowStreamMock).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when policy helper denies access", async () => {
    const denial = Object.assign(new Error("policy_denied"), {
      statusCode: 403,
    });
    enforceWorkflowPlanPolicyMock.mockRejectedValueOnce(denial);

    const response = await handleWorkflowStreamRequest(
      createRequest(basePayload)
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: "access_denied" });
    expect(orchestrateWorkflowStreamMock).not.toHaveBeenCalled();
  });

  it("maps rate limit errors to HTTP 429", async () => {
    enforceWorkflowPlanPolicyMock.mockRejectedValueOnce({
      code: "TOO_MANY_REQUESTS",
      message: "rate_limited",
    });

    const response = await handleWorkflowStreamRequest(
      createRequest(basePayload)
    );

    expect(response.status).toBe(429);
    const payload = await response.json();
    expect(payload.error).toBe("access_denied");
    expect(orchestrateWorkflowStreamMock).not.toHaveBeenCalled();
  });
});
