import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { Obligation } from "@alfred/type";

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
  .mockResolvedValue({ obligations: [] as Obligation[] });
mock.module("@alfred/api/workflow/access", () => ({
  enforceWorkflowPlanPolicy: enforceWorkflowPlanPolicyMock,
}));

const orchestrateWorkflowStreamMock = vi.fn();
mock.module("@alfred/agent/workflow/orchestrator", () => ({
  orchestrateWorkflowStream: orchestrateWorkflowStreamMock,
}));

const workflowRepoMock = {
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
};
mock.module("@alfred/db/repo/workflow", () => workflowRepoMock);

const runRegistryMocks = {
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
};
mock.module("@alfred/agent/workflow/registry", () => ({
  runRegistry: runRegistryMocks,
}));

const recordAuditMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/agent/utils/audit", () => ({
  recordAudit: recordAuditMock,
}));

mock.module("@alfred/api/preference/refresh", () => ({
  triggerPreferenceRefresh: vi.fn(),
}));

mock.module("@alfred/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
    runRegistryMocks.register.mockResolvedValue(undefined);
    runRegistryMocks.unregister.mockResolvedValue(undefined);
    workflowRepoMock.createRun.mockResolvedValue(undefined);
    workflowRepoMock.updateRun.mockResolvedValue(undefined);
    workflowRepoMock.appendEvent.mockResolvedValue(undefined);
    recordAuditMock.mockResolvedValue(undefined);
    orchestrateWorkflowStreamMock.mockImplementation(
      (_input, _session, callbacks) => {
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
      }
    );
  });

  afterAll(() => {
    mock.restore();
  });

  it("streams workflow and ui-message events", async () => {
    const response = await handleWorkflowStreamRequest(
      createRequest(basePayload)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await response.text();
    expect(text).toContain("event: workflow-event");
    expect(text).toContain('"eventId":"evt-run"');
    expect(text).toContain("event: ui-message");
    expect(text).toContain('"runId":"run-123"');
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

  it("emits obligation event when policy requires biometric elevation", async () => {
    const biometric: Obligation = {
      type: "biometric",
      reason: "biometric_required",
      metadata: { code: "requireBio" },
    };
    enforceWorkflowPlanPolicyMock.mockResolvedValueOnce({
      obligations: [biometric],
    });

    const response = await handleWorkflowStreamRequest(
      createRequest({ ...basePayload, auto: "high" })
    );

    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    let buffer = "";
    let obligationFound = false;
    while (!obligationFound && reader) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = drain(buffer, (evt) => {
        if (evt.name === "workflow-event" && evt.data?.type === "obligation") {
          obligationFound = true;
        }
      });
    }

    expect(obligationFound).toBe(true);
    await reader?.cancel();
    expect(orchestrateWorkflowStreamMock).not.toHaveBeenCalled();
    expect(workflowRepoMock.createRun).toHaveBeenCalled();
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workflow.stream.suspend",
      })
    );
  });
});

function drain(
  buffer: string,
  push: (evt: { name: string; data: any }) => void
): string {
  while (true) {
    const idx = buffer.indexOf("\n\n");
    if (idx === -1) {
      break;
    }
    const raw = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    const evt = parse(raw);
    if (evt) {
      push(evt);
    }
  }
  return buffer;
}

function parse(raw: string): { name: string; data: any } | null {
  let name = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      const chunk = line.slice("data:".length);
      data = data.length ? `${data}\n${chunk}` : chunk;
    }
  }
  if (!data) {
    return null;
  }
  try {
    return { name, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
