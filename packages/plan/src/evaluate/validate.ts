import { structuredPlanSchema, type StructuredPlan } from "../generate/types.js";
import { hasCycles } from "../generate/dependencies.js";

/**
 * Validate a StructuredPlan for structural correctness
 */
export function validatePlan(plan: StructuredPlan): boolean {
  // 1. Zod schema validation
  const parsed = structuredPlanSchema.safeParse(plan);
  if (!parsed.success) {
    return false;
  }

  // 2. Dependency cycle detection
  if (hasCycles(plan.phases)) {
    return false;
  }

  // 3. Phase validation
  for (const phase of plan.phases) {
    // Empty phase check
    if (phase.tasks.length === 0) {
      return false;
    }
    // Duration check
    if (phase.estimatedDurationMs <= 0) {
      return false;
    }
    // Verify task dependencies exist
    for (const task of phase.tasks) {
      for (const depId of task.deps) {
        // Task dependency can be within the same phase OR in a previous phase
        // Here we just check if it's not a self-dependency
        if (depId === task.id) {
          return false;
        }
      }
    }
  }

  return true;
}
