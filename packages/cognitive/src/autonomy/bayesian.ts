/**
 * Bayesian update logic for autonomy gradient
 */

import {
  clamp01,
  CONFIDENCE_DECAY_RATE,
  MS_PER_DAY,
  type Timestamp,
} from "../util/math.js";
import { DEFAULT_BETA_PRIOR, type BetaPrior, type Evidence } from "./types.js";

const OVERRIDE_WEIGHT = 1.5;

export const betaMode = ({ alpha, beta }: BetaPrior): number => {
  if (alpha <= 1 || beta <= 1) {
    return alpha / (alpha + beta);
  }
  return (alpha - 1) / (alpha + beta - 2);
};

export const betaVariance = ({ alpha, beta }: BetaPrior): number => {
  const sum = alpha + beta;
  if (sum <= 0) {
    return 0;
  }
  return (alpha * beta) / (sum * sum * (sum + 1));
};

export const decayPriorTowardBaseline = (
  now: number,
  lastUpdate: Timestamp | undefined,
  prior: BetaPrior
): BetaPrior => {
  if (lastUpdate === undefined) {
    return { ...prior };
  }

  const msSinceUpdate = now - lastUpdate;
  if (!Number.isFinite(msSinceUpdate) || msSinceUpdate <= 0) {
    return { ...prior };
  }

  const daysSinceUpdate = msSinceUpdate / MS_PER_DAY;
  const decayFactor = CONFIDENCE_DECAY_RATE ** daysSinceUpdate;

  return {
    alpha:
      DEFAULT_BETA_PRIOR.alpha +
      (prior.alpha - DEFAULT_BETA_PRIOR.alpha) * decayFactor,
    beta:
      DEFAULT_BETA_PRIOR.beta +
      (prior.beta - DEFAULT_BETA_PRIOR.beta) * decayFactor,
  };
};

export const bayesianUpdate = (
  now: number,
  prior: BetaPrior,
  evidence: Evidence,
  lastUpdate?: Timestamp
): { level: number; confidence: number; posterior: BetaPrior } => {
  const decayed = decayPriorTowardBaseline(now, lastUpdate, prior);
  const reliability = clamp01(evidence.reliability ?? 1);

  const posterior: BetaPrior = { ...decayed };

  if (reliability > 0) {
    switch (evidence._) {
      case "success":
        posterior.alpha += reliability;
        break;
      case "failure":
        posterior.beta += reliability;
        break;
      case "feedback": {
        const magnitude = clamp01(evidence.strength) * reliability;
        if (evidence.positive) {
          posterior.alpha += magnitude;
        } else {
          posterior.beta += magnitude;
        }
        break;
      }
      case "override":
        posterior.beta += reliability * OVERRIDE_WEIGHT;
        break;
    }
  }

  const mode = betaMode(posterior);
  const variance = betaVariance(posterior);

  return {
    level: clamp01(mode),
    confidence: clamp01(1 - variance),
    posterior,
  };
};
