/**
 * Workflow failure-mode tests
 *
 * Focus: multi-agent failure and guidance signals surfaced via the router.
 * Uses mocked runtime executor to avoid Codex/CLI dependencies.
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
  multiAgentTasksTotalMock.inc.mockReset();
  multiAgentWavesTotalMock.inc.mockReset();
  multiAgentAgentDurationSecondsMock.observe.mockReset();
  multiAgentErrorsTotalMock.inc.mockReset();
  delete process.env.USE_WORKFLOW_RUNTIME;
});

describe("workflow failure modes (runtime)", () => {
  beforeAll(() => {
    process.env.USE_WORKFLOW_RUNTIME = "true";
  });

  it("persists wave-aborted events and records error metrics", async () => {
    const mockRunId = "failure-mode-run";
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
              durationSeconds: 3,
            },
            {
              agentId: "agent-2",
              role: "worker",
              status: "failed",
              stuck: true,
              durationSeconds: 4,
            },
          ],
        },
      } as any,
      {
        type: "event",
        kind: "wave-aborted",
        data: { waveId: "wave_0", waveFailRate: 1, overallFailRate: 1 },
      } as any,
    ];

    const mockExecutor = {
      runId: mockRunId,
      summary: "failure scenario",
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

    const subscription = caller.workflow.stream({ requirement: "test failure" });

    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: () => {},
        error: reject,
        complete: resolve,
      });
    });

    // Ensure wave-aborted event was persisted
    const waveAbortCall = workflowRepoMocks.appendEvent.mock.calls.find(
      (c) =>
        c[0]?.eventType === "event" &&
        (c[0]?.eventData as any)?.kind === "wave-aborted"
    );
    expect(waveAbortCall).toBeTruthy();

    // Error metrics should record stuck agents and aborted wave
    expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
      kind: "stuck_agent",
    });
    expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
      kind: "wave_aborted",
    });
  });

  it("persists agent_needs_guidance notices", async () => {
    const mockRunId = "guidance-run";
    const events: WorkflowEvent[] = [
      { type: "run", id: mockRunId } as WorkflowEvent,
      {
        type: "event",
        kind: "data-subtasks",
        data: [{ id: "T1" }],
      } as any,
      {
        type: "notice",
        message: "agent_needs_guidance",
      } as WorkflowEvent,
    ];

    const mockExecutor = {
      runId: mockRunId,
      summary: "guidance scenario",
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

    const subscription = caller.workflow.stream({ requirement: "need guidance" });

    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: () => {},
        error: reject,
        complete: resolve,
      });
    });

    const guidanceCall = workflowRepoMocks.appendEvent.mock.calls.find(
      (c) =>
        (c[0]?.eventData as any)?.type === "notice" &&
        (c[0]?.eventData as any)?.message === "agent_needs_guidance"
    );
    expect(guidanceCall).toBeTruthy();
  });

  it("records merge-conflict metrics when merge-conflict event is emitted", async () => {
    const mockRunId = "conflict-run";
    const events: WorkflowEvent[] = [
      { type: "run", id: mockRunId } as WorkflowEvent,
      {
        type: "event",
        kind: "merge-conflict",
        data: {
          files: ["a.ts", "b.ts"],
          totalMarkers: 4,
          counts: { "a.ts": 2, "b.ts": 2 },
        },
      } as any,
    ];

    const mockExecutor = {
      runId: mockRunId,
      summary: "conflict scenario",
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

    const subscription = caller.workflow.stream({ requirement: "merge conflict" });

    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: () => {},
        error: reject,
        complete: resolve,
      });
    });

    expect(multiAgentErrorsTotalMock.inc).toHaveBeenCalledWith({
      kind: "merge_conflict",
    });
  });
});
