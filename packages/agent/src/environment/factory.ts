import { ContainerWorkspace } from "./container";
import type { Workspace } from "./types";
import { WorktreeWorkspace } from "./worktree";

export const WorkspaceFactory = {
  create: (
    kind: "host" | "worktree" | "container",
    id: string,
    runId: string,
    repoBase: string,
    options?: {
      authz?: string;
      image?: string;
      enableSessions?: boolean;
    }
  ): Promise<Workspace> => {
    switch (kind) {
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
