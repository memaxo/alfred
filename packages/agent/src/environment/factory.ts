import type { Workspace, WorkspaceKind } from "./types.js";

/**
 * Options for workspace creation.
 */
export type WorkspaceFactoryOptions = {
  /** Enable AgentFS overlay mode (copy-on-write) */
  agentfsOverlay?: boolean;
  /** Custom AgentFS database path */
  agentfsDbPath?: string;
  /** Docker image to use (default: node:18-slim) */
  image?: string;
  /** Authorization token for Docker operations */
  authz?: string;
  /** Override Docker container name (default: per-run) */
  containerName?: string;
  /** Keep container around on cleanup (for project-scoped reuse) */
  retainContainer?: boolean;
  /** Optional project attachment for container tracking */
  projectId?: string;
  /** Container kind for project attachment tracking */
  containerKind?: string;
};

/**
 * WorkspaceFactory creates AgentFS execution environments inside Docker.
 *
 * AgentFS provides SQLite-based audit trail inside Docker containers.
 * Docker provides process isolation, resource limits, and security.
 */
export const WorkspaceFactory = {
  create: async (
    _kind: WorkspaceKind,
    id: string,
    runId: string,
    repoBase: string,
    options?: WorkspaceFactoryOptions
  ): Promise<Workspace> => {
    const { AgentFSWorkspace } = await import("./agentfs.js");
    return new AgentFSWorkspace(id, runId, repoBase, {
      overlay: options?.agentfsOverlay,
      dbPath: options?.agentfsDbPath,
      image: options?.image,
      authz: options?.authz,
      containerName: options?.containerName,
      retainContainer: options?.retainContainer,
      projectId: options?.projectId,
      containerKind: options?.containerKind,
    });
  },
};
