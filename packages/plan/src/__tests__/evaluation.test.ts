import { describe, expect, it, mock } from "bun:test";

import type { StructuredPlan } from "../types.js";

import { evaluatePlanDeterministic } from "../evaluate/verify.js";

describe("evaluatePlanDeterministic", () => {
  it("should return zero score when budget checks fail", async () => {
    const plan: StructuredPlan = {
      id: "plan-1",
      title: "Test Plan",
      intent: "Test",
      phases: [
        {
          id: "phase-1",
          name: "Phase that exceeds 24 hour duration",
          description: "Very long phase",
          tasks: [],
          dependsOn: [],
          estimatedDurationMs: 25 * 60 * 60 * 1000, // 25 hours > 24 hour limit
          agentType: "codex",
        },
      ],
      resources: {
        agentCount: 10,
        strategy: "sequential",
        isolation: "agentfs",
      },
      evaluationCriteria: [],
    };

    const result = await evaluatePlanDeterministic(plan);

    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].judge).toBe("budget");
    expect(result.scores[0].criterion).toBe("enforcement");
    expect(result.scores[0].score).toBe(0);
    expect(result.aggregateScore).toBe(0);
    expect(result.selected).toBe(false);
  });

  it("should return zero score when verification fails", async () => {
    const plan: StructuredPlan = {
      id: "plan-2",
      title: "Test Plan",
      intent: "Test",
      phases: [
        {
          id: "phase-1",
          name: "Phase 1",
          description: "Description",
          tasks: [],
          dependsOn: [],
          estimatedDurationMs: 60_000,
          agentType: "codex",
        },
      ],
      resources: {
        agentCount: 1,
        strategy: "sequential",
        isolation: "agentfs",
      },
      evaluationCriteria: [],
    };

    const mockEnforceBudgets = mock(() => ({ success: true }));
    const mockRunCheck = mock(async () => ({
      success: false,
      output: "failed",
    }));

    mock.module("../evaluate/budget.js", () => ({
      enforceBudgets: mockEnforceBudgets,
    }));

    mock.module("../evaluate/checks.js", () => ({
      runCheck: mockRunCheck,
    }));

    const result = await evaluatePlanDeterministic(plan, {
      checks: ["typecheck"],
    });

    expect(result.scores[0].judge).toBe("verification");
    expect(result.scores[0].criterion).toBe("checks");
    expect(result.scores[0].score).toBe(0);
    expect(result.aggregateScore).toBe(0);
    expect(result.selected).toBe(false);
  });

  it("should return rubric score when verification passes", async () => {
    const plan: StructuredPlan = {
      id: "plan-3",
      title: "Test Plan",
      intent: "Test",
      phases: [
        {
          id: "phase-1",
          name: "Phase 1",
          description: "Description",
          tasks: [
            {
              id: "task-1",
              title: "Task 1",
              requirement: "Do X",
              deps: [],
              priority: 1,
              acceptance: ["X is done"],
              filesHint: [],
            },
          ],
          dependsOn: [],
          estimatedDurationMs: 60_000,
          agentType: "codex",
        },
      ],
      resources: {
        agentCount: 1,
        strategy: "sequential",
        isolation: "agentfs",
      },
      evaluationCriteria: [],
    };

    const mockEnforceBudgets = mock(() => ({ success: true }));
    const mockRunCheck = mock(async () => ({
      success: true,
      output: "passed",
    }));
    const mockApplyRubric = mock(async () => 0.85);

    mock.module("../evaluate/budget.js", () => ({
      enforceBudgets: mockEnforceBudgets,
    }));

    mock.module("../evaluate/checks.js", () => ({
      runCheck: mockRunCheck,
    }));

    mock.module("../evaluate/rubric.js", () => ({
      applyRubric: mockApplyRubric,
      defaultRubric: {
        criteria: [],
      },
    }));

    const result = await evaluatePlanDeterministic(plan, {
      checks: ["typecheck"],
    });

    expect(result.scores).toHaveLength(2);
    expect(result.scores[0].judge).toBe("verification");
    expect(result.scores[0].score).toBe(1);
    expect(result.scores[1].judge).toBe("rubric");
    expect(result.scores[1].score).toBe(0.85);
    expect(result.aggregateScore).toBe(0.85);
    expect(result.selected).toBe(true);
  });
});
