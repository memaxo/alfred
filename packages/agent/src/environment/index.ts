/**
 * Environment module exports for workspace management.
 */

export { ContainerWorkspace } from "./container.js";
export { WorkspaceFactory, type WorkspaceFactoryOptions } from "./factory.js";
export { PoofWorkspace, type PoofWorkspaceConfig } from "./poof.js";
export type {
  ExecOptions,
  ExecResult,
  Workspace,
  WorkspaceKind,
} from "./types.js";
export { WorktreeWorkspace } from "./worktree.js";
