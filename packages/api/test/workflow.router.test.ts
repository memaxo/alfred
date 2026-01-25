import type { PipelineEvent } from "@alfred/pipeline";
import type { Obligation, WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { resetAgentMocks } from "./utils/agent-mock";
import { dbModuleStub } from "./utils/mock-db-client";
import { metricsStub } from "./utils/mock-metrics";
import { installPipelineMocks } from "./utils/pipeline";
import {
  mockPolicyAudit,
  mockRunRegistry,
  mockWorkflowRepo,
  mockWorkflowRunner,
  mockWorkflowRuntime,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { toObservable } from "./utils/stream";

const triggerPreferenceRefreshMock = vi.fn();

mock.module("../src/preference/refresh", () => ({
  triggerPreferenceRefresh: triggerPreferenceRefreshMock,
  __flushPreferenceRefreshQueueForTests: vi.fn(),
  __resetPreferenceRefreshQueueForTests: vi.fn(),
}));

mock.module("node-pty", () => ({
  spawn: vi.fn(),
}));

mock.module("@alfred/agent/orchestrator/linear", () => ({
  emitLinearActivity: vi.fn().mockResolvedValue({ ok: true }),
  setLinearDelegate: vi.fn().mockResolvedValue(),
  setLinearStarted: vi.fn().mockResolvedValue({ stateId: "started" }),
  setLinearCompleted: vi.fn().mockResolvedValue({ stateId: "done" }),
  setLinearCancelled: vi.fn().mockResolvedValue({ stateId: "cancelled" }),
  setLinearSessionExternalUrl: vi.fn().mockResolvedValue(),
  commentOnLinearIssue: vi.fn().mockResolvedValue(),
  extractIssueIdFromSession: (id: string) => id,
}));

mock.module("@alfred/agent/orchestrator/linearmetrics", () => ({
  configureLinearMetrics: vi.fn(),
}));

mock.module("@alfred/agent/workflow/linear", () => ({
  ensureLinearTicket: (params: { linear?: unknown }) => ({
    linear: params.linear,
    ticket: undefined,
  }),
}));

const enforceWorkflowPlanPolicyMock = vi
  .fn()
  .mockResolvedValue({ obligations: [] });
mock.module("../src/workflow/access", () => ({
  enforceWorkflowPlanPolicy: enforceWorkflowPlanPolicyMock,
}));

setupTestEnv();
mockPolicyAudit();
installPipelineMocks({ runtimeLinear: true, sessionRecovery: true });

const workflowRepoMocks = mockWorkflowRepo();
const runRegistryMocks = mockRunRegistry();
const _workflowRunnerMocks = mockWorkflowRunner();
const workflowRuntimeMocks = mockWorkflowRuntime();
const createConversationMock = vi.fn();
const getConversationByWorkflowMock = vi.fn();
const createMessageMock = vi.fn();

dbModuleStub.conversationRepo.createConversation = createConversationMock;
dbModuleStub.conversationRepo.getConversationByWorkflow =
  getConversationByWorkflowMock;
dbModuleStub.conversationRepo.createMessage = createMessageMock;
dbModuleStub.conversationRepo.getConversation = vi.fn();
dbModuleStub.conversationRepo.getMessage = vi.fn();

const workflowStreamDurationSecondsMock = {
  startTimer: vi.fn().mockReturnValue(() => {}),
};

const workflowStreamEventsTotalMock = {
  inc: vi.fn(),
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
  workflowStreamDurationSeconds: workflowStreamDurationSecondsMock,
  workflowStreamEventsTotal: workflowStreamEventsTotalMock,
}));

import { createTestCaller } from "./utils/trpc";

let caller: Awaited<ReturnType<typeof createTestCaller>>;

const biometricObligation: Obligation = {
  type: "biometric",
  reason: "biometric_required",
  metadata: { code: "requireBio" },
};

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["workflow.plan", "workflow.stream", "workflow.resume"],
  });
});

beforeEach(() => {
  getConversationByWorkflowMock.mockResolvedValue(null);
  createConversationMock.mockResolvedValue({
    id: "conversation-default",
    userId: "test-user",
    title: null,
    workflowId: "plan",
    created: new Date(),
    updated: new Date(),
  });
  createMessageMock.mockResolvedValue(null);
  setupExecutorPath(false);
});

afterEach(() => {
  resetAllMocks();
  workflowStreamDurationSecondsMock.startTimer.mockReturnValue(() => {});
  workflowStreamEventsTotalMock.inc.mockReset();
  // Reset env flag
  process.env.USE_WORKFLOW_RUNTIME = undefined;
  createConversationMock.mockReset();
  getConversationByWorkflowMock.mockReset();
  createMessageMock.mockReset();
  resetAgentMocks();
  triggerPreferenceRefreshMock.mockReset();
  enforceWorkflowPlanPolicyMock.mockReset();
  enforceWorkflowPlanPolicyMock.mockResolvedValue({ obligations: [] });
});

/**
 * Helper to configure which executor path to test
 */
function setupExecutorPath(useRuntime: boolean) {
  process.env.USE_WORKFLOW_RUNTIME = useRuntime ? "true" : "false";
}

/**
 * Helper to create a mock executor (runtime or runner) with identical interface
 */
function createMockExecutor(
  mockRunId: string,
  mockSummary: string,
  events: WorkflowEvent[]
) {
  const mockStream = async function* mockStream() {
    await Promise.resolve();
    for (const event of events) {
      yield event;
    }
  };

  return {
    runId: mockRunId,
    summary: mockSummary,
    stream: mockStream(),
    resume: vi.fn().mockResolvedValue(),
    cancel: vi.fn(),
  };
}

describe("workflow router", () => {
  describe("start", () => {
    it("creates a workflow run and registers handle", async () => {
      const mockRunId = "test-run-id";

      workflowRepoMocks.createRun.mockResolvedValue({
        id: mockRunId,
        userId: "test-user",
        workflowId: "pipeline",
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      workflowRepoMocks.getRun.mockResolvedValue(null);

      const conversationRow = {
        id: "conv-start",
        userId: "test-user",
        title: null,
        workflowId: mockRunId,
        created: new Date(),
        updated: new Date(),
      };
      getConversationByWorkflowMock.mockResolvedValueOnce(null);
      createConversationMock.mockResolvedValueOnce(conversationRow);
      createMessageMock.mockResolvedValue(null);

      const result = await caller.workflow.start({
        requirement: "test requirement",
        auto: "low",
        runId: mockRunId,
      });

      expect(workflowRepoMocks.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockRunId,
          userId: "test-user",
          workflowId: "pipeline",
          status: "running",
          inputData: expect.objectContaining({
            requirement: "test requirement",
            auto: "low",
            reasoningSince: expect.any(Number),
          }),
        })
      );
      expect(result).toMatchObject({
        runId: mockRunId,
        summary: expect.stringContaining("Pipeline run created"),
      });
      expect(triggerPreferenceRefreshMock).toHaveBeenCalledWith(
        "test-user",
        expect.objectContaining({ reason: "workflow_requirement" })
      );
      expect(getConversationByWorkflowMock).toHaveBeenCalledWith(
        "test-user",
        mockRunId
      );
      expect(createConversationMock).toHaveBeenCalledWith(
        "test-user",
        expect.stringContaining("test requirement"),
        mockRunId,
        undefined
      );
      expect(createMessageMock).toHaveBeenCalledWith(
        "test-user",
        "conv-start",
        expect.objectContaining({
          role: "user",
          parts: [{ type: "text", text: "test requirement" }],
        })
      );
      const requirementMessage = createMessageMock.mock.calls.find(
        ([, , message]) => (message as UIMessage).role === "user"
      )?.[2] as UIMessage | undefined;
      expect(requirementMessage).toBeDefined();
      expect(requirementMessage && UUID_REGEX.test(requirementMessage.id)).toBe(
        true
      );
      expect(requirementMessage?.metadata?.workflowMessageKey).toBe(
        `${mockRunId}:requirement`
      );
      expect(requirementMessage?.metadata?.workflowEventType).toBe(
        "workflow.requirement"
      );
      expect(requirementMessage?.metadata?.workflowEventId).toBe(mockRunId);
    });

    it("throws UNAUTHORIZED when session is missing", async () => {
      const unauthedCaller = await createTestCaller({
        userId: "",
        scopes: [],
      });

      await expect(
        unauthedCaller.workflow.start({
          requirement: "test",
        })
      ).rejects.toThrow();
    });

    it("handles workflow start errors", async () => {
      workflowRepoMocks.getRun.mockResolvedValueOnce(null);
      workflowRepoMocks.createRun.mockImplementationOnce(() => {
        throw new Error("create_run_failed");
      });

      await expect(
        caller.workflow.start({
          requirement: "test",
          runId: "test-run-id",
        })
      ).rejects.toThrow();
    });
  });
});

describe("resume", () => {
  it("dispatches resume to run registry", async () => {
    runRegistryMocks.dispatchResume.mockResolvedValue(true);

    const result = await caller.workflow.resume({
      runId: "test-run-id",
      event: "bio-authz",
      authz: "token-123",
    });

    expect(runRegistryMocks.dispatchResume).toHaveBeenCalledWith(
      "test-run-id",
      {
        event: "bio-authz",
        authz: "token-123",
      }
    );
    expect(result).toEqual({ ok: true });
  });

  it("throws NOT_FOUND when run not found", async () => {
    runRegistryMocks.dispatchResume.mockResolvedValue(false);

    await expect(
      caller.workflow.resume({
        runId: "missing-run-id",
        event: "bio-authz",
        authz: "token",
      })
    ).rejects.toThrow("run_not_found");
  });
});

describe("get", () => {
  it("retrieves workflow run metadata", async () => {
    const mockRun = {
      id: "test-run-id",
      userId: "test-user",
      workflowId: "plan",
      status: "running" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    workflowRepoMocks.getRun.mockResolvedValue(mockRun as any);

    const result = await caller.workflow.get({
      runId: "test-run-id",
    });

    expect(workflowRepoMocks.getRun).toHaveBeenCalledWith("test-run-id");
    expect(result).toEqual(mockRun);
  });

  it("throws NOT_FOUND when run does not exist", async () => {
    workflowRepoMocks.getRun.mockResolvedValue(null);

    await expect(
      caller.workflow.get({
        runId: "missing-run-id",
      })
    ).rejects.toThrow("run_not_found");
  });

  it("rejects empty runId", async () => {
    await expect(
      caller.workflow.get({
        runId: "",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("events", () => {
  it("retrieves workflow events for a run", async () => {
    const mockEvents = [
      {
        id: "event-1",
        runId: "test-run-id",
        eventType: "run",
        timestamp: new Date(),
      },
      {
        id: "event-2",
        runId: "test-run-id",
        eventType: "progress",
        timestamp: new Date(),
      },
    ];

    workflowRepoMocks.listEvents.mockResolvedValue(mockEvents as any);

    const result = await caller.workflow.events({
      runId: "test-run-id",
    });

    expect(workflowRepoMocks.listEvents).toHaveBeenCalledWith("test-run-id");
    expect(result).toEqual(mockEvents);
  });
});

describe("replay", () => {
  it("retrieves only ui-message events for a run", async () => {
    const mockRunId = "test-run-id";
    const mockEvents = [
      {
        id: "event-1",
        runId: mockRunId,
        eventId: "evt-1",
        eventType: "ui-message",
        eventData: { messages: [{ role: "assistant", content: "Hi" }] },
        timestamp: new Date("2024-01-01"),
      },
      {
        id: "event-2",
        runId: mockRunId,
        eventId: "evt-2",
        eventType: "ui-message",
        eventData: { messages: [{ role: "assistant", content: "Hello" }] },
        timestamp: new Date("2024-01-02"),
      },
    ];

    workflowRepoMocks.listEventsByTypePaged.mockResolvedValue(
      mockEvents as any
    );

    const result = await caller.workflow.replay({ runId: mockRunId });

    expect(workflowRepoMocks.listEventsByTypePaged).toHaveBeenCalledWith({
      runId: mockRunId,
      eventType: "ui-message",
      page: 0,
      pageSize: 500,
    });
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].eventId).toBe("evt-1");
    expect(result.items[0].eventType).toBe("ui-message");
  });

  it("supports custom event type filtering", async () => {
    workflowRepoMocks.listEventsByTypePaged.mockResolvedValue([]);
    await caller.workflow.replay({
      runId: "test-run-id",
      eventType: "progress",
    });
    expect(workflowRepoMocks.listEventsByTypePaged).toHaveBeenCalledWith({
      runId: "test-run-id",
      eventType: "progress",
      page: 0,
      pageSize: 500,
    });
  });

  it("returns events in chronological order", async () => {
    const mockEvents = [
      { eventId: "evt-1", timestamp: new Date("2024-01-01") },
      { eventId: "evt-2", timestamp: new Date("2024-01-02") },
    ];

    workflowRepoMocks.listEventsByTypePaged.mockResolvedValue(
      mockEvents as any
    );

    const result = await caller.workflow.replay({
      runId: "test-run-id",
    });

    expect(result.items[0].eventId).toBe("evt-1");
    expect(result.items[1].eventId).toBe("evt-2");
  });
});

describe("streamPipeline", () => {
  it("streams pipeline events", async () => {
    const subscription = toObservable(
      await caller.workflow.streamPipeline({ requirement: "test" })
    );
    const receivedEvents: PipelineEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: (event) => {
          receivedEvents.push(event);
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(receivedEvents.length).toBeGreaterThan(0);
    expect(
      receivedEvents.some((event) => event.type === "pipeline:start")
    ).toBe(true);
    expect(
      receivedEvents.some((event) => event.type === "pipeline:complete")
    ).toBe(true);
  });

  it("emits pipeline:suspend when obligations are required", async () => {
    enforceWorkflowPlanPolicyMock.mockResolvedValueOnce({
      obligations: [biometricObligation],
    });

    const subscription = toObservable(
      await caller.workflow.streamPipeline({ requirement: "test" })
    );
    const receivedEvents: PipelineEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: (event) => {
          receivedEvents.push(event);
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(
      receivedEvents.some((event) => event.type === "pipeline:suspend")
    ).toBe(true);
  });
});

describe("cancel", () => {
  it("cancels a running workflow run", async () => {
    const mockRun = {
      id: "test-run-id",
      userId: "test-user",
      status: "running" as const,
    };

    workflowRepoMocks.getRun.mockResolvedValue(mockRun as any);
    runRegistryMocks.runs = new Map([
      [
        "test-run-id",
        {
          cancel: vi.fn().mockResolvedValue(),
        },
      ],
    ]);
    workflowRepoMocks.updateRun.mockResolvedValue();

    const result = await caller.workflow.cancel({
      runId: "test-run-id",
    });

    expect(result).toEqual({ cancelled: true });
    expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith("test-run-id", {
      status: "cancelled",
      completedAt: expect.any(Date),
    });
  });

  it("returns cancelled false for already finished run", async () => {
    const mockRun = {
      id: "test-run-id",
      userId: "test-user",
      status: "completed" as const,
    };

    workflowRepoMocks.getRun.mockResolvedValue(mockRun as any);

    const result = await caller.workflow.cancel({
      runId: "test-run-id",
    });

    expect(result).toEqual({ cancelled: false, reason: "already_finished" });
  });

  it("throws NOT_FOUND when run does not exist", async () => {
    workflowRepoMocks.getRun.mockResolvedValue(null);

    await expect(
      caller.workflow.cancel({
        runId: "missing-run-id",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "run_not_found",
    });
  });

  it("throws FORBIDDEN when caller is not the owner", async () => {
    const otherUserCaller = await createTestCaller({
      userId: "other-user",
      scopes: ["workflow.write"],
    });

    const mockRun = {
      id: "test-run-id",
      userId: "test-user",
      status: "running" as const,
    };

    workflowRepoMocks.getRun.mockResolvedValue(mockRun as any);

    await expect(
      otherUserCaller.workflow.cancel({
        runId: "test-run-id",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "not_owner",
    });
  });

  it("rejects empty runId", async () => {
    await expect(
      caller.workflow.cancel({
        runId: "",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("suspend", () => {
  it("suspends a running workflow", async () => {
    runRegistryMocks.dispatchSuspend.mockResolvedValue(true);

    const result = await caller.workflow.suspend({
      runId: "test-run-id",
    });

    expect(result).toEqual({ ok: true });
    expect(runRegistryMocks.dispatchSuspend).toHaveBeenCalledWith(
      "test-run-id"
    );
  });

  it("throws NOT_FOUND when run does not exist or not suspendable", async () => {
    runRegistryMocks.dispatchSuspend.mockResolvedValue(false);

    await expect(
      caller.workflow.suspend({
        runId: "missing-run-id",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "run_not_found_or_not_suspendable",
    });
  });

  it("rejects empty runId", async () => {
    await expect(
      caller.workflow.suspend({
        runId: "",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
