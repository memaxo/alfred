/**
 * Environment module exports for workspace management.
 */

export type { ExecOptions, ExecResult, Workspace, WorkspaceKind } from "./types.js";
export { ContainerWorkspace } from "./container.js";
export { PoofWorkspace, type PoofWorkspaceConfig } from "./poof.js";
export { WorktreeWorkspace } from "./worktree.js";
export { WorkspaceFactory, type WorkspaceFactoryOptions } from "./factory.js";
