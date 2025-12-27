import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";

const workflowRepoMocks = {
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
  listEvents: vi.fn().mockResolvedValue([]),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

// Use shared mocks for assertions
const _loggerMock = loggerMocks;

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

const makeEventIdMock = vi.fn().mockImplementation(({ type }) => `${type}-id`);
mock.module("../utils/event-id", () => ({ makeEventId: makeEventIdMock }));

const eventToUiMessagesMock = vi.fn<[WorkflowEvent], UIMessage[] | null>(() => [
  {
    id: "msg-1",
    role: "assistant",
    parts: [{ type: "text", text: "Hi" }],
  },
]);
mock.module("../utils/normalize", () => ({
  eventToUiMessages: eventToUiMessagesMock,
}));

mock.module("../utils/redaction", () => ({
  redactEventData: (event: WorkflowEvent) => event,
}));

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
      type: "assistant",
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

    await flushMicrotasks();

    expect(eventToUiMessagesMock).toHaveBeenCalledWith(streamedEvent);
    expect(emitUiMessages).toHaveBeenCalledTimes(1);
    const [messages, meta] = emitUiMessages.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(meta).toMatchObject({
      runId: "run-123",
      eventId: "event-id",
      eventType: "event",
    });
    expect(meta.originalEvent).toBe(streamedEvent);
    expect(workflowRepoMocks.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "event" })
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

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterAll(() => {
  mock.restore();
});
