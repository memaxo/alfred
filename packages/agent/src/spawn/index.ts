/**
 * Poof ephemeral filesystem isolation module.
 *
 * Provides utilities for running commands in isolated environments
 * where filesystem changes can be captured, reviewed, and applied.
 */

// Core types and utilities
export {
  type PoofMode,
  type PoofProfile,
  type PoofProfileName,
  POOF_PROFILES,
  POOF_EXIT_CODES,
  POOF_SANDBOX_ENV,
  isPoofAvailable,
  getPoofBinary,
  resolvePoofBinary,
  resetPoofCache,
  buildPoofArgs,
  isPoofTimeout,
  isCommandNotFound,
  isInsideSandbox,
} from "./poof.js";

// Spawn utilities
export {
  type IsolatedSpawnOptions,
  type IsolatedSpawnResult,
  spawnIsolated,
  spawnEphemeral,
  spawnReviewable,
  createUpperDir,
  cleanupUpperDir,
} from "./isolated.js";

// Diff utilities
export {
  type PoofChange,
  type PoofChangeType,
  type PoofChangeSummary,
  parseUpperLayer,
  summarizeChanges,
  generateDiff,
  applyUpperLayer,
  discardUpperLayer,
  formatChanges,
  hasChanges,
} from "./diff.js";

// Wave handoff utilities
export {
  type WaveAgentResult,
  type WaveState,
  WaveHandoff,
  createWaveHandoff,
} from "./handoff.js";
