/**
 * Shared tool utilities
 *
 * This module exports shared functions for tool execution across
 * Codex, Droid, and other tools. No interfaces or abstract classes -
 * just pure functions following codebase rules.
 */

// Context types (unified execute signature)
export {
  AGENT_ESCALATION_REASONS,
  type AgentEscalationEvent,
  type AgentEscalationReason,
  isAgentEscalationEvent,
  type ToolExecuteArgs,
  type ToolExecuteContext,
  type ToolWriter,
} from "./context";
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
// Long-lived server registry (executor server profile)
export {
  type ExecProfile,
  ensureServer,
  isExecProfileStrict,
  normalizeExecProfile,
  resolveExecProfile,
  type ServerHandle,
  serverKey,
  stopAllServers,
  stopServer,
} from "./server";
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
} from "./subprocess";
