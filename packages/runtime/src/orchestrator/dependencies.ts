import type { Phase } from "@alfred/plan";

/**
 * Build a dependency map from phases.
 * Phase dependencies are propagated to all tasks within the dependent phase.
 */
export function buildDependencyMap(phases: Phase[]): Map<string, string[]> {
  const depMap = new Map<string, string[]>();

  for (const phase of phases) {
    // Collect all task IDs from phases this phase depends on
    const inheritedDeps: string[] = [];

    for (const depPhaseId of phase.dependsOn) {
      const depPhase = phases.find((p) => p.id === depPhaseId);
      if (depPhase) {
        // All tasks in this phase depend on all tasks in the dependency phase
        inheritedDeps.push(...depPhase.tasks.map((t) => t.id));
      }
    }

    // Assign inherited and existing task-level dependencies
    for (const task of phase.tasks) {
      const existingDeps = depMap.get(task.id) ?? [];
      const combinedDeps = [
        ...new Set([...existingDeps, ...inheritedDeps, ...task.deps]),
      ];
      depMap.set(task.id, combinedDeps);
    }
  }

  return depMap;
}
