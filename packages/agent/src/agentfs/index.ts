/**
 * AgentFS integration for ALFRED agent execution.
 *
 * AgentFS provides SQLite-based agent filesystem with:
 * - Audit trail: Every file operation and tool call recorded
 * - Reproducibility: Snapshot/restore agent state via db copy
 * - Learning integration: Tool call history feeds pattern extraction
 * - Copy-on-write: Overlay filesystem over host directories
 *
 * @module @alfred/agent/agentfs
 */

export * from "./learning-bridge.js";
export * from "./metrics.js";
export * from "./types.js";
export {
  AgentFSError,
  AlfredAgentFS,
  createEphemeralAgentFS,
  createRunAgentFS,
  isAgentFSAvailable,
} from "./wrapper.js";
