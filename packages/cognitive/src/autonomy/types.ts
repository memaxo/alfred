/**
 * Autonomy domain types
 */

import type { Autonomy, Confidence, Timestamp } from "../util/math.js";

export type BetaPrior = {
  alpha: number;
  beta: number;
};

export type Evidence =
  | { _: "success"; task: string; duration: number; reliability?: number }
  | { _: "failure"; task: string; error: string; reliability?: number }
  | {
      _: "feedback";
      positive: boolean;
      strength: number;
      reliability?: number;
    }
  | { _: "override"; reason: string; reliability?: number };

export type Constraint =
  | { _: "temporal"; until: Timestamp }
  | { _: "scope"; allowed: string[]; forbidden: string[] }
  | { _: "confidence"; minimum: Confidence }
  | { _: "approval"; required: boolean };

export type AutonomyGradient = {
  level: Autonomy;
  confidence: Confidence;
  prior: BetaPrior;
  evidence: Evidence[];
  constraints: Constraint[];
  lastUpdate: Timestamp;
};

export const DEFAULT_BETA_PRIOR: BetaPrior = Object.freeze({
  alpha: 2,
  beta: 5,
});
