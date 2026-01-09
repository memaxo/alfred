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
import type { Obligation, WorkflowEvent } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import { resetAgentMocks } from "./utils/agent-mock";
import { dbModuleStub } from "./utils/mock-db-client";
import { metricsStub } from "./utils/mock-metrics";
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
  setLinearDelegate: vi.fn().mockResolvedValue(undefined),
  setLinearStarted: vi.fn().mockResolvedValue({ stateId: "started" }),
  setLinearCompleted: vi.fn().mockResolvedValue({ stateId: "done" }),
  setLinearCancelled: vi.fn().mockResolvedValue({ stateId: "cancelled" }),
  setLinearSessionExternalUrl: vi.fn().mockResolvedValue(undefined),
  commentOnLinearIssue: vi.fn().mockResolvedValue(undefined),
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

const { createTestCaller } = await import("./utils/trpc");

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
  const mockStream = async function* () {
    await Promise.resolve();
    for (const event of events) {
      yield event;
    }
  };

  return {
    runId: mockRunId,
    summary: mockSummary,
    stream: mockStream(),
    resume: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  };
}

describe("workflow router", () => {
  describe("start", () => {
    it("creates a workflow run and registers handle", async () => {
      const mockRunId = "test-run-id";
      const mockSummary = "Plan initialized for test requirement";
      const mockStream = async function* () {
        await Promise.resolve();
        yield { _: "run", id: mockRunId } as WorkflowEvent;
        yield {
          _: "progress",
          pct: 10,
          message: "starting",
        } as WorkflowEvent;
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue({
        runId: mockRunId,
        summary: mockSummary,
        stream: mockStream(),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({
        id: mockRunId,
        userId: "test-user",
        workflowId: "plan",
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

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

      runRegistryMocks.register.mockResolvedValue(undefined);

      const result = await caller.workflow.start({
        requirement: "test requirement",
        auto: "low",
      });

      expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
      expect(workflowRepoMocks.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockRunId,
          userId: "test-user",
          workflowId: "plan",
          status: "running",
          inputData: expect.objectContaining({
            requirement: "test requirement",
            auto: "low",
            executionId: mockRunId,
            reasoningSince: expect.any(Number),
          }),
        })
      );
      expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        runId: mockRunId,
        summary: mockSummary,
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
      workflowRuntimeMocks.createRuntime.mockImplementation(() => {
        throw new Error("runner failed");
      });

      await expect(
        caller.workflow.start({
          requirement: "test",
        })
      ).rejects.toThrow();
    });
  });

  describe("stream", () => {
    it("streams workflow events and persists them", async () => {
      const mockRunId = "test-run-id";
      const events: WorkflowEvent[] = [
        { _: "run", id: mockRunId } as WorkflowEvent,
        { _: "assistant", text: "Workflow complete" } as WorkflowEvent,
        { _: "progress", pct: 100, message: "done" } as WorkflowEvent,
      ];

      const mockStream = async function* () {
        await Promise.resolve();
        for (const event of events) {
          yield event;
        }
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue({
        runId: mockRunId,
        summary: "test summary",
        stream: mockStream(),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({
        id: mockRunId,
        userId: "test-user",
        workflowId: "plan",
        status: "running",
      } as any);

      const streamConversationRow = {
        id: "conv-stream",
        userId: "test-user",
        title: null,
        workflowId: mockRunId,
        created: new Date(),
        updated: new Date(),
      };
      getConversationByWorkflowMock.mockResolvedValueOnce(null);
      createConversationMock.mockResolvedValueOnce(streamConversationRow);
      createMessageMock.mockResolvedValue(null);

      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({
        id: mockRunId,
        status: "completed",
      } as any);

      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = toObservable(
        await caller.workflow.stream({
          requirement: "test",
        })
      );

      const receivedEvents: WorkflowEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: (event) => {
            receivedEvents.push(event);
          },
          error: reject,
          complete: () => {
            resolve();
          },
        });
      });

      expect(receivedEvents).toHaveLength(events.length);
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(
        events.length + 1
      );
      expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(mockRunId, {
        status: "completed",
        completedAt: expect.any(Date),
      });
      expect(createConversationMock).toHaveBeenCalledWith(
        "test-user",
        expect.any(String),
        mockRunId,
        undefined
      );
      expect(createMessageMock).toHaveBeenCalledWith(
        "test-user",
        "conv-stream",
        expect.objectContaining({ role: "user" })
      );
      const assistantCall = createMessageMock.mock.calls.find(
        ([, conversationId, message]) =>
          conversationId === "conv-stream" &&
          (message as UIMessage).role === "assistant"
      );
      expect(assistantCall).toBeDefined();
      const assistantMessage = assistantCall?.[2] as UIMessage;
      expect(UUID_REGEX.test(assistantMessage.id)).toBe(true);
      expect(
        typeof assistantMessage.metadata?.workflowMessageKey === "string"
      ).toBe(true);
      expect(assistantMessage.metadata?.workflowEventType).toBe("assistant");
      expect(
        typeof assistantMessage.metadata?.workflowEventId === "string"
      ).toBe(true);
      expect(
        createMessageMock.mock.calls.some(
          ([, conversationId, message]) =>
            conversationId === "conv-stream" &&
            (message as UIMessage).role === "assistant"
        )
      ).toBe(true);
      const refreshReasons = triggerPreferenceRefreshMock.mock.calls.map(
        ([, options]) => (options as { reason?: string })?.reason
      );
      expect(refreshReasons).toContain("workflow_stream_complete");
      expect(refreshReasons).toContain("workflow_messages_persisted");
      expect(
        refreshReasons.filter((reason) => reason === "workflow_requirement")
      ).toHaveLength(1);
      expect(refreshReasons.length).toBeGreaterThanOrEqual(3);
    });

    it("suspends and resumes when biometric obligations are required", async () => {
      const resumedRunId = "resume-run-id";
      enforceWorkflowPlanPolicyMock
        .mockResolvedValueOnce({ obligations: [biometricObligation] })
        .mockResolvedValueOnce({ obligations: [] });

      const runEvents: WorkflowEvent[] = [
        { _: "run", id: resumedRunId } as WorkflowEvent,
        { _: "progress", pct: 100, message: "done" } as WorkflowEvent,
      ];

      workflowRuntimeMocks.createRuntime.mockReturnValue({
        runId: resumedRunId,
        summary: "resumed",
        stream: (async function* () {
          await Promise.resolve();
          for (const event of runEvents) {
            yield event;
          }
        })(),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({
        id: resumedRunId,
        status: "suspended",
      } as any);

      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);
      runRegistryMocks.dispatchResume.mockImplementation(
        async (runId, payload) => {
          const registration = runRegistryMocks.register.mock.calls.find(
            ([registeredId]) => registeredId === runId
          );
          if (!registration) {
            return false;
          }
          await registration[1].resume({ resumeData: payload });
          return true;
        }
      );

      const observable = toObservable(
        await caller.workflow.stream({
          requirement: "secure task",
          auto: "medium",
        })
      );

      const receivedEvents: WorkflowEvent[] = [];
      let resolveObligation: ((runId: string) => void) | undefined;
      const obligationPromise = new Promise<string>((resolve) => {
        resolveObligation = resolve;
      });
      let resolveComplete: (() => void) | undefined;
      let rejectComplete: ((error: unknown) => void) | undefined;
      const completionPromise = new Promise<void>((resolve, reject) => {
        resolveComplete = resolve;
        rejectComplete = reject;
      });

      const subscriptionHandle = observable.subscribe({
        next: (event: WorkflowEvent) => {
          receivedEvents.push(event);
          if (event._ === "obligation" && resolveObligation) {
            resolveObligation(event.runId);
            resolveObligation = undefined;
          }
          if (event._ === "progress" && (event.pct ?? 0) === 100) {
            stop?.();
            resolveComplete?.();
          }
        },
        error: (error) => {
          stop?.();
          rejectComplete?.(error);
        },
      });
      const stop =
        typeof subscriptionHandle === "function"
          ? subscriptionHandle
          : typeof subscriptionHandle?.unsubscribe === "function"
            ? () => subscriptionHandle.unsubscribe()
            : undefined;

      const suspendedRunId = await obligationPromise;
      expect(receivedEvents[0]?._).toBe("obligation");
      expect((receivedEvents[0] as any).obligations).toEqual([
        biometricObligation,
      ]);

      await caller.workflow.resume({
        runId: suspendedRunId,
        event: "bio-authz",
        authz: "token-123",
      });

      await completionPromise;

      const progressEvent = receivedEvents.find(
        (event) => event._ === "progress" && (event as any).message === "done"
      );
      expect(progressEvent).toBeDefined();

      const createRunCall = workflowRepoMocks.createRun.mock.calls[0]?.[0];
      expect(createRunCall).toMatchObject({ status: "suspended" });

      const suspendEventCall = workflowRepoMocks.appendEvent.mock.calls.find(
        ([payload]) => (payload as any).eventType === "suspend"
      );
      expect(suspendEventCall).toBeDefined();

      const resumeUpdate = workflowRepoMocks.updateRun.mock.calls.find(
        ([id, patch]) => id === suspendedRunId && patch.status === "running"
      );
      expect(resumeUpdate).toBeTruthy();

      expect(enforceWorkflowPlanPolicyMock).toHaveBeenCalledTimes(2);
      expect(runRegistryMocks.dispatchResume).toHaveBeenCalledTimes(1);
    });

    it("persists tool-call and tool-result metadata", async () => {
      const mockRunId = "tool-run-id";
      const events: WorkflowEvent[] = [
        { _: "run", id: mockRunId } as WorkflowEvent,
        {
          _: "tool-call",
          toolCallId: "tc-1",
          toolName: "test",
          input: { ok: true },
        } as WorkflowEvent,
        {
          _: "tool-result",
          toolCallId: "tc-1",
          toolName: "test",
          input: { ok: true },
          output: { ok: true },
        } as WorkflowEvent,
        { _: "progress", pct: 100, message: "done" } as WorkflowEvent,
      ];

      const mockStream = async function* () {
        await Promise.resolve();
        for (const event of events) {
          yield event;
        }
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue({
        runId: mockRunId,
        summary: "tool summary",
        stream: mockStream(),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({
        id: mockRunId,
      } as any);

      const conversationRow = {
        id: "conv-tool",
        userId: "test-user",
        title: null,
        workflowId: mockRunId,
        created: new Date(),
        updated: new Date(),
      };
      getConversationByWorkflowMock.mockResolvedValue(conversationRow);

      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = toObservable(
        await caller.workflow.stream({
          requirement: "tool metadata",
        })
      );

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: () => {},
          error: reject,
          complete: () => resolve(),
        });
      });

      const toolCallPersist = createMessageMock.mock.calls.find(
        ([, , message]) =>
          (message as UIMessage).metadata?.workflowEventType === "tool-call"
      );
      const toolResultPersist = createMessageMock.mock.calls.find(
        ([, , message]) =>
          (message as UIMessage).metadata?.workflowEventType === "tool-result"
      );

      expect(toolCallPersist).toBeDefined();
      expect(toolResultPersist).toBeDefined();
      const toolResultMessage = toolResultPersist?.[2] as UIMessage;
      expect(toolResultMessage.metadata?.workflowEventId).toEqual(
        expect.any(String)
      );
    });

    it("handles persistence failures gracefully", async () => {
      const mockRunId = "test-run-id";
      const mockStream = async function* () {
        await Promise.resolve();
        yield { _: "run", id: mockRunId } as WorkflowEvent;
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue({
        runId: mockRunId,
        summary: "test",
        stream: mockStream(),
        resume: vi.fn(),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({} as any);
      workflowRepoMocks.appendEvent.mockRejectedValue(new Error("db error"));

      const subscription = toObservable(
        await caller.workflow.stream({
          requirement: "test",
        })
      );

      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: () => {},
          error: () => resolve(),
          complete: resolve,
        });
      });

      expect(workflowRepoMocks.appendEvent).toHaveBeenCalled();
    });

    it("marks workflow runs as cancelled when registry cancel is invoked", async () => {
      const mockRunId = "cancel-run-id";
      let active = true;
      const streamingExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          while (active) {
            yield {
              _: "progress",
              pct: 1,
              message: "tick",
            } as WorkflowEvent;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        })(),
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockImplementation(() => {
          active = false;
          return Promise.resolve();
        }),
      } as ReturnType<typeof createMockExecutor>;

      workflowRuntimeMocks.createRuntime.mockReturnValue(streamingExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const observable = toObservable(
        await caller.workflow.stream({ requirement: "test" })
      );

      observable.subscribe({
        next: () => {
          const registerArgs = runRegistryMocks.register.mock.calls[0]?.[1];
          registerArgs?.cancel?.();
        },
        error: (error) => {
          throw error;
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 5));

      const cancelCall = workflowRepoMocks.updateRun.mock.calls.find(
        ([, patch]) => patch.status === "cancelled"
      );
      expect(cancelCall).toBeTruthy();
      expect(cancelCall?.[0]).toBe(mockRunId);
      expect(cancelCall?.[1]).toMatchObject({
        status: "cancelled",
        completedAt: expect.any(Date),
      });
      const refreshReasons = triggerPreferenceRefreshMock.mock.calls.map(
        ([, options]) => (options as { reason?: string })?.reason
      );
      expect(refreshReasons).toContain("workflow_stream_cancelled");
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

  // Dual-path executor tests (Phase 3.3)
  describe("executor compatibility", () => {
    describe("with legacy runner (USE_WORKFLOW_RUNTIME=false)", () => {
      it("creates workflow with runPlanV6", async () => {
        setupExecutorPath(false);

        const mockRunId = "test-run-id";
        const mockSummary = "Test summary";
        const mockExecutor = createMockExecutor(mockRunId, mockSummary, [
          { _: "run", id: mockRunId } as WorkflowEvent,
        ]);

        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({
          id: mockRunId,
          userId: "test-user",
          workflowId: "plan",
          status: "running",
        } as any);
        runRegistryMocks.register.mockResolvedValue(undefined);

        const result = await caller.workflow.start({
          requirement: "test requirement",
          auto: "low",
        });

        expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
        expect(result.runId).toBe(mockRunId);
      });

      it("streams events with runPlanV6", async () => {
        setupExecutorPath(false);

        const mockRunId = "test-run-id";
        const events: WorkflowEvent[] = [
          { _: "run", id: mockRunId } as WorkflowEvent,
          { _: "progress", pct: 100, message: "done" } as WorkflowEvent,
        ];

        const mockExecutor = createMockExecutor(mockRunId, "test", events);
        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
        workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
        workflowRepoMocks.updateRun.mockResolvedValue({} as any);
        runRegistryMocks.register.mockResolvedValue(undefined);
        runRegistryMocks.unregister.mockResolvedValue(undefined);

        const subscription = toObservable(
          await caller.workflow.stream({ requirement: "test" })
        );
        const receivedEvents: WorkflowEvent[] = [];

        await new Promise<void>((resolve, reject) => {
          subscription.subscribe({
            next: (event) => receivedEvents.push(event),
            error: reject,
            complete: resolve,
          });
        });

        expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
        expect(receivedEvents).toHaveLength(events.length);
      });
    });

    describe("with new runtime (USE_WORKFLOW_RUNTIME=true)", () => {
      it("creates workflow with createRuntime", async () => {
        setupExecutorPath(true);

        const mockRunId = "test-run-id";
        const mockSummary = "Test summary";
        const mockExecutor = createMockExecutor(mockRunId, mockSummary, [
          { _: "run", id: mockRunId } as WorkflowEvent,
        ]);

        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({
          id: mockRunId,
          userId: "test-user",
          workflowId: "plan",
          status: "running",
        } as any);
        runRegistryMocks.register.mockResolvedValue(undefined);

        const result = await caller.workflow.start({
          requirement: "test requirement",
          auto: "low",
        });

        expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
        expect(result.runId).toBe(mockRunId);

        // Verify runtime was called with correct model
        const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
        expect(call).toHaveProperty("model");
        expect(call).toHaveProperty("signal");
        expect(call.stepTimeoutMs).toBe(5 * 60 * 1000);
        expect(call.workflowTimeoutMs).toBe(30 * 60 * 1000);
      });

      it("streams events with createRuntime", async () => {
        setupExecutorPath(true);

        const mockRunId = "test-run-id";
        const events: WorkflowEvent[] = [
          { _: "run", id: mockRunId } as WorkflowEvent,
          { _: "progress", pct: 100, message: "done" } as WorkflowEvent,
        ];

        const mockExecutor = createMockExecutor(mockRunId, "test", events);
        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
        workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
        workflowRepoMocks.updateRun.mockResolvedValue({} as any);
        runRegistryMocks.register.mockResolvedValue(undefined);
        runRegistryMocks.unregister.mockResolvedValue(undefined);

        const subscription = toObservable(
          await caller.workflow.stream({ requirement: "test" })
        );
        const receivedEvents: WorkflowEvent[] = [];

        await new Promise<void>((resolve, reject) => {
          subscription.subscribe({
            next: (event) => receivedEvents.push(event),
            error: reject,
            complete: resolve,
          });
        });

        expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
        expect(receivedEvents).toHaveLength(events.length);
      });

      it("passes Linear context correctly", async () => {
        setupExecutorPath(true);

        const mockRunId = "test-run-id";
        const mockExecutor = createMockExecutor(mockRunId, "test", []);

        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
        runRegistryMocks.register.mockResolvedValue(undefined);

        await caller.workflow.start({
          requirement: "test",
          auto: "low",
          linear: {
            sessionId: "linear-session-123",
            space: "team-space",
          },
          authzLinear: "linear-token-xyz",
        });

        expect(workflowRuntimeMocks.createRuntime).toHaveBeenCalledTimes(1);
        const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
        expect(call.input.linear).toEqual({
          sessionId: "linear-session-123",
          space: "team-space",
          authz: "linear-token-xyz",
        });
      });

      it("handles cancel correctly", async () => {
        setupExecutorPath(true);

        const mockRunId = "test-run-id";
        const cancelMock = vi.fn();
        const mockExecutor = createMockExecutor(mockRunId, "test", []);
        mockExecutor.cancel = cancelMock;

        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
        runRegistryMocks.register.mockResolvedValue(undefined);

        await caller.workflow.start({
          requirement: "test",
          auto: "low",
        });

        expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);
        const registerCall = runRegistryMocks.register.mock.calls[0][1];

        // Call cancel handler
        await registerCall.cancel();

        expect(cancelMock).toHaveBeenCalledTimes(1);
      });

      it("handles resume correctly", async () => {
        setupExecutorPath(true);

        const mockRunId = "test-run-id";
        const resumeMock = vi.fn().mockResolvedValue(undefined);
        const mockExecutor = createMockExecutor(mockRunId, "test", []);
        mockExecutor.resume = resumeMock;

        workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
        workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
        runRegistryMocks.register.mockResolvedValue(undefined);

        await caller.workflow.start({
          requirement: "test",
          auto: "low",
        });

        expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);
        const registerCall = runRegistryMocks.register.mock.calls[0][1];

        // Call resume handler
        const resumeData = { event: "bio-authz" as const, authz: "token-123" };
        await registerCall.resume({ resumeData });

        expect(resumeMock).toHaveBeenCalledWith(resumeData);
      });
    });

    it("produces identical event streams", async () => {
      const events: WorkflowEvent[] = [
        { _: "run", id: "test-run-id" } as WorkflowEvent,
        { _: "progress", pct: 10, message: "p10" } as WorkflowEvent,
        { _: "progress", pct: 100, message: "p100" } as WorkflowEvent,
      ];

      // Test with runner
      setupExecutorPath(false);
      const runnerExecutor = createMockExecutor("test-run-id", "test", events);
      workflowRuntimeMocks.createRuntime.mockReturnValue(runnerExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({
        id: "test-run-id",
      } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const runnerSubscription = toObservable(
        await caller.workflow.stream({ requirement: "test" })
      );
      const runnerEvents: WorkflowEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        runnerSubscription.subscribe({
          next: (event) => runnerEvents.push(event),
          error: reject,
          complete: resolve,
        });
      });

      // Test with runtime
      setupExecutorPath(true);
      const runtimeExecutor = createMockExecutor("test-run-id", "test", events);
      workflowRuntimeMocks.createRuntime.mockReturnValue(runtimeExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({
        id: "test-run-id",
      } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const runtimeSubscription = toObservable(
        await caller.workflow.stream({ requirement: "test" })
      );
      const runtimeEvents: WorkflowEvent[] = [];

      await new Promise<void>((resolve, reject) => {
        runtimeSubscription.subscribe({
          next: (event) => runtimeEvents.push(event),
          error: reject,
          complete: resolve,
        });
      });

      // Compare event streams (excluding eventId which is added by router)
      expect(runnerEvents.length).toBe(runtimeEvents.length);
      for (let i = 0; i < runnerEvents.length; i++) {
        const runnerEvent = { ...runnerEvents[i] };
        const runtimeEvent = { ...runtimeEvents[i] };
        (runnerEvent as any).eventId = undefined;
        (runtimeEvent as any).eventId = undefined;
        expect(runnerEvent).toEqual(runtimeEvent);
      }
    });
  });
});
