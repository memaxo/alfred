/**
 * @alfred/cognitive
 *
 * Cognitive state machine and flows
 *
 * Domain modules (preferred for new code):
 * - @alfred/cognitive/state - Core state types and factories
 * - @alfred/cognitive/autonomy - Autonomy gradient and Bayesian updates
 * - @alfred/cognitive/physiology - Physiological state management
 * - @alfred/cognitive/plan - Plan, Step, Risk, Decision types
 * - @alfred/cognitive/focus - Focus/productivity state machine
 * - @alfred/cognitive/util - Math utilities and branded types
 */

// Re-export domain modules for subpath imports
export * as autonomy from "./autonomy/index.js";
export * from "./flows.js";
export * as focus from "./focus/index.js";
export { type LoopConfig, LoopDetector, type LoopResult } from "./loop.js";
export * from "./metrics.js";
export * as physiology from "./physiology/index.js";
export * as plan from "./plan/index.js";
export * from "./schemas.js";
export * as state from "./state/index.js";
export * from "./state.js";
export * from "./transition.js";
export * as util from "./util/index.js";
