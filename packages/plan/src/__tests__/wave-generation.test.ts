import { describe, expect, it } from "bun:test";
import {
  attachWaves,
  planToWaves,
  validateWaveDependencies,
} from "../generate/waves.js";
import type { StructuredPlan } from "../types.js";

describe("Wave Generation", () => {
  const mockPlan: StructuredPlan = {
    id: "plan-1",
    title: "Test Plan",
    intent: "Test intent",
    phases: [
      {
        id: "phase-1",
        name: "Phase 1",
        description: "First phase",
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            requirement: "Do task 1",
            deps: [],
            priority: 1,
            acceptance: ["done"],
            filesHint: [],
          },
        ],
        dependsOn: [],
        estimatedDurationMs: 1000,
        agentType: "codex",
      },
      {
        id: "phase-2",
        name: "Phase 2",
        description: "Second phase",
        tasks: [
          {
            id: "task-2",
            title: "Task 2",
            requirement: "Do task 2",
            deps: [],
            priority: 1,
            acceptance: ["done"],
            filesHint: [],
          },
        ],
        dependsOn: ["phase-1"],
        estimatedDurationMs: 1000,
        agentType: "droid",
      },
      {
        id: "phase-3",
        name: "Phase 3",
        description: "Third phase",
        tasks: [
          {
            id: "task-3",
            title: "Task 3",
            requirement: "Do task 3",
            deps: [],
            priority: 1,
            acceptance: ["done"],
            filesHint: [],
          },
        ],
        dependsOn: [],
        estimatedDurationMs: 1000,
        agentType: "review",
      },
    ],
    resources: {
      agentCount: 3,
      strategy: "mixed",
      isolation: "agentfs",
    },
    evaluationCriteria: [],
  };

  describe("planToWaves - Sequential", () => {
    it("generates sequential waves", () => {
      const plan = {
        ...mockPlan,
        resources: { ...mockPlan.resources, strategy: "sequential" as const },
      };
      const waves = planToWaves(plan);

      expect(waves).toHaveLength(3);
      expect(waves[0]?.id).toBe("wave-phase-1");
      expect(waves[0]?.agents).toEqual(["task-1"]);
    });
  });

  describe("planToWaves - Parallel", () => {
    it("generates parallel waves grouped by agent type", () => {
      const plan = {
        ...mockPlan,
        resources: { ...mockPlan.resources, strategy: "parallel" as const },
      };
      const waves = planToWaves(plan);

      expect(waves.length).toBeGreaterThan(0);
      const rootWave = waves[0];
      expect(rootWave).toBeDefined();
      expect(rootWave?.dependsOn).toEqual([]);
    });
  });

  describe("planToWaves - Topological", () => {
    it("respects phase dependencies", () => {
      const plan = {
        ...mockPlan,
        resources: { ...mockPlan.resources, strategy: "topological" as const },
      };
      const waves = planToWaves(plan);

      expect(waves.length).toBeGreaterThan(0);
      const phase1Wave = waves.find((w) => w.phaseId === "phase-1");
      expect(phase1Wave).toBeDefined();
    });
  });

  describe("planToWaves - Mixed", () => {
    it("generates mixed strategy waves", () => {
      const plan = {
        ...mockPlan,
        resources: { ...mockPlan.resources, strategy: "mixed" as const },
      };
      const waves = planToWaves(plan);

      expect(waves.length).toBeGreaterThan(0);
      const phaseIds = new Set(waves.map((w) => w.phaseId));
      expect(phaseIds.has("phase-1")).toBe(true);
    });
  });

  describe("attachWaves", () => {
    it("attaches waves to plan without mutating original", () => {
      const originalPhases = [...mockPlan.phases];
      const result = attachWaves(mockPlan);

      expect(result).toHaveProperty("waves");
      expect(Array.isArray(result.waves)).toBe(true);
      expect(result.waves?.length).toBeGreaterThan(0);

      expect(mockPlan.waves).toBeUndefined();
      expect(mockPlan.phases).toEqual(originalPhases);
    });

    it("sets phaseId on waves", () => {
      const result = attachWaves(mockPlan);

      if (!result.waves) {
        throw new Error("Waves not generated");
      }

      result.waves.forEach((wave) => {
        if (wave.phaseId) {
          const phase = mockPlan.phases.find((p) => p.id === wave.phaseId);
          expect(phase).toBeDefined();
        }
      });
    });

    it("sets isolation on waves", () => {
      const result = attachWaves(mockPlan);

      if (!result.waves) {
        throw new Error("Waves not generated");
      }

      result.waves.forEach((wave) => {
        if (wave.isolation) {
          expect(wave.isolation).toBe("agentfs");
        }
      });
    });
  });

  describe("validateWaveDependencies", () => {
    it("returns valid for properly formed waves", () => {
      const result = attachWaves(mockPlan);
      const validation = validateWaveDependencies(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it("returns invalid for waves with circular dependencies", () => {
      const waveWithCycle: StructuredPlan = {
        ...mockPlan,
        waves: [
          {
            id: "wave-1",
            agents: ["task-1"],
            dependsOn: ["wave-2"],
            phaseId: "phase-1",
          },
          {
            id: "wave-2",
            agents: ["task-2"],
            dependsOn: ["wave-1"],
            phaseId: "phase-2",
          },
        ],
      };

      const validation = validateWaveDependencies(waveWithCycle);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("returns invalid when waves are empty", () => {
      const planWithoutWaves: StructuredPlan = {
        ...mockPlan,
        waves: [],
      };

      const validation = validateWaveDependencies(planWithoutWaves);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("No waves generated");
    });

    it("returns invalid for undefined waves", () => {
      const planWithoutWaves: StructuredPlan = {
        ...mockPlan,
        waves: undefined,
      };

      const validation = validateWaveDependencies(planWithoutWaves);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("No waves generated");
    });
  });

  describe("Complex Scenarios", () => {
    it("handles multi-level dependency chain", () => {
      const complexPlan: StructuredPlan = {
        id: "plan-complex",
        title: "Complex Plan",
        intent: "Test multi-level deps",
        phases: [
          {
            id: "phase-a",
            name: "Phase A",
            description: "Root",
            tasks: [
              {
                id: "task-a",
                title: "Task A",
                requirement: "Do A",
                deps: [],
                priority: 1,
                acceptance: ["done"],
                filesHint: [],
              },
            ],
            dependsOn: [],
            estimatedDurationMs: 1000,
            agentType: "codex",
          },
          {
            id: "phase-b",
            name: "Phase B",
            description: "Depends on A",
            tasks: [
              {
                id: "task-b",
                title: "Task B",
                requirement: "Do B",
                deps: [],
                priority: 1,
                acceptance: ["done"],
                filesHint: [],
              },
            ],
            dependsOn: ["phase-a"],
            estimatedDurationMs: 1000,
            agentType: "droid",
          },
          {
            id: "phase-c",
            name: "Phase C",
            description: "Depends on B",
            tasks: [
              {
                id: "task-c",
                title: "Task C",
                requirement: "Do C",
                deps: [],
                priority: 1,
                acceptance: ["done"],
                filesHint: [],
              },
            ],
            dependsOn: ["phase-b"],
            estimatedDurationMs: 1000,
            agentType: "review",
          },
        ],
        resources: {
          agentCount: 3,
          strategy: "topological",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      };

      const waves = planToWaves(complexPlan);

      expect(waves.length).toBe(3);
      const waveA = waves.find((w) => w.phaseId === "phase-a");
      expect(waveA).toBeDefined();
    });

    it("handles multiple parallel roots with different agent types", () => {
      const parallelPlan: StructuredPlan = {
        id: "plan-parallel",
        title: "Parallel Plan",
        intent: "Test parallel roots",
        phases: [
          {
            id: "codex-1",
            name: "Codex 1",
            description: "Codex phase",
            tasks: [
              {
                id: "c1",
                title: "C1",
                requirement: "C1",
                deps: [],
                priority: 1,
                acceptance: ["done"],
                filesHint: [],
              },
            ],
            dependsOn: [],
            estimatedDurationMs: 1000,
            agentType: "codex",
          },
          {
            id: "droid-1",
            name: "Droid 1",
            description: "Droid phase",
            tasks: [
              {
                id: "d1",
                title: "D1",
                requirement: "D1",
                deps: [],
                priority: 1,
                acceptance: ["done"],
                filesHint: [],
              },
            ],
            dependsOn: [],
            estimatedDurationMs: 1000,
            agentType: "droid",
          },
        ],
        resources: {
          agentCount: 2,
          strategy: "parallel",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      };

      const waves = planToWaves(parallelPlan);

      expect(waves.length).toBeGreaterThan(0);
    });
  });
});
