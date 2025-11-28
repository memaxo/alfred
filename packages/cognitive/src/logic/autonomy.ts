import type { CognitiveState, Decision } from "@alfred/cognitive/state";
import { deciding, autonomy as toAutonomy } from "@alfred/cognitive/state";

export type RiskLevel = "low" | "medium" | "high";

export type RiskAssessment = {
  level: RiskLevel;
  score?: number;
  anchors?: string[];
};

const AUTONOMY_THRESHOLDS: Record<RiskLevel, number> = {
  low: 0.3,
  medium: 0.7,
  high: 0.95,
};

const DEFAULT_ASSESSMENT: RiskAssessment = { level: "low", score: 0 };

export function requiredAutonomyForRisk(
  assessmentOrLevel: RiskAssessment | RiskLevel = DEFAULT_ASSESSMENT
): number {
  const level =
    typeof assessmentOrLevel === "string"
      ? assessmentOrLevel
      : assessmentOrLevel.level;
  return AUTONOMY_THRESHOLDS[level] ?? AUTONOMY_THRESHOLDS.low;
}

export function shouldGateExecution(
  autonomyLevel: number,
  assessment: RiskAssessment = DEFAULT_ASSESSMENT
): { gated: boolean; required: number; level: RiskLevel } {
  const required = requiredAutonomyForRisk(assessment);
  const gated = autonomyLevel < required;
  return {
    gated,
    required,
    level: assessment.level ?? "low",
  };
}

export function gateExecution(
  state: CognitiveState,
  autonomyLevel: number,
  assessment: RiskAssessment = DEFAULT_ASSESSMENT
): CognitiveState {
  if (state._ !== "executing") {
    return state;
  }

  const gate = shouldGateExecution(autonomyLevel, assessment);
  if (!gate.gated) {
    return state;
  }

  const score = assessment.score ?? 0.5;
  const firstAction = state.plan.steps[0]?.action ?? "unknown";
  const anchors = assessment.anchors?.join(", ") ?? gate.level;

  const decision: Decision = {
    id: `gate-${Date.now()}`,
    description: `Approval required for ${gate.level} risk action (${anchors}): ${firstAction}`,
    score,
    plan: state.plan,
    risks: [{ type: "external_effect", severity: gate.level }],
    autonomy: toAutonomy(gate.required),
  };

  return deciding(Date.now(), [decision]);
}
