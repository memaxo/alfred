import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import { createTestCaller } from "./utils/trpc";
import {
  mockPolicyAudit,
  mockRunRegistry,
  mockWorkflowRepo,
  mockWorkflowRunner,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

const workflowRepoMocks = mockWorkflowRepo();
const runRegistryMocks = mockRunRegistry();
const workflowRunnerMocks = mockWorkflowRunner();

const workflowStreamDurationSecondsMock = {
  startTimer: vi.fn().mockReturnValue(() => {}),
};

const workflowStreamEventsTotalMock = {
  inc: vi.fn(),
};

mock.module("@alfred/api/metrics", () => ({
  workflowStreamDurationSeconds: workflowStreamDurationSecondsMock,
  workflowStreamEventsTotal: workflowStreamEventsTotalMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["workflow.plan", "workflow.stream", "workflow.resume"],
  });
});

afterEach(() => {
  resetAllMocks();
  workflowStreamDurationSecondsMock.startTimer.mockReturnValue(() => {});
  workflowStreamEventsTotalMock.inc.mockReset();
});

describe("workflow router", () => {
  describe("start", () => {
    it("creates a workflow run and registers handle", async () => {
      const mockRunId = "test-run-id";
      const mockSummary = "Plan initialized for test requirement";
      const mockStream = async function* () {
        yield { type: "run", id: mockRunId } as WorkflowEvent;
        yield { type: "progress", pct: 100, message: "completed" } as WorkflowEvent;
      };

      workflowRunnerMocks.runPlanV6.mockReturnValue({
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

      runRegistryMocks.register.mockResolvedValue(undefined);

      const result = await caller.workflow.start({
        requirement: "test requirement",
        auto: "low",
      });

      expect(workflowRunnerMocks.runPlanV6).toHaveBeenCalledTimes(1);
      expect(workflowRepoMocks.createRun).toHaveBeenCalledWith({
        id: mockRunId,
        userId: "test-user",
        workflowId: "plan",
        status: "running",
        inputData: {
          requirement: "test requirement",
          auto: "low",
        },
      });
      expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        runId: mockRunId,
        summary: mockSummary,
      });
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
      workflowRunnerMocks.runPlanV6.mockImplementation(() => {
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
        { type: "run", id: mockRunId } as WorkflowEvent,
        { type: "progress", pct: 50, message: "halfway" } as WorkflowEvent,
        { type: "progress", pct: 100, message: "completed" } as WorkflowEvent,
      ];

      const mockStream = async function* () {
        for (const event of events) {
          yield event;
        }
      };

      workflowRunnerMocks.runPlanV6.mockReturnValue({
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

      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({
        id: mockRunId,
        status: "completed",
      } as any);

      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({
        requirement: "test",
      });

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
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(events.length);
      expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(mockRunId, {
        status: "completed",
        completedAt: expect.any(Date),
      });
    });

    it("handles persistence failures gracefully", async () => {
      const mockRunId = "test-run-id";
      const mockStream = async function* () {
        yield { type: "run", id: mockRunId } as WorkflowEvent;
      };

      workflowRunnerMocks.runPlanV6.mockReturnValue({
        runId: mockRunId,
        summary: "test",
        stream: mockStream(),
        resume: vi.fn(),
        cancel: vi.fn(),
      });

      workflowRepoMocks.createRun.mockResolvedValue({} as any);
      workflowRepoMocks.appendEvent.mockRejectedValue(new Error("db error"));

      const subscription = caller.workflow.stream({
        requirement: "test",
      });

      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: () => {},
          error: () => resolve(),
          complete: resolve,
        });
      });

      expect(workflowRepoMocks.appendEvent).toHaveBeenCalled();
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

      expect(runRegistryMocks.dispatchResume).toHaveBeenCalledWith("test-run-id", {
        event: "bio-authz",
        authz: "token-123",
      });
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
});

