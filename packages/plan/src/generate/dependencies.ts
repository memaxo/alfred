import type { Phase } from "./types.js";

/**
 * Build dependency graph between phases based on task dependencies
 */
export function buildDependencyGraph(phases: Phase[]): Phase[] {
  // Create a mapping of task ID to phase ID
  const taskToPhase = new Map<string, string>();
  for (const phase of phases) {
    for (const task of phase.tasks) {
      taskToPhase.set(task.id, phase.id);
    }
  }

  // Update phase dependencies
  return phases.map((phase) => {
    const deps = new Set<string>();
    for (const task of phase.tasks) {
      for (const depTaskId of task.deps) {
        const depPhaseId = taskToPhase.get(depTaskId);
        if (depPhaseId && depPhaseId !== phase.id) {
          deps.add(depPhaseId);
        }
      }
    }

    return {
      ...phase,
      dependsOn: [...deps],
    };
  });
}

/**
 * Check for cycles in the dependency graph
 */
export function hasCycles(phases: Phase[]): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function isCyclic(phaseId: string): boolean {
    if (recStack.has(phaseId)) {
      return true;
    }
    if (visited.has(phaseId)) {
      return false;
    }

    visited.add(phaseId);
    recStack.add(phaseId);

    const phase = phases.find((p) => p.id === phaseId);
    if (phase) {
      for (const depId of phase.dependsOn) {
        if (isCyclic(depId)) {
          return true;
        }
      }
    }

    recStack.delete(phaseId);
    return false;
  }

  for (const phase of phases) {
    if (isCyclic(phase.id)) {
      return true;
    }
  }

  return false;
}
