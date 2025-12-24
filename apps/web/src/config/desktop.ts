/**
 * Desktop configuration constants.
 * Centralized to ensure consistency across components.
 */
export const DESKTOP_CONFIG = {
  /** Radius for radial window positioning around parent */
  SPAWN_RADIUS: 260,

  /** Tier-based spawn distances from center */
  TIER_RADII: {
    primary: 200,
    secondary: 350,
    tertiary: 500,
  },

  /** Spacing between rings in the same tier */
  RING_SPACING: 80,

  /** Max windows per ring */
  WINDOWS_PER_RING: {
    secondary: 8,
    tertiary: 12,
  },
} as const;

/** @deprecated Use DESKTOP_CONFIG instead */
export const MINDSCAPE_CONFIG = DESKTOP_CONFIG;
