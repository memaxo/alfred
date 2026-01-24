import { Easing } from "react-native-reanimated";

export const EASING = {
  standard: Easing.bezier(0.25, 0.1, 0.25, 1),
  enter: Easing.bezier(0, 0, 0.2, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
  emphasis: Easing.bezier(0.34, 1.56, 0.64, 1),
  breathe: Easing.bezier(0.25, 0.4, 0.25, 1),
  sharp: Easing.bezier(0.4, 0, 0.6, 1),
} as const;

export const DURATION = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
  breathe: 4000,
  pulse: 2000,
  rotate: 3000,
} as const;

export const SPRING_CONFIG = {
  default: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
  gentle: {
    damping: 20,
    stiffness: 100,
    mass: 1,
  },
  bouncy: {
    damping: 10,
    stiffness: 200,
    mass: 0.8,
  },
  stiff: {
    damping: 25,
    stiffness: 300,
    mass: 1,
  },
} as const;

export type EasingType = keyof typeof EASING;
export type DurationType = keyof typeof DURATION;
export type SpringConfigType = keyof typeof SPRING_CONFIG;
