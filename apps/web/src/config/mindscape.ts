/**
 * Mindscape configuration constants.
 * Centralized to ensure consistency across components.
 */
export const MINDSCAPE_CONFIG = {
  /** Radius for radial node positioning around parent */
  SPAWN_RADIUS: 260,

  /** Tier-based spawn distances from singularity */
  TIER_RADII: {
    primary: 200,
    secondary: 350,
    tertiary: 500,
  },

  /** Spacing between rings in the same tier */
  RING_SPACING: 80,

  /** Max nodes per ring */
  NODES_PER_RING: {
    secondary: 8,
    tertiary: 12,
  },
} as const;
