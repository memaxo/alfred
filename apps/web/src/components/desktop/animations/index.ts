/**
 * Window Animation System
 *
 * Uses exponential decay for natural-feeling animations.
 * Respects prefers-reduced-motion accessibility preference.
 */

export { ANIMATION_CONFIG } from "./config";
export {
  useWindowAnimation,
  type WindowAnimationState,
} from "./use-window-animation";
