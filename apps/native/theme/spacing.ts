export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const TOUCH_TARGETS = {
  minimum: 44,
  comfortable: 48,
  large: 56,
} as const;

export const SAFE_AREA = {
  top: 47, // Dynamic Island / notch
  bottom: 34, // Home indicator
  horizontal: 16,
} as const;

export type Spacing = typeof SPACING;
export type Radii = typeof RADII;
export type TouchTargets = typeof TOUCH_TARGETS;
