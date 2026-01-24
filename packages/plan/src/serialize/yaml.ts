import yaml from "yaml";

import type { StructuredPlan } from "../generate/types.js";

/**
 * Export a StructuredPlan to YAML string
 */
export function exportPlanToYAML(plan: StructuredPlan): string {
  const yamlData = {
    id: plan.id,
    title: plan.title,
    intent: plan.intent,
    phases: plan.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      description: phase.description,
      agentType: phase.agentType,
      estimatedDurationMs: phase.estimatedDurationMs,
      dependsOn: phase.dependsOn,
      tasks: phase.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        requirement: task.requirement,
        deps: task.deps,
        acceptance: task.acceptance,
      })),
    })),
    resources: plan.resources,
    evaluationCriteria: plan.evaluationCriteria,
  };

  return yaml.stringify(yamlData);
}
