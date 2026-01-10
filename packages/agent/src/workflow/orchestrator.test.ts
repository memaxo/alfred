import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";

const workflowRepoMocks = {
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
  listEvents: vi.fn().mockResolvedValue([]),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

const createWorkflowExecutorMock = vi.fn();
const ensureWorkflowConversationMock = vi
  .fn()
  .mockResolvedValue({ conversation: { id: "conv-1" }, created: false });
const persistWorkflowMessagesMock = vi.fn().mockResolvedValue(0);
const createRequirementMessageMock = vi
  .fn()
  .mockReturnValue({ id: "req", role: "user", parts: [] });

mock.module("./services", () => ({
  createWorkflowExecutor: createWorkflowExecutorMock,
  ensureWorkflowConversation: ensureWorkflowConversationMock,
  persistWorkflowMessages: persistWorkflowMessagesMock,
  shouldUseWorkflowRuntime: () => false,
  createRequirementMessage: createRequirementMessageMock,
  deriveWorkflowTitle: () => "Run",
  ensureObligations: vi.fn(),
}));

mock.module("./linear", () => ({
  ensureLinearTicket: vi
    .fn()
    .mockResolvedValue({ linear: undefined, ticket: null }),
}));

mock.module("../orchestrator/linear", () => ({
  commentOnLinearIssue: vi.fn().mockResolvedValue(undefined),
  emitLinearActivity: vi.fn().mockResolvedValue({ ok: true }),
  extractIssueIdFromSession: vi.fn().mockReturnValue(null),
  setLinearCompleted: vi.fn().mockResolvedValue(undefined),
  setLinearDelegate: vi.fn().mockResolvedValue(undefined),
  setLinearSessionExternalUrl: vi.fn().mockResolvedValue(undefined),
  setLinearStarted: vi.fn().mockResolvedValue(undefined),
  setLinearCancelled: vi.fn().mockResolvedValue(undefined),
}));

const recordAuditMock = vi.fn().mockResolvedValue(undefined);
mock.module("../utils/audit", () => ({ recordAudit: recordAuditMock }));

mock.module("./metrics", () => ({
  workflowStreamDurationSeconds: { startTimer: () => () => {} },
  workflowStreamEventsTotal: { inc: vi.fn() },
  multiAgentTasksTotal: { inc: vi.fn() },
  multiAgentWavesTotal: { inc: vi.fn() },
  multiAgentAgentDurationSeconds: { observe: vi.fn() },
  multiAgentErrorsTotal: { inc: vi.fn() },
}));

mock.module("./provenance", () => ({
  workflowProvenance: vi.fn().mockResolvedValue(undefined),
}));

const runRegistryMocks = {
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
};

mock.module("./registry", () => ({ runRegistry: runRegistryMocks }));

class MockReviewGate {
  applyPlan = vi.fn();
  recordCheck = vi.fn();
  summary = vi.fn(() => [] as any[]);
  isSatisfied = vi.fn(() => true);
}

mock.module("./review-gate", () => ({
  ReviewGate: MockReviewGate,
}));

describe("orchestrateWorkflowStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits UI messages via callbacks after persistence", async () => {
    const streamedEvent: WorkflowEvent = {
      _: "assistant",
      text: "Working",
    } as WorkflowEvent;

    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-123",
      summary: "ok",
      // biome-ignore lint/suspicious/useAwait: Async generator required by type signature
      stream: (async function* () {
        yield streamedEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const emitUiMessages = vi.fn();
    const emitNext = vi.fn();
    const emitComplete = vi.fn();

    const { orchestrateWorkflowStream } = await import("./orchestrator");

    await orchestrateWorkflowStream(
      {
        requirement: "Test",
        auto: "low",
        mode: "sequential",
        context: { enable: false },
      } as any,
      { user: { id: "user-1" } },
      {
        triggerPreferenceRefresh: vi.fn(),
        ensureObligations: vi.fn(),
        context: {},
        emitError: vi.fn(),
        emitNext,
        emitComplete,
        emitUiMessages,
      }
    );

    await waitFor(() => emitComplete.mock.calls.length > 0);

    expect(createWorkflowExecutorMock).toHaveBeenCalledTimes(1);
    expect(emitUiMessages).toHaveBeenCalledTimes(1);
    const [messages, meta] = emitUiMessages.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "assistant",
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Working" }),
      ]),
    });
    expect(meta).toMatchObject({
      runId: "run-123",
      eventId: expect.any(String),
      eventType: "assistant",
    });
    expect(meta.originalEvent).toBe(streamedEvent);
    expect(workflowRepoMocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "assistant" })
    );
    expect(workflowRepoMocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ui-message" })
    );
    expect(emitNext).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: expect.any(String) })
    );
    expect(emitComplete).toHaveBeenCalled();
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 500, stepMs = 5) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("test_timeout_waiting_for_condition");
    }
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

afterAll(() => {
  mock.restore();
});
