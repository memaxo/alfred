/**
 * Shared tool utilities
 *
 * This module exports shared functions for tool execution across
 * Codex, Droid, and other tools. No interfaces or abstract classes -
 * just pure functions following codebase rules.
 */

// Metrics utilities
export {
  createStageRecorder,
  type MetricTool,
  recordToolExecution,
  recordToolReasoning,
  startToolTimer,
  type ToolErrorStage,
} from "./metrics";
// Reasoning utilities
export {
  appendReasoningTrace,
  createReasoningAccumulator,
  extractReasoningText,
  persistReasoning,
  type ReasoningAccumulator,
} from "./reasoning";
// Subprocess utilities
export {
  appendOutput,
  assertAllowedDirectory,
  createOutputAccumulator,
  createTimeout,
  DEFAULT_ALLOW_PREFIXES,
  DEFAULT_TIMEOUT_SEC,
  getAccumulatedOutput,
  isWithinBase,
  MAX_TIMEOUT_SEC,
  MIN_TIMEOUT_SEC,
  OUTPUT_CAP_BYTES,
  type OutputAccumulator,
  resolveExecutable,
  safeRealpath,
  streamStderr,
  type TimeoutContext,
  type ToolWriter,
} from "./subprocess";
