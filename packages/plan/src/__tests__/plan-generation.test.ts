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

// Mock @alfred/agent/orchestrator/multi/decompose
const mockDecomposeTask = mock();
mock.module("@alfred/agent/orchestrator/multi/decompose", () => ({
  decomposeTask: mockDecomposeTask,
}));

import { generatePlan } from "../generate/phased.js";
import { groupIntoPhases } from "../generate/group.js";
import { buildDependencyGraph } from "../generate/dependencies.js";

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
    mockDecomposeTask.mockReset();
  });

  it("should group subtasks into logical phases", () => {
    const subtasks = [
      { id: "T1", title: "Setup theme colors", requirement: "setup", deps: [], priority: 1, acceptance: [], filesHint: [] },
      { id: "T2", title: "Create DB migration", requirement: "db", deps: [], priority: 1, acceptance: [], filesHint: [] },
      { id: "T3", title: "Implement API", requirement: "api", deps: [], priority: 1, acceptance: [], filesHint: [] },
      { id: "T4", title: "Add UI toggle", requirement: "ui", deps: [], priority: 1, acceptance: [], filesHint: [] },
      { id: "T5", title: "Write tests", requirement: "test", deps: [], priority: 1, acceptance: [], filesHint: [] },
    ];

    const groups = groupIntoPhases(subtasks, { maxPhases: 5, preferParallel: true });
    
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
        id: "p1", name: "Setup", description: "", agentType: "codex" as const, estimatedDurationMs: 0, dependsOn: [],
        tasks: [{ id: "T1", title: "T1", requirement: "", deps: [], priority: 1, acceptance: [], filesHint: [] }]
      },
      {
        id: "p2", name: "UI", description: "", agentType: "codex" as const, estimatedDurationMs: 0, dependsOn: [],
        tasks: [{ id: "T2", title: "T2", requirement: "", deps: ["T1"], priority: 1, acceptance: [], filesHint: [] }]
      }
    ];

    const withDeps = buildDependencyGraph(phases);
    expect(withDeps[1].dependsOn).toContain("p1");
  });

  it("should generate a full StructuredPlan", async () => {
    mockDecomposeTask.mockResolvedValue([
      { id: "T1", title: "Setup", requirement: "setup", deps: [], priority: 1, acceptance: [], filesHint: [] },
      { id: "T2", title: "Test", requirement: "test", deps: ["T1"], priority: 1, acceptance: [], filesHint: [] },
    ]);

    mockGenerateObject.mockResolvedValue({
      object: {
        phases: [
          { name: "Environment Setup", description: "Set up the environment" },
          { name: "Validation", description: "Validate changes" },
        ],
      },
    });

    const plan = await generatePlan(mockIntent, mockResearch);

    expect(plan.id).toBeDefined();
    expect(plan.phases.length).toBe(2);
    expect(plan.phases[0].name).toBe("Environment Setup");
    expect(plan.phases[1].dependsOn).toContain("phase-1");
    expect(plan.resources.strategy).toBe("sequential");
  });
});
