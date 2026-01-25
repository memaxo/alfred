import { beforeEach, describe, expect, it, spyOn } from "bun:test";

import { evaluatePlanDeterministic } from "../evaluate/verify.js";

describe("Deterministic Plan Evaluation", () => {
  const mockSpawn = spyOn(Bun, "spawn");

  const mockPlan = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Test Plan",
    intent: "Test intent",
    workspace: "/test/workspace",
    phases: [
      {
        id: "p1",
        name: "Phase 1",
        description: "Desc",
        agentType: "codex" as const,
        estimatedDurationMs: 1000,
        dependsOn: [],
        tasks: [
          {
            id: "T1",
            title: "Task 1",
            requirement: "req",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
      },
    ],
    resources: {
      agentCount: 1,
      strategy: "parallel" as const,
      isolation: "agentfs" as const,
    },
    evaluationCriteria: [],
  };

  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it("should pass evaluation if checks succeed", async () => {
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(0),
      stdout: new Response("Success").body,
      stderr: new Response("").body,
      exitCode: 0,
    } as any);

    const result = await evaluatePlanDeterministic(mockPlan, {
      checks: ["lint"],
    });

    expect(result.selected).toBe(true);
    expect(result.aggregateScore).toBeGreaterThan(0);
    expect(
      result.scores.some((s) => s.criterion === "checks" && s.score === 1)
    ).toBe(true);
  });

  it("should fail evaluation if checks fail", async () => {
    mockSpawn.mockReturnValue({
      exited: Promise.resolve(1),
      stdout: new Response("").body,
      stderr: new Response("Error").body,
      exitCode: 1,
    } as any);

    const result = await evaluatePlanDeterministic(mockPlan, {
      checks: ["typecheck"],
    });

    expect(result.selected).toBe(false);
    expect(result.aggregateScore).toBe(0);
    expect(
      result.scores.some((s) => s.criterion === "checks" && s.score === 0)
    ).toBe(true);
  });

  it("should fail if budget is exceeded", async () => {
    const hugePlan = {
      ...mockPlan,
      phases: [
        {
          ...mockPlan.phases[0],
          estimatedDurationMs: 100 * 24 * 60 * 60 * 1000, // 100 days
        },
      ],
    };

    const result = await evaluatePlanDeterministic(hugePlan);

    expect(result.selected).toBe(false);
    expect(result.scores[0].judge).toBe("budget");
  });
});
