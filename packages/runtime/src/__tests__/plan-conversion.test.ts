import { describe, expect, it } from "bun:test";
import type { Phase, StructuredPlan } from "@alfred/plan";
import { convertPlanToWavePlan } from "../orchestrator/convert.js";
import { buildDependencyMap } from "../orchestrator/dependencies.js";
import { flattenPhases } from "../orchestrator/flatten.js";

describe("Plan → WavePlan Conversion", () => {
  const mockSubTask = (id: string, deps: string[] = []) => ({
    id,
    title: `Task ${id}`,
    requirement: `Requirement for ${id}`,
    deps,
    priority: 1,
    acceptance: ["Done"],
    filesHint: [],
  });

  const mockPhase = (
    id: string,
    tasks: any[],
    dependsOn: string[] = [],
    agentType: any = "codex"
  ): Phase => ({
    id,
    name: `Phase ${id}`,
    description: `Description for ${id}`,
    tasks,
    dependsOn,
    estimatedDurationMs: 1000,
    agentType,
  });

  const mockPlan = (phases: Phase[]): StructuredPlan => ({
    id: "test-plan",
    title: "Test Plan",
    intent: "Test Intent",
    phases,
    resources: {
      agentCount: 2,
      strategy: "parallel",
      isolation: "container",
    },
    evaluationCriteria: [],
  });

  it("should flatten phases while preserving metadata", () => {
    const phases = [
      mockPhase("A", [mockSubTask("T1")], [], "research"),
      mockPhase("B", [mockSubTask("T2")], ["A"], "codex"),
    ];

    const flattened = flattenPhases(phases);

    expect(flattened).toHaveLength(2);
    expect(flattened[0]?.id).toBe("T1");
    expect(flattened[0]?.metadata?.phaseId).toBe("A");
    expect(flattened[0]?.metadata?.agentType).toBe("research");
    expect(flattened[1]?.id).toBe("T2");
    expect(flattened[1]?.metadata?.phaseId).toBe("B");
    expect(flattened[1]?.metadata?.agentType).toBe("codex");
  });

  it("should build dependency map from phase dependencies", () => {
    const phases = [
      mockPhase("A", [mockSubTask("T1"), mockSubTask("T2")]),
      mockPhase("B", [mockSubTask("T3")], ["A"]),
    ];

    const depMap = buildDependencyMap(phases);

    expect(depMap.get("T1")).toEqual([]);
    expect(depMap.get("T2")).toEqual([]);
    expect(depMap.get("T3") ?? []).toContain("T1");
    expect(depMap.get("T3") ?? []).toContain("T2");
  });

  it("should convert simple plan to wave plan", () => {
    const phases = [
      mockPhase("A", [mockSubTask("T1"), mockSubTask("T2")], [], "research"),
    ];
    const plan = mockPlan(phases);

    const waves = convertPlanToWavePlan(plan);

    expect(waves).toHaveLength(1);
    expect(waves[0]?.agents).toContain("T1");
    expect(waves[0]?.agents).toContain("T2");
    expect(waves[0]?.agentType).toBe("research");
    expect(waves[0]?.isolation).toBe("container");
  });

  it("should respect phase dependencies in wave planning", () => {
    const phases = [
      mockPhase("A", [mockSubTask("T1")], [], "research"),
      mockPhase("B", [mockSubTask("T2")], ["A"], "codex"),
    ];
    const plan = mockPlan(phases);

    const waves = convertPlanToWavePlan(plan);

    expect(waves).toHaveLength(2);
    expect(waves[0]?.agents).toEqual(["T1"]);
    expect(waves[0]?.agentType).toBe("research");
    expect(waves[1]?.agents).toEqual(["T2"]);
    expect(waves[1]?.agentType).toBe("codex");
    expect(waves[1]?.dependsOn ?? []).toContain(waves[0]?.id ?? "");
  });
});
