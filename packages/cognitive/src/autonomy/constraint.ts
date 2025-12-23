/**
 * Constraint checking for autonomy
 */

import type { Physiology } from "../physiology/types.js";
import type { AutonomyGradient } from "./types.js";

export type ConstraintResult = {
  allowed: boolean;
  reason?: string;
};

export const meetsConstraints = (
  auto: AutonomyGradient,
  action: string,
  physiology?: Physiology,
  now?: number
): ConstraintResult => {
  if (physiology) {
    if (physiology.frustration > 0.85) {
      return { allowed: false, reason: "frustration_threshold_exceeded" };
    }
    if (physiology.energy < 0.1) {
      return { allowed: false, reason: "energy_depleted" };
    }
    if (physiology.boredom > 0.9) {
      return { allowed: false, reason: "boredom_loop_detected" };
    }
  }

  for (const constraint of auto.constraints) {
    switch (constraint._) {
      case "temporal":
        if ((now ?? Date.now()) > constraint.until) {
          return { allowed: false, reason: "temporal_constraint_expired" };
        }
        break;
      case "scope":
        if (constraint.forbidden.includes(action)) {
          return { allowed: false, reason: "action_forbidden" };
        }
        if (
          constraint.allowed.length > 0 &&
          !constraint.allowed.includes(action)
        ) {
          return { allowed: false, reason: "action_not_allowed" };
        }
        break;
      case "confidence":
        if (auto.confidence < constraint.minimum) {
          return { allowed: false, reason: "confidence_below_minimum" };
        }
        break;
      case "approval":
        if (constraint.required && auto.level < 0.5) {
          return { allowed: false, reason: "approval_required" };
        }
        break;
    }
  }
  return { allowed: true };
};
