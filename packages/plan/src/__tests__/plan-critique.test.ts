import { describe, expect, it, mock, beforeEach } from "bun:test";

// Mock AI SDK generateObject
const mockGenerateObject = mock();
mock.module("ai", () => ({
  generateObject: mockGenerateObject,
}));

// Mock @alfred/agent/v6
mock.module("@alfred/agent/v6", () => ({
  getOpenAI: () => () => ({}),
  getModelId: () => "gpt-4o",
}));

import { critiquePlan } from "../evaluate/critique.js";
import { validatePlan } from "../evaluate/validate.js";

describe("Plan Critique", () => {
  const mockIntent = {
    id: "intent-123",
    description: "Add dark mode toggle",
    userId: "user-123",
    source: "chat" as const,
    timestamp: new Date(),
    context: {
      existingPatterns: [],
      constraints: [],
    },
  };

  const mockResearch = {
    external: [],
    internal: {
      existingCode: [],
      patterns: [],
      conventions: [],
    },
    metadata: {
      totalSources: 0,
      tokenCount: 0,
      researchDurationMs: 0,
    },
  };

  const mockPlan = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Dark Mode Plan",
    intent: "Add dark mode toggle",
    phases: [
      {
        id: "phase-1",
        name: "Implementation",
        description: "Add styles",
        agentType: "codex" as const,
        estimatedDurationMs: 1000,
        dependsOn: [],
        tasks: [{ id: "T1", title: "Add CSS", requirement: "css", deps: [], priority: 1, acceptance: [], filesHint: [] }],
      },
    ],
    resources: {
      agentCount: 1,
      strategy: "parallel" as const,
      isolation: "container" as const,
    },
    evaluationCriteria: [],
  };

  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should validate a correct plan", () => {
    expect(validatePlan(mockPlan)).toBe(true);
  });

  it("should invalidate a plan with cycles", () => {
    const cyclicPlan = {
      ...mockPlan,
      phases: [
        { ...mockPlan.phases[0], id: "p1", dependsOn: ["p2"] },
        { ...mockPlan.phases[0], id: "p2", dependsOn: ["p1"] },
      ],
    };
    expect(validatePlan(cyclicPlan)).toBe(false);
  });

  it("should return early if no issues found", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        issues: [],
        overallScore: 0.95,
        strengths: ["Good plan"],
        weaknesses: [],
      },
    });

    const result = await critiquePlan(mockPlan, mockIntent, mockResearch);

    expect(result.iterations).toBe(0);
    expect(result.critique.overallScore).toBe(0.95);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("should perform revisions if issues are found", async () => {
    // First call: critique with issue
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        issues: [{ severity: "high", description: "Missing tests", suggestion: "Add a test phase" }],
        overallScore: 0.5,
        strengths: [],
        weaknesses: ["No testing"],
      },
    });

    // Second call: revised plan
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        ...mockPlan,
        phases: [
          ...mockPlan.phases,
          {
            id: "phase-2",
            name: "Testing",
            description: "Add tests",
            agentType: "codex" as const,
            estimatedDurationMs: 500,
            dependsOn: ["phase-1"],
            tasks: [{ id: "T2", title: "Unit test", requirement: "test", deps: [], priority: 1, acceptance: [], filesHint: [] }],
          },
        ],
      },
    });

    // Third call: final critique (perfect score)
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        issues: [],
        overallScore: 1.0,
        strengths: ["Added testing"],
        weaknesses: [],
      },
    });

    const result = await critiquePlan(mockPlan, mockIntent, mockResearch, { maxRevisions: 1 });

    expect(result.iterations).toBe(1);
    expect(result.revisedPlan?.phases.length).toBe(2);
    expect(result.critique.overallScore).toBe(1.0);
    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });
});
