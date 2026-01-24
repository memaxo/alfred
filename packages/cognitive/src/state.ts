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

// Autonomy exports
export {
  bayesianUpdate,
  betaMode,
  betaVariance,
  decayPriorTowardBaseline,
} from "./autonomy/bayesian.js";
export {
  type ConstraintResult,
  meetsConstraints,
} from "./autonomy/constraint.js";
export {
  type AutonomyGradient,
  type BetaPrior,
  type Constraint,
  DEFAULT_BETA_PRIOR,
  type Evidence,
} from "./autonomy/types.js";
export { initialAutonomy, updateAutonomy } from "./autonomy/update.js";
export {
  startFocus,
  statusFocus,
  stopFocus,
  updateFocus,
} from "./focus/machine.js";
// Focus exports
export {
  FOCUS_MAX_DURATION,
  FOCUS_MIN_DURATION,
  type FocusStartParams,
  type FocusState,
  type FocusUpdateParams,
} from "./focus/types.js";
export type { Physiology, PhysiologyEvent } from "./physiology/types.js";
// Physiology exports
export { defaultPhysiology, updatePhysiology } from "./physiology/update.js";
// Plan domain exports
export {
  type Criteria,
  type Decision,
  defaultCriteria,
  type Outcome,
  type Path,
  type Plan,
  type Risk,
  type Step,
} from "./plan/types.js";
export { calculateError } from "./state/error.js";
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
export { evaluateReasoningQuality } from "./state/reasoning.js";
// State exports
export type { CognitiveState, Event } from "./state/types.js";
// Utility exports
export {
  type Autonomy,
  autonomy,
  CONFIDENCE_DECAY_RATE,
  type Confidence,
  clamp01,
  confidence,
  MS_PER_DAY,
  type Timestamp,
  timestamp,
} from "./util/math.js";
