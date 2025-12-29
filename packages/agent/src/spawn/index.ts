/**
 * Spawn module.
 *
 * Note: The poof (ephemeral filesystem) module has been removed.
 * Use AgentFS instead for agent filesystem isolation with audit trails.
 *
 * @see packages/agent/src/agentfs/ for the AgentFS implementation
 * @see packages/agent/src/environment/agentfs.ts for AgentFSWorkspace
 */

// This module previously exported poof-related utilities.
// These have been replaced by AgentFS. If you need:
// - Filesystem isolation: Use AgentFSWorkspace
// - Tool call auditing: Use AgentFS tool call recording
// - State snapshots: Use AgentFS checkpoints

// Re-export from agentfs for convenience
export type {
  AgentFSToolCall,
  AgentFSToolCallStats,
  AgentFSWorkspaceConfig,
} from "../agentfs/types.js";
