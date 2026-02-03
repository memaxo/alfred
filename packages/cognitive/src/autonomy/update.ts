/**
 * Autonomy gradient update with instrumentation
 */

import type { Physiology } from "../physiology/types.js";

import { cognitiveAutonomyUpdateDuration } from "../metrics.js";
import {
  autonomy,
  CONFIDENCE_DECAY_RATE,
  clamp01,
  confidence,
  MS_PER_DAY,
  timestamp,
} from "../util/math.js";
import { bayesianUpdate, betaMode, betaVariance } from "./bayesian.js";
import {
  type AutonomyGradient,
  DEFAULT_BETA_PRIOR,
  type Evidence,
} from "./types.js";

// Use cross-platform performance API
const perf =
  typeof performance !== "undefined" ? performance : { now: () => Date.now() };

export const initialAutonomy = (now: number): AutonomyGradient => {
  const prior = { ...DEFAULT_BETA_PRIOR };
  const levelEstimate = clamp01(betaMode(prior));
  const confidenceEstimate = clamp01(1 - betaVariance(prior));

  return {
    level: autonomy(levelEstimate),
    confidence: confidence(confidenceEstimate),
    prior,
    evidence: [],
    constraints: [
      { _: "approval", required: true },
      { _: "confidence", minimum: confidence(0.7) },
    ],
    lastUpdate: timestamp(now),
  };
};

export function updateAutonomy(
  now: number,
  current: AutonomyGradient,
  evidence: Evidence,
  physiology?: Physiology
): AutonomyGradient {
  const start = perf.now();

  try {
    const reliability = clamp01(evidence.reliability ?? 1);
    if (reliability === 0) {
      return current;
    }

    const normalizedEvidence: Evidence =
      reliability === (evidence.reliability ?? 1)
        ? evidence
        : { ...evidence, reliability };

    const prior = current.prior || { ...DEFAULT_BETA_PRIOR };
    const update = bayesianUpdate(
      now,
      prior,
      normalizedEvidence,
      current.lastUpdate
    );

    let regulatedLevel = update.level;
    const currentLevel = Number(current.level);
    const evidenceType = normalizedEvidence._;
    const isFeedback = evidenceType === "feedback";
    const isPositiveSignal =
      evidenceType === "success" ||
      (isFeedback && normalizedEvidence.positive === true);
    const isNegativeSignal =
      evidenceType === "failure" ||
      evidenceType === "override" ||
      (isFeedback && normalizedEvidence.positive === false);

    if (physiology) {
      if (physiology.frustration > 0.7) {
        regulatedLevel *= 0.5;
      }
      if (physiology.energy < 0.2) {
        regulatedLevel *= 0.8;
      }
    }

    if (isPositiveSignal) {
      regulatedLevel = Math.max(regulatedLevel, currentLevel);
    } else if (isNegativeSignal) {
      regulatedLevel = Math.min(regulatedLevel, currentLevel);
    }

    let adjustedConfidence = update.confidence;
    const timeSinceUpdate = now - current.lastUpdate;
    if (Number.isFinite(timeSinceUpdate) && timeSinceUpdate > 0) {
      const daysSinceUpdate = timeSinceUpdate / MS_PER_DAY;
      adjustedConfidence *= CONFIDENCE_DECAY_RATE ** daysSinceUpdate;
    }

    return {
      level: autonomy(Math.max(0, Math.min(1, regulatedLevel))),
      confidence: confidence(Math.max(0, Math.min(1, adjustedConfidence))),
      prior: update.posterior,
      evidence: [...current.evidence.slice(-9), normalizedEvidence],
      constraints: current.constraints,
      lastUpdate: timestamp(now),
    };
  } finally {
    const durationMs = perf.now() - start;
    cognitiveAutonomyUpdateDuration.observe(durationMs / 1000);
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.05) {
    }
  }
}
