 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }/**
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












// Brand constructors
export const timestamp = (n) => {
  if (!Number.isFinite(n)) {
    throw new Error("Timestamp must be a finite number");
  }
  if (n < 0) {
    throw new Error("Timestamp cannot be negative");
  }
  return n ;
};
const confidence = (n) => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid confidence");
  }
  return n ;
};
export const autonomy = (n) => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid autonomy");
  }
  return n ;
};

// Evidence for autonomy decisions





















































































































































// Physiology Defaults
const defaultPhysiology = () => ({
  energy: 1.0,
  boredom: 0.0,
  frustration: 0.0,
});

// State factories
export const idle = (now, phy) => ({
  _: "idle",
  since: timestamp(now),
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

export const capturing = (
  now,
  input,
  conf,
  phy
) => ({
  _: "capturing",
  input,
  confidence: confidence(conf),
  started: timestamp(now),
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

export const thinking = (
  now,
  about,
  depth = 1,
  traces,
  phy
) => ({
  _: "thinking",
  about,
  depth: traces ? Math.max(depth, traces.length) : depth,
  paths: [],
  reasoningTraces: traces,
  started: timestamp(now),
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

export const deciding = (
  now,
  options,
  criteria,
  phy
) => ({
  _: "deciding",
  options,
  criteria: criteria || defaultCriteria(),
  weights: [0.4, 0.3, 0.2, 0.1], // safety, speed, accuracy, cost
  deadline: timestamp(now + 5000), // 5s decision timeout
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

export const executing = (
  now,
  plan,
  auto,
  phy
) => ({
  _: "executing",
  plan,
  step: 0,
  auto,
  started: timestamp(now),
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

export const reflecting = (
  outcome,
  expected,
  actual,
  phy
) => ({
  _: "reflecting",
  outcome,
  expected,
  actual,
  error: calculateError(expected, actual),
  physiology: _nullishCoalesce(phy, () => ( defaultPhysiology())),
});

// Physiology Logic
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const CONFIDENCE_DECAY_RATE = 0.95; // per day decay multiplier
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_BETA_PRIOR = Object.freeze({ alpha: 2, beta: 5 });
var betaMode = ({ alpha, beta }) => {
  if (alpha <= 1 || beta <= 1) {
    return alpha / (alpha + beta);
  }
  return (alpha - 1) / (alpha + beta - 2);
};

var betaVariance = ({ alpha, beta }) => {
  const sum = alpha + beta;
  if (sum <= 0) {
    return 0;
  }
  return (alpha * beta) / (sum * sum * (sum + 1));
};

export const updatePhysiology = (
  current,
  event
) => {
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
    // Keep production warnings, but avoid noisy perf-test output.
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.01) {
      console.warn(
        `cognitive_budget_exceeded: physiology update took ${durationMs.toFixed(
          4
        )}ms`
      );
    }
  }
};

// Autonomy gradient management
export const initialAutonomy = (now) => {
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
  now,
  current,
  evidence,
  physiology
) {
  const start = performance.now();

  try {
    const reliability = clamp01(_nullishCoalesce(evidence.reliability, () => ( 1)));
    if (reliability === 0) {
      return current;
    }

    const normalizedEvidence =
      reliability === (_nullishCoalesce(evidence.reliability, () => ( 1)))
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
    // Keep production warnings, but avoid noisy perf-test output.
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.05) {
      console.warn(
        `cognitive_budget_exceeded: autonomy update took ${durationMs.toFixed(
          4
        )}ms`
      );
    }
  }
}

// Helpers
const defaultCriteria = () => ({
  safety: 1.0,
  speed: 0.7,
  accuracy: 0.9,
  cost: 0.5,
});

export const calculateError = (expected, actual) => {
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
    let currRow = new Array(shorter.length + 1);

    for (let i = 1; i <= longer.length; i++) {
      currRow[0] = i;
      const longChar = longer.charCodeAt(i - 1);

      for (let j = 1; j <= shorter.length; j++) {
        const cost = longChar === shorter.charCodeAt(j - 1) ? 0 : 1;
        const insertion = currRow[j - 1] + 1;
        const deletion = prevRow[j] + 1;
        const substitution = prevRow[j - 1] + cost;
        currRow[j] = Math.min(insertion, deletion, substitution);
      }

      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[shorter.length] / maxLen;
  } finally {
    const durationMs = performance.now() - start;
    cognitiveErrorCalculationDuration.observe(durationMs / 1000);
    // Keep production warnings, but avoid noisy perf-test output.
    const shouldWarn = process.env.NODE_ENV !== "test";
    if (shouldWarn && durationMs > 0.1) {
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
  now,
  lastUpdate,
  prior
) => {
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
  now,
  prior,
  evidence,
  lastUpdate
) => {
  const decayed = decayPriorTowardBaseline(now, lastUpdate, prior);
  const reliability = clamp01(_nullishCoalesce(evidence.reliability, () => ( 1)));

  const posterior = { ...decayed };

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
  traces,
  outcome
) => {
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
  auto,
  action,
  physiology
) => {
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
export const isActive = (state) => state._ !== "idle";

export const canInterrupt = (state) =>
  state._ === "thinking" || state._ === "deciding";

export const requiresInput = (state) =>
  state._ === "idle" || state._ === "reflecting";

export const isExecuting = (state) =>
  state._ === "executing";

// Time-based state properties
export const duration = (state) => {
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

export const isStale = (state, threshold = 30000) =>
  duration(state) > threshold;

// ======================================
// Focus State Machine (productivity mode)
// ======================================

 
























const FOCUS_MIN_DURATION = 5;
const FOCUS_MAX_DURATION = 12 * 60;

function clampDuration(duration) {
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

function cleanNote(note) {
  if (!note) {
    return;
  }
  const trimmed = note.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, 280);
}

export const statusFocus = (
  state
) => {
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
  current,
  params
) => {
  const now = _nullishCoalesce(params.since, () => ( new Date().toISOString()));
  const duration = clampDuration(_nullishCoalesce(params.durationMin, () => ( _optionalChain([current, 'optionalAccess', _2 => _2.duration]))));
  const note = cleanNote(_nullishCoalesce(params.note, () => ( _optionalChain([current, 'optionalAccess', _3 => _3.note]))));
  const sessions = (_nullishCoalesce(_optionalChain([current, 'optionalAccess', _4 => _4.sessions]), () => ( 0))) + 1;
  return {
    _: "active",
    since: now,
    duration,
    note,
    sessions,
    last: _optionalChain([current, 'optionalAccess', _5 => _5.last]),
  };
};

export const stopFocus = (
  current
) => {
  if (!current) {
    return { _: "idle" };
  }
  const timestamp = new Date().toISOString();
  const started = _nullishCoalesce(current.since, () => ( timestamp));
  const elapsedMs = Date.parse(timestamp) - Date.parse(started);
  const duration = Math.max(1, Math.round(elapsedMs / 60000));
  return {
    _: "idle",
    duration: _nullishCoalesce(current.duration, () => ( duration)),
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
  current,
  params
) => {
  const base = statusFocus(current);
  const duration =
    params.durationMin !== undefined
      ? clampDuration(params.durationMin)
      : base.duration;
  const note = params.note !== undefined ? cleanNote(params.note) : base.note;
  const since =
    base._ === "active"
      ? (_nullishCoalesce(_nullishCoalesce(base.since, () => ( params.timestamp)), () => ( new Date().toISOString())))
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
