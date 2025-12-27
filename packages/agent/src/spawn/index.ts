/**
 * Poof ephemeral filesystem isolation module.
 *
 * Provides utilities for running commands in isolated environments
 * where filesystem changes can be captured, reviewed, and applied.
 */

// Diff utilities
export {
  applyUpperLayer,
  discardUpperLayer,
  formatChanges,
  generateDiff,
  hasChanges,
  type PoofChange,
  type PoofChangeSummary,
  type PoofChangeType,
  parseUpperLayer,
  summarizeChanges,
} from "./diff.js";
// Wave handoff utilities
export {
  createWaveHandoff,
  type WaveAgentResult,
  WaveHandoff,
  type WaveState,
} from "./handoff.js";
// Spawn utilities
export {
  cleanupUpperDir,
  createUpperDir,
  type IsolatedSpawnOptions,
  type IsolatedSpawnResult,
  spawnEphemeral,
  spawnIsolated,
  spawnReviewable,
} from "./isolated.js";
// Core types and utilities
export {
  buildPoofArgs,
  getPoofBinary,
  isCommandNotFound,
  isInsideSandbox,
  isPoofAvailable,
  isPoofTimeout,
  POOF_EXIT_CODES,
  POOF_PROFILES,
  POOF_SANDBOX_ENV,
  type PoofMode,
  type PoofProfile,
  type PoofProfileName,
  resetPoofCache,
  resolvePoofBinary,
} from "./poof.js";
