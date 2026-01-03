/**
 * ALFRED Orb Component
 *
 * Neural orb visualization for the voice call experience.
 */

export {
  ALFRED_COLORS,
  ANIMATION,
  ORB_SIZES,
  ORB_STATES,
  type OrbState,
} from "./constants";
export { ControlBar } from "./control-bar";
export { useOrbState } from "./hooks/use-orb-state";
export { usePerformanceConfig } from "./hooks/use-performance";
export { Orb, type OrbProps } from "./orb";
