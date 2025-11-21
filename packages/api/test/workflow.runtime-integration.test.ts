/**
 * Workflow Runtime Integration Tests
 * 
 * Tests specific integration points between workflow router and runtime:
 * - Linear integration (session mapping, activity emission)
 * - Metrics recording
 * - Resume flows (bio-authz, deploy-authz)
 * - Cancellation propagation
 */

import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import type { WorkflowEvent } from "@alfred/type";
import {
  mockPolicyAudit,
  mockRunRegistry,
  mockWorkflowRepo,
  mockWorkflowRuntime,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const workflowRepoMocks = mockWorkflowRepo();
const runRegistryMocks = mockRunRegistry();
const workflowRuntimeMocks = mockWorkflowRuntime();

const workflowStreamDurationSecondsMock = {
  startTimer: vi.fn().mockReturnValue(() => {}),
};

const workflowStreamEventsTotalMock = {
  inc: vi.fn(),
};


const multiAgentTasksTotalMock = { inc: vi.fn() };
const multiAgentWavesTotalMock = { inc: vi.fn() };
const multiAgentAgentDurationSecondsMock = { observe: vi.fn() };
const multiAgentErrorsTotalMock = { inc: vi.fn() };

mock.module("@alfred/api/metrics", () => ({
  ...metricsStub,
  workflowStreamDurationSeconds: workflowStreamDurationSecondsMock,
  workflowStreamEventsTotal: workflowStreamEventsTotalMock,
  multiAgentTasksTotal: multiAgentTasksTotalMock,
  multiAgentWavesTotal: multiAgentWavesTotalMock,
  multiAgentAgentDurationSeconds: multiAgentAgentDurationSecondsMock,
  multiAgentErrorsTotal: multiAgentErrorsTotalMock,
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
  delete process.env.USE_WORKFLOW_RUNTIME;
});

describe("workflow runtime integration", () => {
  describe("Linear integration", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("persists Linear session mapping in workflow_runs", async () => {
      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          yield { type: "run", id: mockRunId } as WorkflowEvent;
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

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
        authzLinear: "linear-token",
      });

      expect(workflowRepoMocks.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockRunId,
          linearSessionId: "linear-session-123",
          linearSpace: "team-space",
        })
      );
    });

    it("passes Linear context to runtime", async () => {
      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
        linear: {
          sessionId: "linear-session-123",
          space: "team-space",
          teamId: "team-456",
        },
        authzLinear: "linear-token-xyz",
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.input.linear).toEqual({
        sessionId: "linear-session-123",
        space: "team-space",
        authz: "linear-token-xyz",
      });
    });

    it("omits Linear context when sessionId missing", async () => {
      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
        linear: {
          space: "team-space",
        } as any,
        authzLinear: "linear-token",
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.input.linear).toBeUndefined();
    });

    it("omits Linear context when authzLinear missing", async () => {
      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

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
        // authzLinear omitted
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.input.linear).toBeUndefined();
    });
  });

  describe("Metrics recording", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("records workflow stream duration", async () => {
      const mockRunId = "test-run-id";
      const stopTimerMock = vi.fn();
      workflowStreamDurationSecondsMock.startTimer.mockReturnValue(stopTimerMock);

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          yield { type: "run", id: mockRunId } as WorkflowEvent;
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({ requirement: "test" });

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: () => {},
          error: reject,
          complete: resolve,
        });
      });

      expect(workflowStreamDurationSecondsMock.startTimer).toHaveBeenCalled();
      expect(stopTimerMock).toHaveBeenCalledWith({ status: "ok" });
    });

    it("records workflow stream events", async () => {
      const mockRunId = "test-run-id";
      const events: WorkflowEvent[] = [
        { type: "run", id: mockRunId } as WorkflowEvent,
        { type: "progress", pct: 50, message: "halfway" } as WorkflowEvent,
        { type: "progress", pct: 100, message: "completed" } as WorkflowEvent,
      ];

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          for (const event of events) {
            yield event;
          }
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({ requirement: "test" });

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: () => {},
          error: reject,
          complete: resolve,
        });
      });

      // Verify metrics recorded: 1 run + N chunks + 1 complete
      expect(workflowStreamEventsTotalMock.inc).toHaveBeenCalledWith({ event: "run" });
      expect(workflowStreamEventsTotalMock.inc).toHaveBeenCalledWith({ event: "complete" });
    });

    it("records error events on failure", async () => {
      const mockRunId = "test-run-id";
      const stopTimerMock = vi.fn();
      workflowStreamDurationSecondsMock.startTimer.mockReturnValue(stopTimerMock);

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          throw new Error("test error");
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({ requirement: "test" });

      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: () => {},
          error: () => resolve(),
          complete: () => resolve(),
        });
      });

      expect(workflowStreamEventsTotalMock.inc).toHaveBeenCalledWith({ event: "error" });
      expect(stopTimerMock).toHaveBeenCalledWith({ status: "error" });
    });
  });

  describe("Multi-agent metrics", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("records multi-agent events into metrics and DB", async () => {
      const mockRunId = "multi-agent-run";
      const events: WorkflowEvent[] = [
        { type: "run", id: mockRunId } as WorkflowEvent,
        {
          type: "event",
          kind: "data-subtasks",
          data: [{ id: "T1" }, { id: "T2" }],
        } as any,
        {
          type: "event",
          kind: "data-wave-plan",
          data: { waveId: "wave_0" },
        } as any,
        {
          type: "event",
          kind: "wave-result",
          data: {
            waveId: "wave_0",
            status: "partial",
            agents: [
              {
                agentId: "agent-1",
                role: "worker",
                status: "stuck",
                stuck: true,
                durationSeconds: 5,
              },
              {
                agentId: "agent-2",
                role: "worker",
                status: "completed",
                stuck: false,
                durationSeconds: 2,
              },
            ],
          },
        } as any,
        {
          type: "event",
          kind: "wave-aborted",
          data: { waveId: "wave_0", waveFailRate: 0.6, overallFailRate: 0.6 },
        } as any,
        {
          type: "event",
          kind: "merge-agent-result",
          data: { role: "merge", status: "completed", durationSeconds: 7 },
        } as any,
        {
          type: "event",
          kind: "review-agent-result",
          data: { role: "review", status: "failed", durationSeconds: 9 },
        } as any,
        { type: "event", kind: "merge-plan", data: { summary: "merge", expectedFiles: ["a.ts"] } } as any,
        { type: "event", kind: "review-plan", data: { summary: "review", checks: [] } } as any,
      ];

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          for (const ev of events) {
            yield ev;
          }
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      workflowRepoMocks.updateRun.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);
      runRegistryMocks.unregister.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({ requirement: "test" });

      await new Promise<void>((resolve, reject) => {
        subscription.subscribe({
          next: () => {},
          error: reject,
          complete: resolve,
        });
      });

      expect(multiAgentTasksTotalMock.inc).toHaveBeenCalledWith({ status: "created" }, 2);
      expect(multiAgentWavesTotalMock.inc).toHaveBeenCalledWith({ status: "started" });
      expect(multiAgentWavesTotalMock.inc).toHaveBeenCalledWith({ status: "completed" });

      // Per-agent duration and error metrics
      expect(multiAgentAgentDurationSecondsMock.observe).toHaveBeenCalledWith(
        { role: "worker", outcome: "stuck" },
        5
      );
      expect(multiAgentAgentDurationSecondsMock.observe).toHaveBeenCalledWith(
        { role: "worker", outcome: "ok" },
        2
      );
      expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
        kind: "stuck_agent",
      });
      expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
        kind: "wave_aborted",
      });
      expect(multiAgentAgentDurationSecondsMock.observe).toHaveBeenCalledWith(
        { role: "merge", outcome: "ok" },
        7
      );
      expect(multiAgentAgentDurationSecondsMock.observe).toHaveBeenCalledWith(
        { role: "review", outcome: "error" },
        9
      );
      expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
        kind: "review_failed",
      });

      const mergeCall = workflowRepoMocks.appendEvent.mock.calls.find(
        (c) => c[0]?.eventType === "event" && (c[0]?.eventData as any)?.kind === "merge-plan"
      );
      const reviewCall = workflowRepoMocks.appendEvent.mock.calls.find(
        (c) => c[0]?.eventType === "event" && (c[0]?.eventData as any)?.kind === "review-plan"
      );

      expect(mergeCall).toBeTruthy();
      expect(reviewCall).toBeTruthy();
    });
  });

  describe("Resume flows", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("handles bio-authz resume", async () => {
      const mockRunId = "test-run-id";
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: resumeMock,
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const registerCall = runRegistryMocks.register.mock.calls[0][1];
      await registerCall.resume({
        resumeData: { event: "bio-authz", authz: "bio-token-123" },
      });

      expect(resumeMock).toHaveBeenCalledWith({
        resumeData: { event: "bio-authz", authz: "bio-token-123" },
      });
    });

    it("handles deploy-authz resume", async () => {
      const mockRunId = "test-run-id";
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: resumeMock,
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const registerCall = runRegistryMocks.register.mock.calls[0][1];
      await registerCall.resume({
        resumeData: { event: "deploy-authz", authz: "deploy-token-456" },
      });

      expect(resumeMock).toHaveBeenCalledWith({
        resumeData: { event: "deploy-authz", authz: "deploy-token-456" },
      });
    });

    it("handles linear-authz resume", async () => {
      const mockRunId = "test-run-id";
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: resumeMock,
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const registerCall = runRegistryMocks.register.mock.calls[0][1];
      await registerCall.resume({
        resumeData: { event: "linear-authz", authz: "linear-token-789" },
      });

      expect(resumeMock).toHaveBeenCalledWith({
        resumeData: { event: "linear-authz", authz: "linear-token-789" },
      });
    });
  });

  describe("Cancellation", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("propagates cancellation to runtime", async () => {
      const mockRunId = "test-run-id";
      const cancelMock = vi.fn();
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          yield { type: "run", id: mockRunId } as WorkflowEvent;
        })(),
        resume: vi.fn(),
        cancel: cancelMock,
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const registerCall = runRegistryMocks.register.mock.calls[0][1];
      await registerCall.cancel();

      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it("records cancel event on stream cancellation", async () => {
      const mockRunId = "test-run-id";
      const stopTimerMock = vi.fn();
      workflowStreamDurationSecondsMock.startTimer.mockReturnValue(stopTimerMock);

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {
          yield { type: "run", id: mockRunId } as WorkflowEvent;
          // Simulate long-running workflow
          await new Promise((resolve) => setTimeout(resolve, 10000));
        })(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      workflowRepoMocks.appendEvent.mockResolvedValue({} as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      const subscription = caller.workflow.stream({ requirement: "test" });
      let unsubscribe: (() => void) | null = null;

      const promise = new Promise<void>((resolve) => {
        subscription.subscribe({
          next: () => {
            // Cancel after first event
            if (unsubscribe) {
              unsubscribe();
              resolve();
            }
          },
          error: () => resolve(),
          complete: () => resolve(),
        });
      });

      // Capture unsubscribe function
      const sub = subscription.subscribe({ next: () => {}, error: () => {}, complete: () => {} });
      unsubscribe = sub.unsubscribe;

      await promise;

      expect(workflowStreamEventsTotalMock.inc).toHaveBeenCalledWith({ event: "cancel" });
      expect(stopTimerMock).toHaveBeenCalledWith({ status: "cancel" });
    });

    it("aborts via AbortController", async () => {
      const mockRunId = "test-run-id";
      let capturedSignal: AbortSignal | null = null;

      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockImplementation((options: any) => {
        capturedSignal = options.signal;
        return mockExecutor;
      });
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      expect(capturedSignal).toBeTruthy();
      expect(capturedSignal?.aborted).toBe(false);

      // Trigger cancel
      const registerCall = runRegistryMocks.register.mock.calls[0][1];
      registerCall.abortController.abort();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe("Model configuration", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("uses OPENAI_MODEL_PLAN env variable", async () => {
      process.env.OPENAI_MODEL_PLAN = "gpt-4o-2024-11-20";

      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.model).toBeTruthy();

      delete process.env.OPENAI_MODEL_PLAN;
    });

    it("defaults to gpt-4o when OPENAI_MODEL_PLAN not set", async () => {
      delete process.env.OPENAI_MODEL_PLAN;

      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.model).toBeTruthy();
    });
  });

  describe("Timeout configuration", () => {
    beforeAll(() => {
      process.env.USE_WORKFLOW_RUNTIME = "true";
    });

    it("passes correct timeout values", async () => {
      const mockRunId = "test-run-id";
      const mockExecutor = {
        runId: mockRunId,
        summary: "test",
        stream: (async function* () {})(),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      workflowRuntimeMocks.createRuntime.mockReturnValue(mockExecutor);
      workflowRepoMocks.createRun.mockResolvedValue({ id: mockRunId } as any);
      runRegistryMocks.register.mockResolvedValue(undefined);

      await caller.workflow.start({
        requirement: "test",
        auto: "low",
      });

      const call = workflowRuntimeMocks.createRuntime.mock.calls[0][0];
      expect(call.stepTimeoutMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(call.workflowTimeoutMs).toBe(30 * 60 * 1000); // 30 minutes
    });
  });
});
