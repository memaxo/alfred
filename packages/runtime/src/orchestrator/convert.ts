import {
  planWaves,
  type WavePlan,
} from "@alfred/agent/orchestrator/multi/spawn";
import type { StructuredPlan } from "@alfred/plan";
import { assignAgentTypes, setIsolation } from "./agents.js";
import { buildDependencyMap } from "./dependencies.js";
import { flattenPhases } from "./flatten.js";

/**
 * Convert a StructuredPlan to a list of WavePlans for execution.
 * Bridges the phased planning system with the existing wave orchestrator.
 */
export function convertPlanToWavePlan(plan: StructuredPlan): WavePlan[] {
  // 1. Flatten phases into SubTask[] (preserving phase metadata)
  const subtasks = flattenPhases(plan.phases);

  // 2. Build task-level dependency map from phase dependencies
  const dependencies = buildDependencyMap(plan.phases);

  // 3. Use existing planWaves() but respect phase dependencies
  const waves = planWaves(subtasks, {
    maxParallel: plan.resources.agentCount,
    dependencies,
  });

  // 4. Assign agent types from plan phases
  const wavesWithAgents = assignAgentTypes(waves, plan.phases);

  // 5. Assign phase IDs to waves for tracking
  const wavesWithPhases = wavesWithAgents.map((wave) => {
    const firstTaskId = wave.agents[0];
    const phase = plan.phases.find((p) =>
      p.tasks.some((t) => t.id === firstTaskId)
    );
    return {
      ...wave,
      phaseId: phase?.id,
    };
  });

  // 6. Set isolation strategy from plan
  const wavesWithIsolation = setIsolation(
    wavesWithPhases,
    plan.resources.isolation as "container" | "worktree"
  );

  return wavesWithIsolation;
}
