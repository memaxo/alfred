import type { CognitiveState, Decision, Plan } from "@alfred/cognitive/state";
import { deciding } from "@alfred/cognitive/state";

// Simple risk assessment
// In future, this could use an LLM classifier
export function assessRisk(plan: Plan): "low" | "medium" | "high" {
  const highRiskKeywords = ["delete", "remove", "destroy", "purchase", "pay"];
  const mediumRiskKeywords = ["update", "modify", "change", "send", "email"];

  let maxRisk = 0; // 0=low, 1=medium, 2=high

  for (const step of plan.steps) {
    const action = step.action.toLowerCase();
    const description = JSON.stringify(step.params).toLowerCase();

    if (
      highRiskKeywords.some(
        (k) => action.includes(k) || description.includes(k)
      )
    ) {
      return "high";
    }

    if (
      mediumRiskKeywords.some(
        (k) => action.includes(k) || description.includes(k)
      )
    ) {
      maxRisk = Math.max(maxRisk, 1);
    }
  }

  return maxRisk === 1 ? "medium" : "low";
}

export function gateExecution(
  state: CognitiveState,
  autonomyLevel: number
): CognitiveState {
  if (state._ !== "executing") {
    return state;
  }

  const risk = assessRisk(state.plan);
  let requiredAutonomy = 0.3; // Low risk

  if (risk === "medium") {
    requiredAutonomy = 0.7;
  }
  if (risk === "high") {
    requiredAutonomy = 0.95;
  }

  if (autonomyLevel < requiredAutonomy) {
    // Transition to deciding (gated)
    const decision: Decision = {
      id: `gate-${Date.now()}`,
      description: `Approval required for ${risk} risk action: ${state.plan.steps[0]?.action}`,
      score: 0.5,
      plan: state.plan,
      risks: [{ type: "external_effect", severity: risk }],
      autonomy: requiredAutonomy as any,
    };

    return deciding([decision]);
  }

  return state;
}
