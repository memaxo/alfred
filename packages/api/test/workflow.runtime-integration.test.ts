// Import Redis mocks BEFORE any other imports (via workflow fixture)
import {
  installWorkflowRuntimeFixture,
  type WorkflowRuntimeFixtureHandle,
  workflowMetricsStub,
} from "@alfred/test-kit/workflow/runtime-fixture";

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
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

type CreateTestCaller = typeof import("./utils/trpc")["createTestCaller"];
type TestCaller = Awaited<ReturnType<CreateTestCaller>>;
type WorkflowRuntimeCtor = typeof import("@alfred/runtime")["WorkflowRuntime"];

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
      scopes: [
        "workflow.plan",
        "workflow.stream",
        "workflow.resume",
        "workflow.read",
      ],
    });
    ({ WorkflowRuntime: WorkflowRuntimeClass } = await import(
      "@alfred/runtime"
    ));
  });

  afterAll(async () => {
    await workflowFixture.stop();
  });

  beforeEach(() => {
    process.env.USE_WORKFLOW_RUNTIME = "true";
    workflowFixture.clearRepo();
    workflowFixture.clearLinearRequests();
    workflowFixture.setAiStreamMode("normal");
    workflowFixture.setReviewGateFailure(false);
    resetMetric(workflowMetricsStub.workflowStreamDurationSeconds);
    resetMetric(workflowMetricsStub.workflowStreamEventsTotal);
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
    expect(
      workflowMetricsStub.workflowStreamDurationSeconds.startTimer
    ).toHaveBeenCalled();
    const stopTimerMock =
      workflowMetricsStub.workflowStreamDurationSeconds.startTimer.mock.results.at(
        -1
      )?.value;
    expect(stopTimerMock).toBeDefined();
    expect(stopTimerMock).toHaveBeenCalledWith({ status: "ok" });

    expect(
      workflowMetricsStub.workflowStreamEventsTotal.inc
    ).toHaveBeenCalledWith({
      event: "run",
    });
    expect(
      workflowMetricsStub.workflowStreamEventsTotal.inc
    ).toHaveBeenCalledWith({
      event: "complete",
    });
  });

  it("records error metrics when the review gate blocks completion", async () => {
    workflowFixture.setReviewGateFailure(true);
    await expect(
      streamWorkflow({
        workspace: await createWorkspaceDir(),
      })
    ).rejects.toThrow("review_checklist_incomplete");

    const stopTimerMock =
      workflowMetricsStub.workflowStreamDurationSeconds.startTimer.mock.results.at(
        -1
      )?.value;
    expect(stopTimerMock).toHaveBeenCalledWith({ status: "error" });
    expect(
      workflowMetricsStub.workflowStreamEventsTotal.inc
    ).toHaveBeenCalledWith({
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

  it("records cancel metrics when stream unsubscribes", async () => {
    const subscription = await caller.workflow.stream({
      requirement: "cancel-flow",
      auto: "low",
      workspace: await createWorkspaceDir(),
    });

    await new Promise<void>((resolve, reject) => {
      const innerSub = subscription.subscribe({
        next: () => {
          innerSub?.unsubscribe();
          resolve();
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(
      workflowMetricsStub.workflowStreamEventsTotal.inc
    ).toHaveBeenCalledWith({
      event: "cancel",
    });
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

  async function streamWorkflow(
    options: {
      requirement?: string;
      auto?: "read" | "low" | "medium" | "high";
      linear?: {
        sessionId: string;
        space: string;
        teamId?: string;
      };
      workspace?: string;
    } = {}
  ) {
    const workspace = options.workspace ?? (await createWorkspaceDir());
    const auto = options.auto ?? "low";
    const subscription = await caller.workflow.stream({
      requirement: options.requirement ?? "draft release notes",
      auto,
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

function resetMetric(metric?: {
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
