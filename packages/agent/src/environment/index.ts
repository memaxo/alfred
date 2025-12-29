/**
 * Environment module exports for workspace management.
 *
 * AgentFS is the only supported workspace type, providing
 * SQLite-based isolation with full audit trail.
 */

export type { AgentFSWorkspaceConfig } from "../agentfs/types.js";
export { AgentFSWorkspace, isAgentFSWorkspace } from "./agentfs.js";
export { WorkspaceFactory, type WorkspaceFactoryOptions } from "./factory.js";

export type {
  ExecOptions,
  ExecResult,
  Workspace,
  WorkspaceKind,
} from "./types.js";
