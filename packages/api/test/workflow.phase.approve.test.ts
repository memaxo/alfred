import { beforeAll, describe, expect, it, mock } from "bun:test";

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

  beforeAll(async () => {
    const snapshotByRunId = new Map<string, PipelineSnapshot | null>();

    const workflowRepo = {
      updateRun: mock(async (_runId: string, _patch: unknown) => {}),
    };

    mock.module("@alfred/db/repo/workflow", () => ({
      PostgresCheckpointStorage: class PostgresCheckpointStorage {
        async save(_runId: string, _snapshot: unknown): Promise<void> {}
        load(runId: string): Promise<unknown | null> {
          return Promise.resolve(snapshotByRunId.get(runId) ?? null);
        }
      },
      updateRun: workflowRepo.updateRun,
    }));

    const planRepo = {
      getPlanById: mock(async (_id: string) => null),
      createPlan: mock(async (_data: unknown) => {}),
      updatePlanStatus: mock(
        async (_id: string, _status: string, _userId: string) => {}
      ),
    };

    const dbAbs = new URL("../../db/src/index.ts", import.meta.url).pathname;
    const realDb = await import(dbAbs);
    mock.module("@alfred/db", () => ({
      ...realDb,
      planRepo,
      workflowRepo: {
        updateRun: workflowRepo.updateRun,
      },
    }));

    const { createTestCaller } = await import("./utils/trpc");
    caller = await createTestCaller({
      scopes: ["workflow.execute"],
    });

    (
      globalThis as unknown as {
        __approve?: {
          setSnapshot: (
            runId: string,
            snapshot: PipelineSnapshot | null
          ) => void;
          planRepo: typeof planRepo;
          workflowRepo: typeof workflowRepo;
        };
      }
    ).__approve = {
      setSnapshot: (runId, snapshot) => {
        snapshotByRunId.set(runId, snapshot);
      },
      planRepo,
      workflowRepo,
    };
  });

  it("approves existing plan and marks run as running", async () => {
    const harness = (globalThis as unknown as { __approve: any }).__approve as {
      setSnapshot: (runId: string, snapshot: PipelineSnapshot | null) => void;
      planRepo: {
        getPlanById: ReturnType<typeof mock>;
        createPlan: ReturnType<typeof mock>;
        updatePlanStatus: ReturnType<typeof mock>;
      };
      workflowRepo: { updateRun: ReturnType<typeof mock> };
    };

    harness.setSnapshot(
      "run-1",
      baseSnapshot({
        runId: "run-1",
        contextEntries: [
          [
            "planOutput",
            {
              planId: "plan-1",
              structuredPlan: {
                id: "plan-1",
                title: "Test plan",
                intent: "test requirement",
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

    const res = await caller.workflow.phase.approveAndExecute({
      runId: "run-1",
    });
    expect(res).toEqual({ runId: "run-1", planId: "plan-1" });

    expect(harness.planRepo.getPlanById).toHaveBeenCalled();
    expect(harness.planRepo.createPlan).toHaveBeenCalled();
    expect(harness.planRepo.updatePlanStatus).toHaveBeenCalledWith(
      "plan-1",
      "approved",
      "test-user"
    );
    expect(harness.workflowRepo.updateRun).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when snapshot is missing", async () => {
    const harness = (globalThis as unknown as { __approve: any }).__approve as {
      setSnapshot: (runId: string, snapshot: PipelineSnapshot | null) => void;
    };
    harness.setSnapshot("missing", null);
    await expect(
      caller.workflow.phase.approveAndExecute({ runId: "missing" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "snapshot_not_found",
    });
  });

  it("throws BAD_REQUEST when planId is missing", async () => {
    const harness = (globalThis as unknown as { __approve: any }).__approve as {
      setSnapshot: (runId: string, snapshot: PipelineSnapshot | null) => void;
    };
    harness.setSnapshot(
      "run-2",
      baseSnapshot({
        runId: "run-2",
        contextEntries: [["planOutput", { structuredPlan: {} }]],
      })
    );
    await expect(
      caller.workflow.phase.approveAndExecute({ runId: "run-2" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "plan_not_ready",
    });
  });
});
