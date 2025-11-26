/**
 * ALFRED Decision Composition
 */

import type { Decision, Obligation } from "./types";

function obligationKey(obligation: Obligation): string {
  const meta = obligation.metadata ?? null;
  return `${obligation.type}:${obligation.reason}:${JSON.stringify(meta)}`;
}

function addObligation(target: Map<string, Obligation>, obligation: Obligation) {
  const key = obligationKey(obligation);
  if (!target.has(key)) {
    target.set(key, obligation);
  }
}

export function combineDecisions(decisions: Decision[]): Decision {
  const obligations = new Map<string, Obligation>();
  const denyDecision = decisions.find((decision) => !decision.allow);
  if (denyDecision) {
    for (const obligation of denyDecision.obligations) {
      addObligation(obligations, obligation);
    }
    return {
      allow: false,
      obligations: Array.from(obligations.values()),
      reason: denyDecision.reason,
      ruleIds: denyDecision.ruleIds,
    };
  }

  for (const decision of decisions) {
    for (const obligation of decision.obligations) {
      addObligation(obligations, obligation);
    }
  }

  const combinedReason = decisions
    .map((decision) => decision.reason)
    .filter((reason): reason is string => Boolean(reason))
    .join(", ");

  const ruleIds = decisions.flatMap((decision) => decision.ruleIds ?? []);

  return {
    allow: true,
    obligations: Array.from(obligations.values()),
    reason: combinedReason || undefined,
    ruleIds: ruleIds.length > 0 ? ruleIds : undefined,
  };
}
