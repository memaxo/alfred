/**
 * ALFRED Decision Composition
 */

import type { Decision } from "./types";

export function combineDecisions(decisions: Decision[]): Decision {
  const obligations = new Set<string>();
  const denyDecision = decisions.find((decision) => !decision.allow);
  if (denyDecision) {
    for (const obligation of denyDecision.obligations) {
      obligations.add(obligation);
    }
    return {
      allow: false,
      obligations: Array.from(obligations),
      reason: denyDecision.reason,
      ruleIds: denyDecision.ruleIds,
    };
  }

  for (const decision of decisions) {
    for (const obligation of decision.obligations) {
      obligations.add(obligation);
    }
  }

  const combinedReason = decisions
    .map((decision) => decision.reason)
    .filter((reason): reason is string => Boolean(reason))
    .join(", ");

  const ruleIds = decisions.flatMap((decision) => decision.ruleIds ?? []);

  return {
    allow: true,
    obligations: Array.from(obligations),
    reason: combinedReason || undefined,
    ruleIds: ruleIds.length > 0 ? ruleIds : undefined,
  };
}
