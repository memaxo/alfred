import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { Phase } from "@alfred/plan";

/**
 * Flatten phases into a single list of subtasks, preserving phase metadata.
 */
export function flattenPhases(phases: Phase[]): SubTask[] {
  const subtasks: SubTask[] = [];

  for (const phase of phases) {
    // Add phase metadata to each subtask
    for (const task of phase.tasks) {
      subtasks.push({
        ...task,
        // Store phase ID in task metadata for tracking
        metadata: {
          ...task.metadata,
          phaseId: phase.id,
          phaseName: phase.name,
          agentType: phase.agentType,
        },
      });
    }
  }

  return subtasks;
}
