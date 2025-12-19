import { ContainerWorkspace } from "./container.js";
import { PoofWorkspace } from "./poof.js";
import type { Workspace, WorkspaceKind } from "./types.js";
import { WorktreeWorkspace } from "./worktree.js";
import {
  type PoofProfileName,
  POOF_PROFILES,
  isPoofAvailable,
} from "../spawn/poof.js";

/** Options for workspace creation */
export interface WorkspaceFactoryOptions {
  authz?: string;
  image?: string;
  enableSessions?: boolean;
  /** Resource profile for poof isolation */
  poofProfile?: PoofProfileName;
  /** Poof mode: exec (ephemeral) or run (reviewable) */
  poofMode?: "exec" | "run";
  /** Enable verbose poof output */
  poofVerbose?: boolean;
}

export const WorkspaceFactory = {
  create: (
    kind: WorkspaceKind,
    id: string,
    runId: string,
    repoBase: string,
    options?: WorkspaceFactoryOptions
  ): Promise<Workspace> => {
    switch (kind) {
      case "poof": {
        // Check if poof is available, fallback to worktree if not
        if (!isPoofAvailable()) {
          console.warn(
            `poof not available (platform: ${process.platform}), falling back to worktree`
          );
          return Promise.resolve(
            new WorktreeWorkspace(id, runId, repoBase, {
              enableSessions: options?.enableSessions,
            })
          );
        }
        return Promise.resolve(
          new PoofWorkspace(id, runId, repoBase, {
            profile: options?.poofProfile
              ? POOF_PROFILES[options.poofProfile]
              : undefined,
            mode: options?.poofMode,
            verbose: options?.poofVerbose,
          })
        );
      }
      case "container":
        return Promise.resolve(
          new ContainerWorkspace(
            id,
            runId,
            repoBase,
            options?.image,
            options?.authz,
            options?.enableSessions
          )
        );
      case "worktree":
        return Promise.resolve(
          new WorktreeWorkspace(id, runId, repoBase, {
            enableSessions: options?.enableSessions,
          })
        );
      case "host":
        // Fallback to worktree for safety if 'host' requested in multi-agent?
        // Or implement a dummy HostWorkspace?
        // For now, map host -> worktree to enforce isolation.
        return Promise.resolve(
          new WorktreeWorkspace(id, runId, repoBase, {
            enableSessions: options?.enableSessions,
          })
        );
      default:
        return Promise.reject(new Error(`Unknown workspace kind: ${kind}`));
    }
  },
};
