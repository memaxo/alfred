import { feature } from "bun:bundle";
import { ContainerWorkspace } from "./container.js";
import type { Workspace, WorkspaceKind } from "./types.js";

/**
 * Options for workspace creation.
 *
 * Legacy options (poofProfile, poofMode, poofVerbose, enableSessions) are only
 * used when built with --feature=LEGACY_POOF or --feature=LEGACY_WORKTREE.
 */
export type WorkspaceFactoryOptions = {
  authz?: string;
  image?: string;
  enableSessions?: boolean;
  /** Resource profile for poof isolation (legacy) */
  poofProfile?: "minimal" | "standard" | "intensive";
  /** Poof mode: exec (ephemeral) or run (reviewable) (legacy) */
  poofMode?: "exec" | "run";
  /** Enable verbose poof output (legacy) */
  poofVerbose?: boolean;
};

/**
 * WorkspaceFactory creates isolated execution environments for agents.
 *
 * Production builds use Docker containers exclusively (default).
 * Development builds with feature flags can use legacy isolation methods:
 *   --feature=LEGACY_WORKTREE: Enable git worktree isolation
 *   --feature=LEGACY_POOF: Enable poof (overlayfs) isolation (Linux only)
 *
 * Container ownership: 1 container per workflow run, shared by all agents.
 */
export const WorkspaceFactory = {
  create: async (
    kind: WorkspaceKind,
    id: string,
    runId: string,
    repoBase: string,
    options?: WorkspaceFactoryOptions
  ): Promise<Workspace> => {
    // Feature-flagged legacy path: poof isolation (Linux only)
    // This code block is tree-shaken in production builds
    if (feature("LEGACY_POOF") && kind === "poof") {
      const { PoofWorkspace } = await import("./poof.js");
      const { POOF_PROFILES, isPoofAvailable } = await import(
        "../spawn/poof.js"
      );

      // Check if poof is available, fallback to container if not
      if (!isPoofAvailable()) {
        return new ContainerWorkspace(
          id,
          runId,
          repoBase,
          options?.image,
          options?.authz,
          options?.enableSessions
        );
      }

      return new PoofWorkspace(id, runId, repoBase, {
        profile: options?.poofProfile
          ? POOF_PROFILES[options.poofProfile]
          : undefined,
        mode: options?.poofMode,
        verbose: options?.poofVerbose,
      });
    }

    // Feature-flagged legacy path: git worktree isolation
    // This code block is tree-shaken in production builds
    if (
      feature("LEGACY_WORKTREE") &&
      (kind === "worktree" || kind === "host")
    ) {
      const { WorktreeWorkspace } = await import("./worktree.js");
      return new WorktreeWorkspace(id, runId, repoBase, {
        enableSessions: options?.enableSessions,
      });
    }

    // Default: Docker container isolation (always available)
    // All workspace kinds fall through to container in production builds
    return new ContainerWorkspace(
      id,
      runId,
      repoBase,
      options?.image,
      options?.authz,
      options?.enableSessions
    );
  },
};
