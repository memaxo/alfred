/**
 * Cognitive State Machine
 * Pure algebraic data types with zero runtime overhead
 */

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
const timestamp = (n: number): Timestamp => n as Timestamp;
const confidence = (n: number): Confidence => {
  if (n < 0 || n > 1) throw new Error("Invalid confidence");
  return n as Confidence;
};
const autonomy = (n: number): Autonomy => {
  if (n < 0 || n > 1) throw new Error("Invalid autonomy");
  return n as Autonomy;
};

// Evidence for autonomy decisions
type Evidence =
  | { _: "success"; task: string; duration: number }
  | { _: "failure"; task: string; error: string }
  | { _: "feedback"; positive: boolean; strength: number }
  | { _: "override"; reason: string };

// Constraints on autonomy
type Constraint =
  | { _: "temporal"; until: Timestamp }
  | { _: "scope"; allowed: string[]; forbidden: string[] }
  | { _: "confidence"; minimum: Confidence }
  | { _: "approval"; required: boolean };

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

// Outcome of execution
export type Outcome =
  | { _: "success"; result: unknown; duration: number }
  | { _: "failure"; error: string; recoverable: boolean }
  | { _: "partial"; completed: string[]; failed: string[] }
  | { _: "cancelled"; reason: string };

// Main cognitive state ADT
export type CognitiveState =
  | { _: "idle"; since: Timestamp }
  | {
      _: "capturing";
      input: string;
      confidence: Confidence;
      started: Timestamp;
    }
  | {
      _: "thinking";
      about: string;
      depth: number;
      paths: Path[];
      reasoningTraces?: string[];
      started: Timestamp;
    }
  | {
      _: "deciding";
      options: Decision[];
      criteria: Criteria;
      weights: number[];
      deadline: Timestamp;
    }
  | {
      _: "executing";
      plan: Plan;
      step: number;
      auto: AutonomyGradient;
      started: Timestamp;
    }
  | {
      _: "reflecting";
      outcome: Outcome;
      expected: string;
      actual: string;
      error: number;
    };

// Autonomy gradient with Bayesian updates
export type AutonomyGradient = {
  level: Autonomy;
  confidence: Confidence;
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

// State factories
export const idle = (): CognitiveState => ({
  _: "idle",
  since: timestamp(Date.now()),
});

export const capturing = (input: string, conf: number): CognitiveState => ({
  _: "capturing",
  input,
  confidence: confidence(conf),
  started: timestamp(Date.now()),
});

export const thinking = (
  about: string,
  depth = 1,
  traces?: string[]
): CognitiveState => ({
  _: "thinking",
  about,
  depth: traces ? Math.max(depth, traces.length) : depth,
  paths: [],
  reasoningTraces: traces,
  started: timestamp(Date.now()),
});

export const deciding = (
  options: Decision[],
  criteria?: Criteria
): CognitiveState => ({
  _: "deciding",
  options,
  criteria: criteria || defaultCriteria(),
  weights: [0.4, 0.3, 0.2, 0.1], // safety, speed, accuracy, cost
  deadline: timestamp(Date.now() + 5000), // 5s decision timeout
});

export const executing = (
  plan: Plan,
  auto: AutonomyGradient
): CognitiveState => ({
  _: "executing",
  plan,
  step: 0,
  auto,
  started: timestamp(Date.now()),
});

export const reflecting = (
  outcome: Outcome,
  expected: string,
  actual: string
): CognitiveState => ({
  _: "reflecting",
  outcome,
  expected,
  actual,
  error: calculateError(expected, actual),
});

// Autonomy gradient management
export const initialAutonomy = (): AutonomyGradient => ({
  level: autonomy(0.3), // Start conservative
  confidence: confidence(0.5),
  evidence: [],
  constraints: [
    { _: "approval", required: true },
    { _: "confidence", minimum: confidence(0.7) },
  ],
  lastUpdate: timestamp(Date.now()),
});

export const updateAutonomy = (
  current: AutonomyGradient,
  evidence: Evidence
): AutonomyGradient => {
  const prior = current.level;
  const priorConfidence = current.confidence;

  // Bayesian update based on evidence
  const [newLevel, newConfidence] = bayesianUpdate(
    prior,
    priorConfidence,
    evidence
  );

  return {
    level: autonomy(Math.max(0, Math.min(1, newLevel))),
    confidence: confidence(Math.max(0, Math.min(1, newConfidence))),
    evidence: [...current.evidence.slice(-9), evidence], // Keep last 10
    constraints: current.constraints,
    lastUpdate: timestamp(Date.now()),
  };
};

// Helpers
const defaultCriteria = (): Criteria => ({
  safety: 1.0,
  speed: 0.7,
  accuracy: 0.9,
  cost: 0.5,
});

const calculateError = (expected: string, actual: string): number => {
  // TODO: Implement proper edit distance algorithm
  // Current implementation is character-by-character comparison
  // Should use:
  // - Levenshtein distance for string similarity
  // - Semantic similarity for meaning comparison
  // - Structured diff for JSON/object comparison
  // - Custom metrics for domain-specific errors
  if (expected === actual) return 0;
  const maxLen = Math.max(expected.length, actual.length);
  if (maxLen === 0) return 0;

  let distance = 0;
  for (let i = 0; i < maxLen; i++) {
    if (expected[i] !== actual[i]) distance++;
  }

  return distance / maxLen;
};

const bayesianUpdate = (
  priorLevel: number,
  priorConfidence: number,
  evidence: Evidence
): [number, number] => {
  // TODO: Implement proper Bayesian inference
  // Current implementation uses fixed deltas
  // Should:
  // - Use Beta distribution for probability updates
  // - Consider evidence strength and reliability
  // - Apply conjugate priors for efficiency
  // - Track likelihood ratios
  let levelDelta = 0;
  let confidenceBoost = 0.05;

  switch (evidence._) {
    case "success":
      levelDelta = 0.05; // Increase autonomy on success
      confidenceBoost = 0.1;
      break;
    case "failure":
      levelDelta = -0.1; // Decrease on failure
      confidenceBoost = -0.05;
      break;
    case "feedback":
      levelDelta = evidence.positive ? 0.03 : -0.03;
      levelDelta *= evidence.strength;
      break;
    case "override":
      levelDelta = -0.15; // Strong decrease on override
      confidenceBoost = -0.1;
      break;
  }

  const newLevel = priorLevel + levelDelta * priorConfidence;
  const newConfidence = priorConfidence + confidenceBoost;

  return [newLevel, newConfidence];
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
  if (avgLength > 50) score += 0.1;
  if (hasDecisionPoints) score += 0.15;
  if (hasAlternatives) score += 0.15;
  if (hasCausalReasoning) score += 0.1;

  const positive = outcome._ === "success";
  const strength = Math.min(1, score);

  return { _: "feedback", positive, strength };
};

// Constraint checking
export const meetsConstraints = (
  auto: AutonomyGradient,
  action: string
): boolean => {
  for (const constraint of auto.constraints) {
    switch (constraint._) {
      case "temporal":
        if (Date.now() > constraint.until) return false;
        break;
      case "scope":
        if (constraint.forbidden.includes(action)) return false;
        if (
          constraint.allowed.length > 0 &&
          !constraint.allowed.includes(action)
        )
          return false;
        break;
      case "confidence":
        if (auto.confidence < constraint.minimum) return false;
        break;
      case "approval":
        if (constraint.required && auto.level < 0.5) return false;
        break;
    }
  }
  return true;
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
  if (!note) return;
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
