import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowEvent } from "@alfred/type";
import {
  installWorkflowRuntimeFixture,
  type WorkflowRuntimeFixtureHandle,
} from "@alfred/test-kit/workflow/runtime-fixture";
import { metricsStub } from "./utils/mock-metrics";
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

type CreateTestCaller = typeof import("./utils/trpc")["createTestCaller"];
type TestCaller = Awaited<ReturnType<CreateTestCaller>>;
type WorkflowRuntimeCtor = typeof import("@alfred/runtime")["WorkflowRuntime"];
type MetricMock = {
  inc: ReturnType<typeof vi.fn>;
  dec: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  labels: ReturnType<typeof vi.fn>;
  startTimer: ReturnType<typeof vi.fn>;
};

const metricsRecord = metricsStub as Record<string, MetricMock>;

function createMetricMock(): MetricMock {
  const metric: MetricMock = {
    inc: vi.fn(),
    dec: vi.fn(),
    observe: vi.fn(),
    set: vi.fn(),
    labels: vi.fn(() => metric),
    startTimer: vi.fn(() => vi.fn()),
  };
  return metric;
}

function ensureMetric(name: string) {
  if (!metricsRecord[name]) {
    metricsRecord[name] = createMetricMock();
  }
}

describe("workflow runtime integration (minimal-mock)", () => {
  let workflowFixture: WorkflowRuntimeFixtureHandle;
  let caller: TestCaller;
  let createTestCaller: CreateTestCaller;
  let WorkflowRuntimeClass: WorkflowRuntimeCtor;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    workflowFixture = await installWorkflowRuntimeFixture();
    ({ createTestCaller } = await import("./utils/trpc"));
    caller = await createTestCaller({
      scopes: ["workflow.plan", "workflow.stream", "workflow.resume", "workflow.read"],
    });
    ({ WorkflowRuntime: WorkflowRuntimeClass } = await import("@alfred/runtime"));
  });

  afterAll(async () => {
    await workflowFixture.stop();
  });

  beforeEach(() => {
    process.env.USE_WORKFLOW_RUNTIME = "true";
    workflowFixture.clearRepo();
    workflowFixture.clearLinearRequests();
    workflowFixture.setAiStreamMode("normal");
    ensureMetric("workflowStreamDurationSeconds");
    ensureMetric("workflowStreamEventsTotal");
    resetMetric(metricsStub.workflowStreamDurationSeconds);
    resetMetric(metricsStub.workflowStreamEventsTotal);
  });

  afterEach(async () => {
    const dirs = tempDirs.splice(0, tempDirs.length);
    await Promise.all(
      dirs.map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  it("persists Linear metadata and emits Linear activity events", async () => {
    const workspace = await createWorkspaceDir();
    const { runId } = await streamWorkflow({
      workspace,
      linear: {
        sessionId: "lin-123",
        space: "focus",
        teamId: "team-1",
      },
    });

    const stored = workflowFixture.runs.get(runId);
    expect(stored?.linearSessionId).toBe("lin-123");
    expect(stored?.linearSpace).toBe("focus");

    const activityEvents = workflowFixture.linearRequests.filter((req) =>
      String(req.input.action ?? "").startsWith("activity.")
    );
    expect(activityEvents.length).toBeGreaterThan(0);
  });

  it("stores workflow events in the repo stub", async () => {
    const { runId } = await streamWorkflow({
      workspace: await createWorkspaceDir(),
    });
    const rows = workflowFixture.events.filter((evt) => evt.runId === runId);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("records workflow stream metrics for successful runs", async () => {
    await streamWorkflow({ workspace: await createWorkspaceDir() });
    expect(metricsStub.workflowStreamDurationSeconds.startTimer).toHaveBeenCalled();
    const stopTimerMock =
      metricsStub.workflowStreamDurationSeconds.startTimer.mock.results.at(-1)
        ?.value;
    expect(stopTimerMock).toBeDefined();
    expect(stopTimerMock).toHaveBeenCalledWith({ status: "ok" });

    expect(metricsStub.workflowStreamEventsTotal.inc).toHaveBeenCalledWith({
      event: "run",
    });
    expect(metricsStub.workflowStreamEventsTotal.inc).toHaveBeenCalledWith({
      event: "complete",
    });
  });

  it("records error metrics when the AI stub fails", async () => {
    workflowFixture.setAiStreamMode("error");
    await expect(
      (async () => {
        const subscription = await caller.workflow.stream({
          requirement: "fail-runtime",
          auto: "low",
          workspace: await createWorkspaceDir(),
        });
        await new Promise<void>((resolve, reject) => {
          subscription.subscribe({
            next: () => {},
            error: reject,
            complete: resolve,
          });
        });
      })()
    ).rejects.toThrow("ai_stub_failure");

    const stopTimerMock =
      metricsStub.workflowStreamDurationSeconds.startTimer.mock.results.at(-1)
        ?.value;
    expect(stopTimerMock).toHaveBeenCalledWith({ status: "error" });
    expect(metricsStub.workflowStreamEventsTotal.inc).toHaveBeenCalledWith({
      event: "error",
    });
  });

  it("dispatches resume events through the runtime", async () => {
    const resumeSpy = vi.spyOn(WorkflowRuntimeClass.prototype, "resume");
    const result = await caller.workflow.start({
      requirement: "resume-flow",
      auto: "low",
    });

    await caller.workflow.resume({
      runId: result.runId,
      event: "bio-authz",
      authz: "bio-token",
    });

    expect(resumeSpy).toHaveBeenCalledWith({
      event: "bio-authz",
      authz: "bio-token",
    });
    resumeSpy.mockRestore();
  });

  it("cancels runtime execution when stream unsubscribes", async () => {
    const cancelSpy = vi.spyOn(WorkflowRuntimeClass.prototype, "cancel");
    const subscription = await caller.workflow.stream({
      requirement: "cancel-flow",
      auto: "low",
      workspace: await createWorkspaceDir(),
    });

    await new Promise<void>((resolve, reject) => {
      let innerSub:
        | ReturnType<typeof subscription.subscribe>
        | undefined;
      innerSub = subscription.subscribe({
        next: () => {
          innerSub?.unsubscribe();
          resolve();
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it("rejects resume requests for unknown runs", async () => {
    await expect(
      caller.workflow.resume({
        runId: "missing-run",
        event: "bio-authz",
        authz: "token",
      })
    ).rejects.toThrow("run_not_found");
  });

  it("returns stored events through workflow.events", async () => {
    const { runId } = await streamWorkflow({
      workspace: await createWorkspaceDir(),
    });
    const rows = await caller.workflow.events({ runId });
    expect(rows.length).toBeGreaterThan(0);
  });

  async function streamWorkflow(options: {
    requirement?: string;
    linear?: {
      sessionId: string;
      space: string;
      teamId?: string;
    };
    workspace?: string;
  } = {}) {
    const workspace = options.workspace ?? (await createWorkspaceDir());
    const subscription = await caller.workflow.stream({
      requirement: options.requirement ?? "draft release notes",
      auto: "low",
      workspace,
      linear: options.linear,
      authzLinear: options.linear ? "linear-token" : undefined,
    });

    const events: WorkflowEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      subscription.subscribe({
        next: (event) => events.push(event as WorkflowEvent),
        error: reject,
        complete: resolve,
      });
    });

    const runEvent = events.find(
      (event) => event.type === "run"
    ) as WorkflowEvent & { id: string };
    expect(runEvent?.id).toBeDefined();
    return { runId: runEvent.id, events, workspace };
  }

  async function createWorkspaceDir() {
    const dir = await mkdtemp(join(tmpdir(), "workflow-runtime-"));
    tempDirs.push(dir);
    return dir;
  }
});

function resetMetric(metric: {
  inc?: ReturnType<typeof vi.fn>;
  startTimer?: ReturnType<typeof vi.fn>;
}) {
  if (metric?.inc?.mockClear) {
    metric.inc.mockClear();
  }
  if (metric?.startTimer?.mockClear) {
    metric.startTimer.mockClear();
  }
}
