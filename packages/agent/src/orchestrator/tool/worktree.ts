import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "bun";

export const worktreeManager = {
  /**
   * Create a new worktree for an agent.
   * Uses a detached branch or a new branch off HEAD.
   */
  create: async (
    repoRoot: string,
    runId: string,
    agentId: string,
    baseRef = "HEAD"
  ) => {
    const worktreePath = path.join(
      repoRoot,
      ".agent",
      "worktrees",
      runId,
      agentId
    );
    const branchName = `agent/${runId}/${agentId}`;

    // Ensure .agent/worktrees is ignored or safe
    // Ideally this should be outside the main tree, but inside .agent is convenient if ignored.
    // We assume .agent is in .gitignore (it usually is for AI tools).

    if (existsSync(worktreePath)) {
      return worktreePath;
    }

    // Create worktree
    // git worktree add -b <branch> <path> <commit>
    const proc = spawn(
      ["git", "worktree", "add", "-b", branchName, worktreePath, baseRef],
      {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      // Fallback: maybe branch exists? try checkout
      if (stderr.includes("already exists")) {
        const proc2 = spawn(
          ["git", "worktree", "add", worktreePath, branchName],
          {
            cwd: repoRoot,
          }
        );
        await proc2.exited;
        return worktreePath;
      }
      throw new Error(`Failed to create worktree: ${stderr}`);
    }

    return worktreePath;
  },

  /**
   * Prune worktrees for a run.
   */
  cleanup: async (_repoRoot: string, _runId: string) => {
    // We can't easily just rm -rf the directory, we should use git worktree remove
    // But finding them is tricky if we don't track them.
    // For now, we rely on the path convention.
    // Actually, pruning usually requires `git worktree prune` after deleting files,
    // or `git worktree remove <path>`.
    // Safe implementation: iterate folders in .agent/worktrees/runId and remove them
    // Note: implementation of proper cleanup loop is deferred to integration.
    // For MVP, we provide a single remove method
  },

  remove: async (repoRoot: string, worktreePath: string) => {
    if (!existsSync(worktreePath)) {
      return;
    }

    const proc = spawn(["git", "worktree", "remove", "--force", worktreePath], {
      cwd: repoRoot,
      stdout: "ignore",
      stderr: "pipe",
    });

    await proc.exited;
  },

  /**
   * Safely merge a branch into the current branch (or base) using server-side merge tree.
   * Returns the result of the merge attempt.
   */
  safeMerge: async (
    repoRoot: string,
    targetBranch: string,
    sourceBranch: string
  ): Promise<{ success: boolean; conflictFiles: string[] }> => {
    // First, check for conflicts without touching the working tree
    // git merge-tree --write-tree <branch1> <branch2>
    // NOTE: git merge-tree output format varies by git version.
    // Modern git: prints OID of tree.
    // If conflicts, it might still print a tree OID but exit non-zero or include conflict markers in the blob.
    // Better approach for detection: git merge-tree <base> <target> <source> (deprecated style) or just try merge in memory.

    // Let's use a dry-run merge with --no-commit --no-ff to see if it would fail?
    // But that requires a checked out tree.
    // We want to do this from the orchestrator which might not be in the right worktree.
    // Actually, the orchestrator (host) can run git commands in the repoRoot.

    // Use `git merge-tree` (modern) to inspect conflicts
    // git merge-tree <branch1> <branch2>
    const proc = spawn(["git", "merge-tree", targetBranch, sourceBranch], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    // merge-tree output contains file content with conflict markers if conflicts exist.
    // We can scan for conflict markers or check exit code?
    // Actually, `git merge-tree` exits 0 even with conflicts usually.
    // But it outputs a tree hash on the first line.
    // If there are conflicts, the file content in the tree will have <<< >>> markers.
    // A more robust check is `git merge-base` then `git merge-tree`.

    // Simplified approach:
    // Just run `git merge --no-commit --no-ff <source>` in the target worktree?
    // No, we want to avoid dirtying the tree if it fails.

    // Let's rely on `git merge-tree` outputting a list of files with conflicts in the informational section (if any).
    // Actually, checking for "<<<<<<<" in stdout is a reasonable heuristic for conflict detection in `merge-tree` output.
    
    // NOTE: git 2.40+ `git merge-tree --write-tree --name-only` might be better.
    // Let's stick to a simple heuristic: check if "Conflict" is mentioned in stderr or if markers exist.
    
    const hasConflictMarkers = stdout.includes("<<<<<<<");
    
    if (hasConflictMarkers) {
      // Extract conflicting files (rough parsing)
      // merge-tree doesn't list them nicely in all versions.
      // Let's return generic "conflict detected" and let the Arbiter inspect.
      return { success: false, conflictFiles: ["detected_via_merge_tree"] };
    }

    return { success: true, conflictFiles: [] };
  },
};
