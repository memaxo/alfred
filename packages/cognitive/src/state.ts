/**
 * Cognitive State Machine
 * Pure algebraic data types with zero runtime overhead
 */

import { performance } from "node:perf_hooks";

import {
  cognitiveAutonomyUpdateDuration,
  cognitiveErrorCalculationDuration,
  cognitivePhysiologyUpdateDuration,
} from "./metrics";

// Core types
type Timestamp = number & { readonly _: unique symbol };
type Confidence = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};
type Autonomy = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};

// Brand constructors
export const timestamp = (n: number): Timestamp => {
  if (!Number.isFinite(n)) {
    throw new Error("Timestamp must be a finite number");
  }
  if (n < 0) {
    throw new Error("Timestamp cannot be negative");
  }
  return n as Timestamp;
};
const confidence = (n: number): Confidence => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid confidence");
  }
  return n as Confidence;
};
export const autonomy = (n: number): Autonomy => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid autonomy");
  }
  return n as Autonomy;
};

// Evidence for autonomy decisions
type Evidence =
  | { _: "success"; task: string; duration: number; reliability?: number }
  | { _: "failure"; task: string; error: string; reliability?: number }
  | {
      _: "feedback";
      positive: boolean;
      strength: number;
      reliability?: number;
    }
  | { _: "override"; reason: string; reliability?: number };

// Constraints on autonomy
type Constraint =
  | { _: "temporal"; until: Timestamp }
  | { _: "scope"; allowed: string[]; forbidden: string[] }
  | { _: "confidence"; minimum: Confidence }
  | { _: "approval"; required: boolean };

type BetaPrior = {
  alpha: number;
  beta: number;
};

// Decision options for deciding state
export type Decision = {
  id: string;
  description: string;
  score: number;
  plan: Plan;
  risks: Risk[];
  autonomy: Autonomy;
};

// Plan for execution
export type Plan = {
  steps: Step[];
  duration: number; // estimated ms
  confidence: Confidence;
};

export type Step = {
  action: string;
  params: Record<string, unknown>;
  timeout: number;
  retryable: boolean;
};

export type Risk = {
  type: "data_loss" | "irreversible" | "external_effect" | "high_cost";
  severity: "low" | "medium" | "high";
  mitigation?: string;
};

// Path for exploring during thinking
export type Path = {
  direction: string;
  depth: number;
  promise: number; // how promising this path looks
};

// Criteria for decision making
export type Criteria = {
  safety: number;
  speed: number;
  accuracy: number;
  cost: number;
};

// Physiological State (Homeostasis)
export type Physiology = {
  energy: number; // 0..1 (decreases with steps)
  boredom: number; // 0..1 (increases with repetition)
  frustration: number; // 0..1 (increases with errors)
};

// Outcome of execution
export type Outcome =
  | { _: "success"; result: unknown; duration: number }
  | { _: "failure"; error: string; recoverable: boolean }
  | { _: "partial"; completed: string[]; failed: string[] }
  | { _: "cancelled"; reason: string };

// Main cognitive state ADT
export type CognitiveState =
  | { _: "idle"; since: Timestamp; physiology: Physiology }
  | {
      _: "capturing";
      input: string;
      confidence: Confidence;
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "thinking";
      about: string;
      depth: number;
      paths: Path[];
      reasoningTraces?: string[];
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "deciding";
      options: Decision[];
      criteria: Criteria;
      weights: number[];
      deadline: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "executing";
      plan: Plan;
      step: number;
      auto: AutonomyGradient;
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "reflecting";
      outcome: Outcome;
      expected: string;
      actual: string;
      error: number;
      physiology: Physiology;
    };

// Autonomy gradient with Bayesian updates
export type AutonomyGradient = {
  level: Autonomy;
  confidence: Confidence;
  prior: BetaPrior;
  evidence: Evidence[];
  constraints: Constraint[];
  lastUpdate: Timestamp;
};

// Event types that trigger transitions
export type Event =
  | {
      _: "input";
      content: string;
      source: "user" | "system" | "tool";
      ts: Timestamp;
    }
  | { _: "timeout"; deadline: Timestamp }
  | { _: "feedback"; expected: string; actual: string; ts: Timestamp }
  | { _: "interrupt"; reason: string; priority: 1 | 2 | 3; ts: Timestamp }
  | { _: "complete"; outcome: Outcome; ts: Timestamp };

// Physiology Defaults
const defaultPhysiology = (): Physiology => ({
  energy: 1.0,
  boredom: 0.0,
  frustration: 0.0,
});

// State factories
export const idle = (now: number, phy?: Physiology): CognitiveState => ({
  _: "idle",
  since: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const capturing = (
  now: number,
  input: string,
  conf: number,
  phy?: Physiology
): CognitiveState => ({
  _: "capturing",
  input,
  confidence: confidence(conf),
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const thinking = (
  now: number,
  about: string,
  depth = 1,
  traces?: string[],
  phy?: Physiology
): CognitiveState => ({
  _: "thinking",
  about,
  depth: traces ? Math.max(depth, traces.length) : depth,
  paths: [],
  reasoningTraces: traces,
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const deciding = (
  now: number,
  options: Decision[],
  criteria?: Criteria,
  phy?: Physiology
): CognitiveState => ({
  _: "deciding",
  options,
  criteria: criteria || defaultCriteria(),
  weights: [0.4, 0.3, 0.2, 0.1], // safety, speed, accuracy, cost
  deadline: timestamp(now + 5000), // 5s decision timeout
  physiology: phy ?? defaultPhysiology(),
});

export const executing = (
  now: number,
  plan: Plan,
  auto: AutonomyGradient,
  phy?: Physiology
): CognitiveState => ({
  _: "executing",
  plan,
  step: 0,
  auto,
  started: timestamp(now),
  physiology: phy ?? defaultPhysiology(),
});

export const reflecting = (
  outcome: Outcome,
  expected: string,
  actual: string,
  phy?: Physiology
): CognitiveState => ({
  _: "reflecting",
  outcome,
  expected,
  actual,
  error: calculateError(expected, actual),
  physiology: phy ?? defaultPhysiology(),
});

// Physiology Logic
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const CONFIDENCE_DECAY_RATE = 0.95; // per day decay multiplier
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_BETA_PRIOR: BetaPrior = Object.freeze({ alpha: 2, beta: 5 });
var betaMode = ({ alpha, beta }: BetaPrior): number => {
  if (alpha <= 1 || beta <= 1) {
    return alpha / (alpha + beta);
  }
  return (alpha - 1) / (alpha + beta - 2);
};

var betaVariance = ({ alpha, beta }: BetaPrior): number => {
  const sum = alpha + beta;
  if (sum <= 0) {
    return 0;
  }
  return (alpha * beta) / (sum * sum * (sum + 1));
};

export const updatePhysiology = (
  current: Physiology,
  event: "step" | "success" | "error" | "entropy_high" | "entropy_low"
): Physiology => {
  const start = performance.now();
  try {
    let { energy, boredom, frustration } = current;

    switch (event) {
      case "step":
        energy -= 0.01;
        break;
      case "success":
        frustration *= 0.5;
        energy += 0.05;
        boredom *= 0.9;
        break;
      case "error":
        frustration += 0.2;
        energy -= 0.05;
        break;
      case "entropy_high": // Repetitive loop
        boredom += 0.3;
        break;
      case "entropy_low": // Novelty
        boredom *= 0.8;
        break;
    }

    return {
      energy: clamp01(energy),
      boredom: clamp01(boredom),
      frustration: clamp01(frustration),
    };
  } finally {
    const durationMs = performance.now() - start;
    cognitivePhysiologyUpdateDuration.observe(durationMs / 1000);
    if (durationMs > 0.01) {
      console.warn(
        `cognitive_budget_exceeded: physiology update took ${durationMs.toFixed(
          4
        )}ms`
      );
    }
  }
};

// Autonomy gradient management
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
  const start = performance.now();

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
    const durationMs = performance.now() - start;
    cognitiveAutonomyUpdateDuration.observe(durationMs / 1000);
    if (durationMs > 0.05) {
      console.warn(
        `cognitive_budget_exceeded: autonomy update took ${durationMs.toFixed(
          4
        )}ms`
      );
    }
  }
}

// Helpers
const defaultCriteria = (): Criteria => ({
  safety: 1.0,
  speed: 0.7,
  accuracy: 0.9,
  cost: 0.5,
});

export const calculateError = (expected: string, actual: string): number => {
  const start = performance.now();
  try {
    if (expected === actual) {
      return 0;
    }
    if (expected.length === 0 || actual.length === 0) {
      return Math.max(expected.length, actual.length) === 0 ? 0 : 1;
    }

    const maxLen = Math.max(expected.length, actual.length);
    const [shorter, longer] =
      expected.length <= actual.length
        ? [expected, actual]
        : [actual, expected];

    let prevRow = Array.from({ length: shorter.length + 1 }, (_, i) => i);
    let currRow = new Array<number>(shorter.length + 1);

    for (let i = 1; i <= longer.length; i++) {
      currRow[0] = i;
      const longChar = longer.charCodeAt(i - 1);

      for (let j = 1; j <= shorter.length; j++) {
        const cost = longChar === shorter.charCodeAt(j - 1) ? 0 : 1;
        const insertion = currRow[j - 1]! + 1;
        const deletion = prevRow[j]! + 1;
        const substitution = prevRow[j - 1]! + cost;
        currRow[j] = Math.min(insertion, deletion, substitution);
      }

      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[shorter.length]! / maxLen;
  } finally {
    const durationMs = performance.now() - start;
    cognitiveErrorCalculationDuration.observe(durationMs / 1000);
    if (durationMs > 0.1) {
      console.warn(
        `cognitive_budget_exceeded: error calculation took ${durationMs.toFixed(
          4
        )}ms`
      );
    }
  }
};

const overrideWeight = 1.5;

const decayPriorTowardBaseline = (
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

const bayesianUpdate = (
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
        posterior.beta += reliability * overrideWeight;
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

/**
 * Evaluate reasoning quality based on trace characteristics
 */
export const evaluateReasoningQuality = (
  traces: string[],
  outcome: Outcome
): Evidence => {
  if (traces.length === 0) {
    return { _: "feedback", positive: false, strength: 0.3 };
  }

  const avgLength =
    traces.reduce((sum, text) => sum + text.length, 0) / traces.length;
  const hasDecisionPoints = traces.some((text) =>
    /considering|choosing|selecting|decided/i.test(text)
  );
  const hasAlternatives = traces.some((text) =>
    /however|alternatively|instead|but|though/i.test(text)
  );
  const hasCausalReasoning = traces.some((text) =>
    /because|therefore|thus|leads to|causes/i.test(text)
  );

  let score = 0.5;
  if (avgLength > 50) {
    score += 0.1;
  }
  if (hasDecisionPoints) {
    score += 0.15;
  }
  if (hasAlternatives) {
    score += 0.15;
  }
  if (hasCausalReasoning) {
    score += 0.1;
  }

  const positive = outcome._ === "success";
  const strength = Math.min(1, score);

  return { _: "feedback", positive, strength };
};

// Constraint checking
export const meetsConstraints = (
  auto: AutonomyGradient,
  action: string,
  physiology?: Physiology
): { allowed: boolean; reason?: string } => {
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
        if (Date.now() > constraint.until) {
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

// State predicates
export const isActive = (state: CognitiveState): boolean => state._ !== "idle";

export const canInterrupt = (state: CognitiveState): boolean =>
  state._ === "thinking" || state._ === "deciding";

export const requiresInput = (state: CognitiveState): boolean =>
  state._ === "idle" || state._ === "reflecting";

export const isExecuting = (state: CognitiveState): boolean =>
  state._ === "executing";

// Time-based state properties
export const duration = (state: CognitiveState): number => {
  const now = Date.now();
  switch (state._) {
    case "idle":
      return now - state.since;
    case "capturing":
      return now - state.started;
    case "thinking":
      return now - state.started;
    case "deciding":
      return state.deadline - now;
    case "executing":
      return now - state.started;
    case "reflecting":
      return 0;
  }
};

export const isStale = (state: CognitiveState, threshold = 30_000): boolean =>
  duration(state) > threshold;

// ======================================
// Focus State Machine (productivity mode)
// ======================================

export type FocusState = {
  _: "idle" | "active";
  since?: string;
  duration?: number;
  note?: string;
  sessions?: number;
  last?: {
    started: string;
    stopped: string;
    duration: number;
  };
};

type FocusStartParams = {
  durationMin?: number;
  note?: string;
  since?: string;
};

type FocusUpdateParams = {
  durationMin?: number;
  note?: string;
  timestamp?: string;
};

const FOCUS_MIN_DURATION = 5;
const FOCUS_MAX_DURATION = 12 * 60;

function clampDuration(duration?: number) {
  if (!(duration && Number.isFinite(duration))) {
    return;
  }
  const rounded = Math.round(duration);
  if (rounded < FOCUS_MIN_DURATION) {
    return FOCUS_MIN_DURATION;
  }
  if (rounded > FOCUS_MAX_DURATION) {
    return FOCUS_MAX_DURATION;
  }
  return rounded;
}

function cleanNote(note?: string) {
  if (!note) {
    return;
  }
  const trimmed = note.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, 280);
}

export const statusFocus = (
  state: FocusState | null | undefined
): FocusState => {
  if (!state) {
    return { _: "idle" };
  }
  return {
    _: state._,
    since: state.since,
    duration: state.duration,
    note: state.note,
    sessions: state.sessions,
    last: state.last,
  };
};

export const startFocus = (
  current: FocusState | null | undefined,
  params: FocusStartParams
): FocusState => {
  const now = params.since ?? new Date().toISOString();
  const duration = clampDuration(params.durationMin ?? current?.duration);
  const note = cleanNote(params.note ?? current?.note);
  const sessions = (current?.sessions ?? 0) + 1;
  return {
    _: "active",
    since: now,
    duration,
    note,
    sessions,
    last: current?.last,
  };
};

export const stopFocus = (
  current: FocusState | null | undefined
): FocusState => {
  if (!current) {
    return { _: "idle" };
  }
  const timestamp = new Date().toISOString();
  const started = current.since ?? timestamp;
  const elapsedMs = Date.parse(timestamp) - Date.parse(started);
  const duration = Math.max(1, Math.round(elapsedMs / 60_000));
  return {
    _: "idle",
    duration: current.duration ?? duration,
    note: current.note,
    sessions: current.sessions,
    last: {
      started,
      stopped: timestamp,
      duration,
    },
  };
};

export const updateFocus = (
  current: FocusState | null | undefined,
  params: FocusUpdateParams
): FocusState => {
  const base = statusFocus(current);
  const duration =
    params.durationMin !== undefined
      ? clampDuration(params.durationMin)
      : base.duration;
  const note = params.note !== undefined ? cleanNote(params.note) : base.note;
  const since =
    base._ === "active"
      ? (base.since ?? params.timestamp ?? new Date().toISOString())
      : base.since;

  return {
    _: base._,
    since,
    duration,
    note,
    sessions: base.sessions,
    last: base.last,
  };
};
