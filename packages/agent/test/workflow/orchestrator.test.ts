import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";

const workflowRepoMocks = {
  createRun: vi.fn().mockResolvedValue(undefined),
  updateRun: vi.fn().mockResolvedValue(undefined),
  appendEvent: vi.fn().mockResolvedValue(undefined),
  listEvents: vi.fn().mockResolvedValue([]),
  getRun: vi.fn().mockResolvedValue(null),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

// Use shared mocks for assertions
const loggerMock = loggerMocks;

const metricsMock = {
  workflowStreamDurationSeconds: { startTimer: () => () => {} },
  workflowStreamEventsTotal: { inc: vi.fn() },
  multiAgentTasksTotal: { inc: vi.fn() },
  multiAgentWavesTotal: { inc: vi.fn() },
  multiAgentAgentDurationSeconds: { observe: vi.fn() },
  multiAgentErrorsTotal: { inc: vi.fn() },
};

mock.module("../../src/workflow/metrics", () => metricsMock);

mock.module("../../src/workflow/metrics-recorder", () => ({
  recordMultiAgentEvent: vi.fn(),
}));

mock.module("../../src/workflow/event-persistence", () => ({
  persistEventSafe: vi.fn().mockImplementation((_runId, event) => 
    Promise.resolve({ eventId: `${event.type}-id`, eventType: event.type, uiMessages: null })
  ),
}));

mock.module("../../src/workflow/linear-activity", () => ({
  LinearActivityService: class {
    bootstrap = vi.fn().mockResolvedValue(undefined);
    completeSuccess = vi.fn().mockResolvedValue(undefined);
    completeFailure = vi.fn().mockResolvedValue(undefined);
    emitError = vi.fn().mockResolvedValue(undefined);
    isFailureNotified = false;
  },
}));

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

const reviewGateManagerInstances: Array<{
  isSatisfied: vi.Mock;
  recordCheck: vi.Mock;
  applyPlan: vi.Mock;
  summary: vi.Mock;
  requireAtLeast: vi.Mock;
  serialize: vi.Mock;
  restoreFromRun: vi.Mock;
  persistState: vi.Mock;
  recordEscalation: vi.Mock;
  getEscalationReason: vi.Mock;
}> = [];

mock.module("../../src/workflow/review-gate-manager", () => ({
  ReviewGateManager: class {
    applyPlan = vi.fn();
    recordCheck = vi.fn();
    summary = vi.fn(() => [] as any[]);
    isSatisfied = vi.fn(() => true);
    requireAtLeast = vi.fn();
    serialize = vi.fn(() => ({
      reviewGate: {
        checks: [],
        planInitialized: false,
        planRequired: false,
        minimumRequired: 0,
      },
      reviewEscalation: null,
    }));
    restoreFromRun = vi.fn().mockResolvedValue(undefined);
    persistState = vi.fn().mockResolvedValue(undefined);
    recordEscalation = vi.fn().mockReturnValue({ metricKind: "review_fixer_exhausted" });
    getEscalationReason = vi.fn().mockReturnValue(undefined);
    constructor() {
      reviewGateManagerInstances.push(this);
    }
  },
}));

const { orchestrateWorkflowStream } = await import(
  "../../src/workflow/orchestrator"
);

describe("workflow orchestrator self-correction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewGateManagerInstances.length = 0;
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

    reviewGateManagerInstances.length = 0;

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

    const gate = reviewGateManagerInstances[0];
    if (gate) {
      gate.isSatisfied.mockReturnValue(false);
      gate.getEscalationReason.mockReturnValue("fixer_exhausted");
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

describe("workflow orchestrator review gate persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewGateManagerInstances.length = 0;
  });

  it("persists ReviewGate state to stateData on suspend", async () => {
    const serializedState = {
      checks: [
        { id: "tests", type: "test", status: "passed", attempts: 1 },
        { id: "lint", type: "lint", status: "pending", attempts: 0 },
      ],
      planInitialized: true,
      planRequired: true,
      minimumRequired: 1,
    };

    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-suspend",
      summary: "suspended",
      stream: (async function* () {
        yield { type: "run", id: "run-suspend" } as WorkflowEvent;
        yield {
          type: "notice",
          message: "workflow_suspended",
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    workflowRepoMocks.getRun.mockResolvedValue({
      id: "run-suspend",
      stateData: { existingKey: "existingValue" },
    });

    await orchestrateWorkflowStream(
      {
        requirement: "Test suspend",
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
        emitNext: vi.fn(),
        emitComplete: vi.fn(),
      }
    );

    await flushMicrotasks();

    // Wait for async markSuspended to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify persistState was called on ReviewGateManager
    const gate = reviewGateManagerInstances[0];
    expect(gate?.persistState).toHaveBeenCalled();
  });

  it("restores ReviewGate state from stateData on resume", async () => {
    const storedReviewGateState = {
      checks: [
        { id: "tests", type: "test", status: "passed", attempts: 2 },
        { id: "lint", type: "lint", status: "failed", attempts: 1 },
      ],
      planInitialized: true,
      planRequired: true,
      minimumRequired: 2,
    };

    const storedEscalation = {
      reason: "fixer_exhausted",
      attempts: 3,
    };

    workflowRepoMocks.getRun.mockResolvedValue({
      id: "run-resume",
      stateData: {
        reviewGate: storedReviewGateState,
        reviewEscalation: storedEscalation,
      },
    });

    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-resume",
      summary: "ok",
      stream: (async function* () {
        yield { type: "run", id: "run-resume" } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    await orchestrateWorkflowStream(
      {
        runId: "run-resume", // This indicates a resume
        requirement: "Test resume",
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
        emitNext: vi.fn(),
        emitComplete: vi.fn(),
      }
    );

    await flushMicrotasks();

    // Verify restoreFromRun was called
    const gate = reviewGateManagerInstances[0];
    expect(gate?.restoreFromRun).toHaveBeenCalledWith("run-resume");
  });

  it("handles missing stateData gracefully on resume", async () => {
    workflowRepoMocks.getRun.mockResolvedValue({
      id: "run-no-state",
      stateData: null,
    });

    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-no-state",
      summary: "ok",
      stream: (async function* () {
        yield { type: "run", id: "run-no-state" } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    const emitError = vi.fn();

    await orchestrateWorkflowStream(
      {
        runId: "run-no-state",
        requirement: "Test resume no state",
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

    // Should not error when stateData is missing
    expect(emitError).not.toHaveBeenCalled();

    // restoreFromRun should still be called (manager handles missing data internally)
    const gate = reviewGateManagerInstances[0];
    expect(gate?.restoreFromRun).toHaveBeenCalledWith("run-no-state");
  });

  it("persists reviewEscalation along with reviewGate state on suspend", async () => {
    createWorkflowExecutorMock.mockReturnValueOnce({
      runId: "run-escalate-suspend",
      summary: "suspended",
      stream: (async function* () {
        yield { type: "run", id: "run-escalate-suspend" } as WorkflowEvent;
        yield {
          type: "event",
          kind: "review-escalated",
          data: {
            reason: "fixer_exhausted",
            attempts: 3,
            summary: "Failed after 3 attempts",
          },
        } as WorkflowEvent;
        yield {
          type: "notice",
          message: "workflow_suspended",
        } as WorkflowEvent;
      })(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    workflowRepoMocks.getRun.mockResolvedValue({
      id: "run-escalate-suspend",
      stateData: {},
    });

    await orchestrateWorkflowStream(
      {
        requirement: "Test escalation suspend",
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
        emitNext: vi.fn(),
        emitComplete: vi.fn(),
      }
    );

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify persistState was called on ReviewGateManager (which handles reviewEscalation)
    const gate = reviewGateManagerInstances[0];
    expect(gate?.persistState).toHaveBeenCalled();

    // Also verify recordEscalation was called with the escalation data
    expect(gate?.recordEscalation).toHaveBeenCalled();
  });
});

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterAll(() => {
  mock.restore();
});
