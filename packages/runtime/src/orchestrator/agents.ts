import type { WavePlan } from "@alfred/agent/orchestrator/multi/spawn";
import type { Phase } from "@alfred/plan";

/**
 * Assign agent types to waves based on the phase they belong to.
 */
export function assignAgentTypes(
  waves: WavePlan[],
  phases: Phase[]
): WavePlan[] {
  return waves.map((wave) => {
    // Find phase for this wave's tasks.
    // We assume all tasks in a wave belong to the same phase (or at least the same agent type).
    // In our phased planner, waves are typically within a phase.
    const firstTaskId = wave.agents[0];
    if (!firstTaskId) {
      return {
        ...wave,
        agentType: "codex",
      };
    }

    const phase = phases.find((p) => p.tasks.some((t) => t.id === firstTaskId));

    if (phase) {
      return {
        ...wave,
        agentType: phase.agentType,
      };
    }

    // Default: codex
    return {
      ...wave,
      agentType: "codex",
    };
  });
}
