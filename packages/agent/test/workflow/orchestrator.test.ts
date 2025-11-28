import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";

const workflowRepoMocks = {
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
  listEvents: vi.fn().mockResolvedValue([]),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

mock.module("@alfred/logger", () => ({ logger: loggerMock }));

const metricsMock = {
  workflowStreamDurationSeconds: { startTimer: () => () => {} },
  workflowStreamEventsTotal: { inc: vi.fn() },
  multiAgentTasksTotal: { inc: vi.fn() },
  multiAgentWavesTotal: { inc: vi.fn() },
  multiAgentAgentDurationSeconds: { observe: vi.fn() },
  multiAgentErrorsTotal: { inc: vi.fn() },
};

mock.module("../../src/workflow/metrics", () => metricsMock);

mock.module("../../src/workflow/provenance", () => ({
  workflowProvenance: vi.fn().mockResolvedValue(undefined),
}));

const runRegistryMocks = {
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
};

mock.module("../../src/workflow/registry", () => ({
  runRegistry: runRegistryMocks,
}));

const createWorkflowExecutorMock = vi.fn();
const ensureWorkflowConversationMock = vi
  .fn()
  .mockResolvedValue({ conversation: { id: "conv" }, created: false });
const persistWorkflowMessagesMock = vi.fn().mockResolvedValue(0);
const createRequirementMessageMock = vi
  .fn()
  .mockReturnValue({ id: "req", role: "user", parts: [] });

mock.module("../../src/workflow/services", () => ({
  createWorkflowExecutor: createWorkflowExecutorMock,
  ensureWorkflowConversation: ensureWorkflowConversationMock,
  persistWorkflowMessages: persistWorkflowMessagesMock,
  shouldUseWorkflowRuntime: () => false,
  createRequirementMessage: createRequirementMessageMock,
  deriveWorkflowTitle: () => "Run",
  ensureObligations: vi.fn(),
}));

mock.module("../../src/workflow/linear", () => ({
  ensureLinearTicket: vi
    .fn()
    .mockResolvedValue({ linear: undefined, ticket: null }),
}));

mock.module("../../src/integrations/linear", () => ({
  commentOnLinearIssue: vi.fn().mockResolvedValue(undefined),
  emitLinearActivity: vi.fn().mockResolvedValue({ ok: true }),
  extractIssueIdFromSession: vi.fn().mockReturnValue(null),
  setLinearCompleted: vi.fn().mockResolvedValue(undefined),
  setLinearDelegate: vi.fn().mockResolvedValue(undefined),
  setLinearSessionExternalUrl: vi.fn().mockResolvedValue(undefined),
  setLinearStarted: vi.fn().mockResolvedValue(undefined),
  setLinearCancelled: vi.fn().mockResolvedValue(undefined),
}));

mock.module("../../src/utils/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

mock.module("../../src/utils/event-id", () => ({
  makeEventId: vi.fn().mockImplementation(({ type }) => `${type}-id`),
}));

const eventToUiMessagesMock = vi.fn<[WorkflowEvent], WorkflowEvent[] | null>(
  () => null
);

mock.module("../../src/utils/normalize", () => ({
  eventToUiMessages: eventToUiMessagesMock,
}));

mock.module("../../src/utils/redaction", () => ({
  redactEventData: (event: WorkflowEvent) => event,
}));

const reviewGateInstances: Array<{
  isSatisfied: vi.Mock;
  recordCheck: vi.Mock;
  applyPlan: vi.Mock;
  summary: vi.Mock;
  requireAtLeast: vi.Mock;
}> = [];

mock.module("../../src/workflow/review-gate", () => ({
  ReviewGate: class {
    applyPlan = vi.fn();
    recordCheck = vi.fn();
    summary = vi.fn(() => [] as any[]);
    isSatisfied = vi.fn(() => true);
    requireAtLeast = vi.fn();
    constructor() {
      reviewGateInstances.push(this);
    }
  },
}));

const { orchestrateWorkflowStream } = await import(
  "../../src/workflow/orchestrator"
);

describe("workflow orchestrator self-correction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewGateInstances.length = 0;
  });

  it("passes through fixer events when review retries succeed", async () => {
    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-123",
      summary: "ok",
      stream: (async function* () {
        yield { type: "run", id: "run-123" } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-check",
          data: { id: "tests", type: "tests", status: "failed", attempt: 1 },
        } as WorkflowEvent;
        yield {
          type: "event",
          kind: "fixer-agent-result",
          data: { attempt: 1, status: "completed" },
        } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-check",
          data: { id: "tests", type: "tests", status: "passed", attempt: 2 },
        } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-exec-result",
          data: { status: "completed", durationSeconds: 3 },
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const emitNext = vi.fn();
    const emitError = vi.fn();
    const emitComplete = vi.fn();

    await orchestrateWorkflowStream(
      {
        requirement: "Test",
        auto: "medium",
        mode: "sequential",
        context: { enable: false },
      } as any,
      { user: { id: "user-1" } },
      {
        triggerPreferenceRefresh: vi.fn(),
        ensureObligations: vi.fn(),
        context: {},
        emitError,
        emitNext,
        emitComplete,
      }
    );

    await flushMicrotasks();

    const fixerEvent = emitNext.mock.calls.find(
      ([event]) => (event as any)?.kind === "fixer-agent-result"
    );
    expect(fixerEvent).toBeTruthy();
    expect(metricsMock.multiAgentErrorsTotal.inc).not.toHaveBeenCalledWith(
      expect.objectContaining({
        kind: expect.stringContaining("review_escalated"),
      })
    );
    expect(emitError).not.toHaveBeenCalled();
  });

  it("increments review escalation metric when fixer exhausts retries", async () => {
    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-esc",
      summary: "fail",
      stream: (async function* () {
        yield { type: "run", id: "run-esc" } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-escalated",
          data: {
            reason: "fixer_exhausted",
            attempts: 3,
            plan: ".agent/plans/run-esc/review-debugger.md",
          },
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    reviewGateInstances.length = 0;

    const emitError = vi.fn();

    await orchestrateWorkflowStream(
      {
        requirement: "Escalate",
        auto: "medium",
        mode: "sequential",
        context: { enable: false },
      } as any,
      { user: { id: "user-1" } },
      {
        triggerPreferenceRefresh: vi.fn(),
        ensureObligations: vi.fn(),
        context: {},
        emitError,
        emitNext: vi.fn(),
        emitComplete: vi.fn(),
      }
    );

    await flushMicrotasks();

    expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "review_fixer_exhausted" })
    );
  });

  it("emits human escalation error when review gate remains unsatisfied", async () => {
    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-fail",
      summary: "fail",
      stream: (async function* () {
        yield { type: "run", id: "run-fail" } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-escalated",
          data: {
            reason: "fixer_exhausted",
            attempts: 3,
          },
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const emitError = vi.fn();
    const emitNext = vi.fn();

    await orchestrateWorkflowStream(
      {
        requirement: "Escalate",
        auto: "medium",
        mode: "sequential",
        context: { enable: false },
      } as any,
      { user: { id: "user-1" } },
      {
        triggerPreferenceRefresh: vi.fn(),
        ensureObligations: vi.fn(),
        context: {},
        emitError,
        emitNext,
        emitComplete: vi.fn(),
      }
    );

    const gate = reviewGateInstances[0];
    if (gate) {
      gate.isSatisfied.mockReturnValue(false);
    }

    await flushMicrotasks();

    expect(emitError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          "review_escalation_required:fixer_exhausted"
        ),
      })
    );
    const escalatedEvent = emitNext.mock.calls.find(
      ([event]) => (event as any)?.kind === "review-escalated"
    );
    expect(escalatedEvent).toBeTruthy();
  });

  it("streams review-escalated payload including metadata", async () => {
    const escalationPayload = {
      reason: "fixer_exhausted",
      attempts: 3,
      fixerAttempts: 2,
      plan: ".agent/plans/run/review-debugger.md",
      failures: [{ command: "bun test", output: "fail", checkId: "tests" }],
      relevantFiles: ["packages/agent/src/foo.ts"],
      summary: "details",
    };
    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-meta",
      summary: "fail",
      stream: (async function* () {
        yield { type: "run", id: "run-meta" } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-escalated",
          data: escalationPayload,
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const emitNext = vi.fn();

    await orchestrateWorkflowStream(
      {
        requirement: "Meta",
        auto: "medium",
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
        emitComplete: vi.fn(),
      }
    );

    await flushMicrotasks();

    const forwarded = emitNext.mock.calls.find(
      ([event]) => (event as any)?.kind === "review-escalated"
    );
    expect(forwarded?.[0]).toMatchObject({ data: escalationPayload });
  });
});

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
