import { beforeAll, describe, expect, it, mock } from "bun:test";

type Caller = Awaited<
  ReturnType<typeof import("./utils/trpc").createTestCaller>
>;
type UnauthedCaller = Awaited<
  ReturnType<typeof import("./utils/trpc").createUnauthedCaller>
>;

describe("workflow.phase.cachedPlan", () => {
  let caller: Caller;
  let unauthed: UnauthedCaller;
  let setCached: (v: unknown | null) => void;

  beforeAll(async () => {
    let cached: unknown | null = null;
    setCached = (v) => {
      cached = v;
    };

    mock.module("@alfred/pipeline/cache", () => ({
      computeFileTreeHash: async () => "treehash",
      getPlanCacheKey: () => "plan:cache:key",
      getCachedPlan: async () => cached,
    }));

    const { createTestCaller, createUnauthedCaller } = await import(
      "./utils/trpc"
    );
    caller = await createTestCaller({
      scopes: ["workflow.plan"],
    });
    unauthed = await createUnauthedCaller();
  });

  it("returns cached=false when cache miss", async () => {
    setCached(null);

    const res = await caller.workflow.phase.cachedPlan({
      runId: "run-1",
      requirement: "Do thing",
      workspace: "/repo",
      userId: "test-user",
    });

    expect(res.cacheKey).toBe("plan:cache:key");
    expect(res.cached).toBe(false);
    expect(res.plan).toBeNull();
  });

  it("returns cached=true with plan when cache hit", async () => {
    const plan = {
      runId: "run-1",
      planId: "plan-1",
      structuredPlan: {
        id: "plan-1",
        title: "Test plan",
        intent: "Do thing",
        workspace: "/repo",
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      },
      waves: [{ id: "wave-0", agents: ["t1"], dependsOn: [] }],
      waveCount: 1,
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
      executionMode: "sequential",
      estimatedDuration: 1,
      snapshot: {
        runId: "run-1",
        status: "suspended",
        requirement: "Do thing",
        lastCompletedStage: "schedule",
        lastCompletedStageIndex: 3,
        startedAt: 1,
        lastEventAt: 1,
        error: null,
      },
    };

    setCached(plan);

    const res = await caller.workflow.phase.cachedPlan({
      runId: "run-1",
      requirement: "Do thing",
      workspace: "/repo",
      userId: "test-user",
    });

    expect(res.cacheKey).toBe("plan:cache:key");
    expect(res.cached).toBe(true);
    expect(res.plan).toMatchObject({ runId: "run-1" });
  });

  it("requires session", async () => {
    await expect(
      unauthed.workflow.phase.cachedPlan({
        runId: "run-1",
        requirement: "Do thing",
        workspace: "/repo",
        userId: "test-user",
      })
    ).rejects.toMatchObject({ message: "Authentication required" });
  });
});
