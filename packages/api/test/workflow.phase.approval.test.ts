import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import type { PipelineSnapshot } from "@alfred/pipeline";

type Caller = Awaited<
  ReturnType<typeof import("./utils/trpc").createTestCaller>
>;

function baseSnapshot(
  overrides: Partial<PipelineSnapshot> = {}
): PipelineSnapshot {
  return {
    runId: "run-1",
    status: "suspended",
    requirement: "test requirement",
    lastCompletedStage: "schedule",
    lastCompletedStageIndex: 3,
    contextEntries: [],
    stageResults: [],
    startedAt: 1,
    lastEventAt: 1,
    lastEventId: null,
    error: null,
    ...overrides,
  };
}

describe("workflow.phase.approveAndExecute", () => {
  let caller: Caller;
  let snapshotByRunId = new Map<string, PipelineSnapshot | null>();

  const planRepoStub = {
    getPlanById: vi.fn(),
    createPlan: vi.fn(),
    updatePlanStatus: vi.fn(),
    updatePlan: vi.fn(),
    getPlansByUserId: vi.fn(),
    deletePlan: vi.fn(),
  };

  const workflowRepoStub = {
    updateRun: vi.fn(),
    getRun: vi.fn(),
    upsertRun: vi.fn(),
  };

  beforeAll(async () => {
    mock.module("@alfred/db/repo/workflow", () => ({
      PostgresCheckpointStorage: class PostgresCheckpointStorage {
        save(_runId: string, _snapshot: unknown): Promise<void> {
          return Promise.resolve();
        }
        load(runId: string): Promise<unknown | null> {
          return Promise.resolve(snapshotByRunId.get(runId) ?? null);
        }
      },
    }));

    const dbAbs = new URL("../../db/src/index.ts", import.meta.url).pathname;
    const realDb = await import(dbAbs);
    mock.module("@alfred/db", () => ({
      ...realDb,
      planRepo: planRepoStub,
      workflowRepo: workflowRepoStub,
    }));

    const { createTestCaller } = await import("./utils/trpc");
    caller = await createTestCaller({ scopes: ["workflow.execute"] });
  });

  beforeEach(() => {
    planRepoStub.getPlanById.mockReset();
    planRepoStub.createPlan.mockReset();
    planRepoStub.updatePlanStatus.mockReset();
    workflowRepoStub.updateRun.mockReset();

    snapshotByRunId = new Map();
  });

  it("approves plan and transitions run to running", async () => {
    snapshotByRunId.set(
      "run-1",
      baseSnapshot({
        contextEntries: [
          ["workspace", "/repo"],
          ["userId", "test-user"],
          [
            "planOutput",
            {
              planId: "plan-1",
              structuredPlan: {
                id: "plan-1",
                title: "Test plan",
                intent: "test requirement",
                workspace: "/repo",
                phases: [],
                resources: {
                  agentCount: 1,
                  strategy: "sequential",
                  isolation: "agentfs",
                },
                evaluationCriteria: [],
              },
            },
          ],
        ],
      })
    );

    planRepoStub.getPlanById.mockResolvedValue(null);
    planRepoStub.createPlan.mockResolvedValue({ id: "plan-1" });
    planRepoStub.updatePlanStatus.mockResolvedValue({ id: "plan-1" });
    workflowRepoStub.updateRun.mockResolvedValue({ id: "run-1" });

    const res = await caller.workflow.phase.approveAndExecute({
      runId: "run-1",
    });
    expect(res).toEqual({ runId: "run-1", planId: "plan-1" });

    expect(planRepoStub.getPlanById).toHaveBeenCalledWith("plan-1");
    expect(planRepoStub.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "plan-1",
        status: "pending",
        intent: "test requirement",
      })
    );
    expect(planRepoStub.updatePlanStatus).toHaveBeenCalledWith(
      "plan-1",
      "approved",
      "test-user"
    );
    expect(workflowRepoStub.updateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        status: "running",
        planId: "plan-1",
        suspendedAt: null,
        errorMessage: null,
      })
    );
  });

  it("throws BAD_REQUEST when planId is missing in snapshot", async () => {
    snapshotByRunId.set(
      "run-1",
      baseSnapshot({
        contextEntries: [["workspace", "/repo"]],
      })
    );

    await expect(
      caller.workflow.phase.approveAndExecute({ runId: "run-1" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "plan_not_ready",
    });

    expect(planRepoStub.updatePlanStatus).not.toHaveBeenCalled();
    expect(workflowRepoStub.updateRun).not.toHaveBeenCalled();
  });
});
