import { beforeAll, describe, expect, it, mock } from "bun:test";

import type { PipelineSnapshot } from "@alfred/pipeline";

let caller: Awaited<ReturnType<typeof import("./utils/trpc").createTestCaller>>;
let resumed = false;
let lastSaved: PipelineSnapshot | null = null;
let snapshotOverride: PipelineSnapshot | null = null;

describe("workflow.phase gap closure", () => {
  beforeAll(async () => {
    mock.module("@alfred/db/repo/workflow", () => ({
      PostgresCheckpointStorage: class PostgresCheckpointStorage {
        save(_runId: string, snapshot: unknown): Promise<void> {
          lastSaved = snapshot as PipelineSnapshot;
          return Promise.resolve();
        }

        load(_runId: string): Promise<unknown | null> {
          if (snapshotOverride) {
            return Promise.resolve(snapshotOverride);
          }
          const base: PipelineSnapshot = {
            runId: "run-1",
            status: resumed ? "completed" : "suspended",
            requirement: "test requirement",
            lastCompletedStage: "schedule",
            lastCompletedStageIndex: 3,
            contextEntries: [
              [
                "scheduleOutput",
                {
                  waves: [
                    { id: "wave-0", agents: ["a"], dependsOn: [] },
                    { id: "wave-1", agents: ["b"], dependsOn: ["wave-0"] },
                    { id: "wave-2", agents: ["c"], dependsOn: ["wave-1"] },
                  ],
                  executionMode: "sequential",
                  estimatedDuration: 1,
                },
              ],
              [
                "planOutput",
                {
                  subtasks: [],
                  execPlans: {},
                  rootPlanPath: "/workspace/.agent/plans/run-1/root.md",
                },
              ],
            ],
            stageResults: [],
            startedAt: 1,
            lastEventAt: 1,
            lastEventId: null,
            error: null,
          };

          return Promise.resolve(lastSaved ?? base);
        }
      },
    }));

    mock.module("@alfred/pipeline", () => ({
      PipelineRunner: class PipelineRunner {
        addObserver(): void {}
        async *resume(): AsyncGenerator<unknown, void, void> {
          resumed = true;
          await Promise.resolve();
          yield* [];
        }
      },
      registerDefaultStages(): void {},
    }));

    mock.module("@alfred/pipeline/observers", () => ({
      CheckpointObserver: class CheckpointObserver {},
      CostCleanupObserver: class CostCleanupObserver {},
      InMemoryCheckpointStorage: class InMemoryCheckpointStorage {},
      MetricsObserver: class MetricsObserver {},
      LinearSyncObserver: class LinearSyncObserver {},
      PipelineEventQueueObserver: class PipelineEventQueueObserver {},
    }));

    mock.module("@alfred/pipeline/metrics", () => ({
      phaseExecuteRequestsTotal: { inc: () => {} },
      phaseExecuteDurationSeconds: { observe: () => {} },
    }));

    const { createTestCaller } = await import("./utils/trpc");
    caller = await createTestCaller({
      scopes: ["workflow.execute"],
    });
  });

  it("executeByRunId auto-includes prerequisite waves", async () => {
    resumed = false;
    lastSaved = null;
    snapshotOverride = null;

    const res = await caller.workflow.phase.executeByRunId({
      runId: "run-1",
      waveIds: ["wave-1"],
      dryRun: true,
    });

    expect(res.runId).toBe("run-1");

    expect(lastSaved).not.toBeNull();
    const ctx = new Map(
      (lastSaved?.contextEntries ?? []) as [string, unknown][]
    );
    const waveIds = ctx.get("waveIds") as string[] | undefined;
    expect(waveIds).toBeDefined();
    expect(waveIds).toContain("wave-0");
    expect(waveIds).toContain("wave-1");
  });

  it("executeByRunId expands transitive prerequisites", async () => {
    resumed = false;
    lastSaved = null;
    snapshotOverride = null;

    await caller.workflow.phase.executeByRunId({
      runId: "run-1",
      waveIds: ["wave-2"],
      dryRun: true,
    });

    expect(lastSaved).not.toBeNull();
    const ctx = new Map(
      (lastSaved?.contextEntries ?? []) as [string, unknown][]
    );
    const waveIds = ctx.get("waveIds") as string[] | undefined;
    expect(waveIds).toContain("wave-0");
    expect(waveIds).toContain("wave-1");
    expect(waveIds).toContain("wave-2");
  });

  it("executeByRunId persists skipTaskIds and dryRun", async () => {
    resumed = false;
    lastSaved = null;
    snapshotOverride = null;

    await caller.workflow.phase.executeByRunId({
      runId: "run-1",
      skipTaskIds: ["a"],
      dryRun: true,
    });

    expect(lastSaved).not.toBeNull();
    const ctx = new Map(
      (lastSaved?.contextEntries ?? []) as [string, unknown][]
    );
    expect(ctx.get("skipTaskIds")).toEqual(["a"]);
    expect(ctx.get("dryRun")).toBe(true);
  });

  it("executeByRunId rejects when rootPlanPath missing", async () => {
    resumed = false;
    lastSaved = null;
    snapshotOverride = {
      runId: "run-1",
      status: "suspended",
      requirement: "test requirement",
      lastCompletedStage: "schedule",
      lastCompletedStageIndex: 3,
      contextEntries: [
        [
          "scheduleOutput",
          {
            waves: [{ id: "wave-0", agents: ["a"], dependsOn: [] }],
            executionMode: "sequential",
            estimatedDuration: 1,
          },
        ],
        ["planOutput", { subtasks: [], execPlans: {} }],
      ],
      stageResults: [],
      startedAt: 1,
      lastEventAt: 1,
      lastEventId: null,
      error: null,
    };

    await expect(
      caller.workflow.phase.executeByRunId({ runId: "run-1", dryRun: true })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "plan_not_ready",
    });
  });
});
