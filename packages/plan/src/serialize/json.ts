import type { StructuredPlan } from "../types.js";

import { structuredPlanSchema } from "../schema.js";

function validatePlan(
  data: unknown
): { success: true; data: StructuredPlan } | { success: false; error: string } {
  const result = structuredPlanSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues
        .map((e) => "".concat(e.path.join("."), ": ").concat(e.message))
        .join("; "),
    };
  }

  return { success: true, data: result.data };
}

export function planToJson(plan: StructuredPlan): string {
  const validated = validatePlan(plan);
  if (!validated.success) {
    throw new Error(validated.error);
  }

  return JSON.stringify(validated.data, null, 2);
}

export function jsonToPlan(json: string): StructuredPlan {
  try {
    const data = JSON.parse(json);
    const result = validatePlan(data);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON");
    }
    throw error;
  }
}

export function exportPlan(plan: StructuredPlan): {
  json: string;
  validated: boolean;
} {
  try {
    const json = planToJson(plan);
    return { json, validated: true };
  } catch {
    return {
      json: JSON.stringify(plan, null, 2),
      validated: false,
    };
  }
}
