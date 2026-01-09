import { beforeEach, describe, expect, it, mock } from "bun:test";

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

const { buildDependencyGraph } = await import("../generate/dependencies.js");
const { groupIntoPhases } = await import("../generate/group.js");
const { generatePlan } = await import("../generate/phased.js");

describe("Plan Generation", () => {
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
      existingCode: ["src/components/Theme.tsx"],
      patterns: [],
      conventions: [],
    },
    metadata: {
      totalSources: 1,
      tokenCount: 100,
      researchDurationMs: 50,
    },
  };

  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should group subtasks into logical phases", () => {
    const subtasks = [
      {
        id: "T1",
        title: "Setup theme colors",
        requirement: "setup",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "T2",
        title: "Create DB migration",
        requirement: "db",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "T3",
        title: "Implement API",
        requirement: "api",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "T4",
        title: "Add UI toggle",
        requirement: "ui",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "T5",
        title: "Write tests",
        requirement: "test",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
    ];

    const groups = groupIntoPhases(subtasks, {
      maxPhases: 5,
      preferParallel: true,
    });

    expect(groups.length).toBe(5);
    expect(groups[0].name).toBe("Environment Setup");
    expect(groups[1].name).toBe("Data Architecture");
    expect(groups[2].name).toBe("Logic & API");
    expect(groups[3].name).toBe("User Interface");
    expect(groups[4].name).toBe("Testing & Validation");
  });

  it("should build dependency graph between phases", () => {
    const phases = [
      {
        id: "p1",
        name: "Setup",
        description: "",
        agentType: "codex" as const,
        estimatedDurationMs: 0,
        dependsOn: [],
        tasks: [
          {
            id: "T1",
            title: "T1",
            requirement: "",
            deps: [],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
      },
      {
        id: "p2",
        name: "UI",
        description: "",
        agentType: "codex" as const,
        estimatedDurationMs: 0,
        dependsOn: [],
        tasks: [
          {
            id: "T2",
            title: "T2",
            requirement: "",
            deps: ["T1"],
            priority: 1,
            acceptance: [],
            filesHint: [],
          },
        ],
      },
    ];

    const withDeps = buildDependencyGraph(phases);
    expect(withDeps[1].dependsOn).toContain("p1");
  });

  it("should generate a full StructuredPlan", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        phases: [
          {
            id: "phase-1",
            name: "Logic & API",
            description: "Update server-side logic",
            dependsOn: [],
            estimatedDurationMs: 60_000,
            agentType: "codex",
            tasks: [],
          },
          {
            id: "phase-2",
            name: "User Interface",
            description: "Update UI components",
            dependsOn: ["phase-1"],
            estimatedDurationMs: 60_000,
            agentType: "codex",
            tasks: [],
          },
          {
            id: "phase-3",
            name: "Testing & Validation",
            description: "Add/adjust tests",
            dependsOn: ["phase-1", "phase-2"],
            estimatedDurationMs: 60_000,
            agentType: "codex",
            tasks: [],
          },
        ],
        resources: {
          agentCount: 2,
          strategy: "sequential",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      },
    });

    const research = {
      ...mockResearch,
      internal: {
        ...mockResearch.internal,
        existingCode: [
          "packages/api/src/routers/plan.ts",
          "apps/web/src/components/Theme.tsx",
          "packages/plan/src/__tests__/plan-generation.test.ts",
        ],
      },
    };

    const plan = await generatePlan(mockIntent, research as any);

    expect(plan.id).toBeDefined();
    expect(plan.phases.length).toBe(3);
    expect(plan.phases[0].name).toBe("Logic & API");
    expect(plan.phases[1].dependsOn).toContain("phase-1");
    expect(plan.phases[2].dependsOn).toContain("phase-1");
    expect(plan.phases[2].dependsOn).toContain("phase-2");
    expect(plan.resources.strategy).toBe("sequential");
  });
});
