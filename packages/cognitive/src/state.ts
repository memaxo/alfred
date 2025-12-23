/**
 * Cognitive State Machine
 *
 * This file re-exports from domain-driven modules for backward compatibility.
 * New code should import directly from the specific domain modules:
 *
 * - @alfred/cognitive/state - Core state types and factories
 * - @alfred/cognitive/autonomy - Autonomy gradient and Bayesian updates
 * - @alfred/cognitive/physiology - Physiological state management
 * - @alfred/cognitive/plan - Plan, Step, Risk, Decision types
 * - @alfred/cognitive/focus - Focus/productivity state machine
 * - @alfred/cognitive/util - Math utilities and branded types
 */

// Utility exports
export {
  autonomy,
  clamp01,
  confidence,
  CONFIDENCE_DECAY_RATE,
  MS_PER_DAY,
  timestamp,
  type Autonomy,
  type Confidence,
  type Timestamp,
} from "./util/math.js";

// Plan domain exports
export {
  defaultCriteria,
  type Criteria,
  type Decision,
  type Outcome,
  type Path,
  type Plan,
  type Risk,
  type Step,
} from "./plan/types.js";

// Physiology exports
export {
  defaultPhysiology,
  updatePhysiology,
} from "./physiology/update.js";
export type { Physiology, PhysiologyEvent } from "./physiology/types.js";

// Autonomy exports
export {
  bayesianUpdate,
  betaMode,
  betaVariance,
  decayPriorTowardBaseline,
} from "./autonomy/bayesian.js";
export {
  DEFAULT_BETA_PRIOR,
  type AutonomyGradient,
  type BetaPrior,
  type Constraint,
  type Evidence,
} from "./autonomy/types.js";
export { initialAutonomy, updateAutonomy } from "./autonomy/update.js";
export {
  meetsConstraints,
  type ConstraintResult,
} from "./autonomy/constraint.js";

// State exports
export type { CognitiveState, Event } from "./state/types.js";
export {
  capturing,
  deciding,
  executing,
  idle,
  reflecting,
  thinking,
} from "./state/factory.js";
export {
  canInterrupt,
  duration,
  isActive,
  isExecuting,
  isStale,
  requiresInput,
} from "./state/predicate.js";
export { calculateError } from "./state/error.js";
export { evaluateReasoningQuality } from "./state/reasoning.js";

// Focus exports
export {
  FOCUS_MAX_DURATION,
  FOCUS_MIN_DURATION,
  type FocusStartParams,
  type FocusState,
  type FocusUpdateParams,
} from "./focus/types.js";
export {
  startFocus,
  statusFocus,
  stopFocus,
  updateFocus,
} from "./focus/machine.js";
