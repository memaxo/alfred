import { ContainerWorkspace } from "./container";
import type { Workspace } from "./types";
import { WorktreeWorkspace } from "./worktree";

export const WorkspaceFactory = {
  create: async (
    kind: "host" | "worktree" | "container",
    id: string,
    runId: string,
    repoBase: string,
    options?: {
      authz?: string;
      image?: string;
    }
  ): Promise<Workspace> => {
    switch (kind) {
      case "container":
        return new ContainerWorkspace(
          id,
          runId,
          repoBase,
          options?.image,
          options?.authz
        );
      case "worktree":
        return new WorktreeWorkspace(id, runId, repoBase);
      case "host":
        // Fallback to worktree for safety if 'host' requested in multi-agent?
        // Or implement a dummy HostWorkspace?
        // For now, map host -> worktree to enforce isolation.
        return new WorktreeWorkspace(id, runId, repoBase);
      default:
        throw new Error(`Unknown workspace kind: ${kind}`);
    }
  },
};
