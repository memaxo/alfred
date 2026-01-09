/**
 * Animation Configuration
 *
 * Exponential decay constants for window animations.
 * decay = e^(-t/tau) where tau controls the decay rate
 */

export const ANIMATION_CONFIG = {
  // Exponential decay time constants (lower = faster)
  spawn: {
    stiffness: 400,
    damping: 30,
  },
  close: {
    stiffness: 500,
    damping: 35,
  },
  resize: {
    stiffness: 300,
    damping: 28,
  },
  tile: {
    stiffness: 350,
    damping: 30,
  },
  // Duration fallbacks for CSS transitions (ms)
  duration: {
    spawn: 200,
    close: 150,
    resize: 180,
    tile: 200,
  },
} as const;
