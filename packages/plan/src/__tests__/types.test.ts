import { describe, expect, it } from "bun:test";

import { structuredPlanSchema } from "../schema.js";

describe("@alfred/plan core types", () => {
  it("should validate a minimal valid StructuredPlan", () => {
    const validPlan = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Plan",
      intent: "Test Intent",
      phases: [
        {
          id: "phase-1",
          name: "Design",
          description: "Design phase",
          tasks: [],
          dependsOn: [],
          estimatedDurationMs: 1000,
          agentType: "codex",
        },
      ],
      resources: {
        agentCount: 1,
        strategy: "sequential",
        isolation: "agentfs",
      },
      evaluationCriteria: [
        {
          name: "Completeness",
          weight: 1,
          threshold: "0.8",
        },
      ],
    };

    const result = structuredPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("should fail to validate a plan with an invalid agentType", () => {
    const invalidPlan = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Plan",
      intent: "Test Intent",
      phases: [
        {
          id: "phase-1",
          name: "Design",
          description: "Design phase",
          tasks: [],
          dependsOn: [],
          estimatedDurationMs: 1000,
          agentType: "invalid-agent", // Invalid enum value
        },
      ],
      resources: {
        agentCount: 1,
        strategy: "sequential",
        isolation: "agentfs",
      },
      evaluationCriteria: [],
    };

    const result = structuredPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      if (issue) {
        expect(issue.path).toContain("agentType");
      }
    }
  });
});
