import type { PipelineSnapshot } from "@alfred/pipeline";

import { beforeAll, describe, expect, it, mock } from "bun:test";

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

describe("workflow.phase.getPlan", () => {
  let caller: Caller;
  let snapshotByRunId = new Map<string, PipelineSnapshot | null>();

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

    const { createTestCaller } = await import("./utils/trpc");
    caller = await createTestCaller({
      scopes: ["workflow.execute"],
    });
  });

  it("returns PlanPhaseOutput and normalizes execPlans (record)", async () => {
    snapshotByRunId = new Map([
      [
        "run-1",
        baseSnapshot({
          contextEntries: [
            [
              "scheduleOutput",
              {
                waves: [{ id: "wave-0", agents: ["t1"], dependsOn: [] }],
                executionMode: "sequential",
                estimatedDuration: 1,
              },
            ],
            [
              "planOutput",
              {
                planId: "plan-1",
                structuredPlan: {
                  id: "plan-1",
                  title: "Test plan",
                  intent: "test requirement",
                  workspace: "/workspace",
                  phases: [],
                  resources: {
                    agentCount: 1,
                    strategy: "sequential",
                    isolation: "agentfs",
                  },
                  evaluationCriteria: [],
                },
                subtasks: [
                  {
                    id: "t1",
                    title: "Task 1",
                    requirement: "Do thing",
                    deps: [],
                    priority: 1,
                    acceptance: [],
                    filesHint: [],
                  },
                ],
                execPlans: { t1: "/p/t1.md" },
                rootPlanPath: "/workspace/.agent/plans/run-1/root.md",
              },
            ],
          ],
        }),
      ],
    ]);

    const res = await caller.workflow.phase.getPlan({ runId: "run-1" });
    expect(res.runId).toBe("run-1");
    expect(res.waveCount).toBe(res.waves.length);
    expect(res.execPlans).toEqual({ t1: "/p/t1.md" });
  });

  it("normalizes execPlans (tuple array)", async () => {
    snapshotByRunId = new Map([
      [
        "run-2",
        baseSnapshot({
          runId: "run-2",
          contextEntries: [
            [
              "scheduleOutput",
              {
                waves: [{ id: "wave-0", agents: ["t1"], dependsOn: [] }],
                executionMode: "sequential",
                estimatedDuration: 1,
              },
            ],
            [
              "planOutput",
              {
                planId: "plan-2",
                structuredPlan: {
                  id: "plan-2",
                  title: "Test plan",
                  intent: "test requirement",
                  workspace: "/workspace",
                  phases: [],
                  resources: {
                    agentCount: 1,
                    strategy: "sequential",
                    isolation: "agentfs",
                  },
                  evaluationCriteria: [],
                },
                subtasks: [
                  {
                    id: "t1",
                    title: "Task 1",
                    requirement: "Do thing",
                    deps: [],
                    priority: 1,
                    acceptance: [],
                    filesHint: [],
                  },
                ],
                execPlans: [["t1", "/p/t1.md"]],
                rootPlanPath: "/workspace/.agent/plans/run-2/root.md",
              },
            ],
          ],
        }),
      ],
    ]);

    const res = await caller.workflow.phase.getPlan({ runId: "run-2" });
    expect(res.execPlans).toEqual({ t1: "/p/t1.md" });
  });

  it("throws NOT_FOUND when snapshot is missing", async () => {
    snapshotByRunId = new Map([["missing", null]]);
    await expect(
      caller.workflow.phase.getPlan({ runId: "missing" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "snapshot_not_found",
    });
  });

  it("throws BAD_REQUEST when plan not ready", async () => {
    snapshotByRunId = new Map([
      [
        "run-3",
        baseSnapshot({
          runId: "run-3",
          contextEntries: [
            [
              "scheduleOutput",
              {
                waves: [{ id: "wave-0", agents: ["t1"], dependsOn: [] }],
                executionMode: "sequential",
                estimatedDuration: 1,
              },
            ],
          ],
        }),
      ],
    ]);

    await expect(
      caller.workflow.phase.getPlan({ runId: "run-3" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "plan_not_ready",
    });
  });
});
