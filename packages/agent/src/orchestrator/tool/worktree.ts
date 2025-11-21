import { spawn } from "bun";
import { existsSync } from "node:fs";
import path from "node:path";

export const worktreeManager = {
  /**
   * Create a new worktree for an agent.
   * Uses a detached branch or a new branch off HEAD.
   */
  create: async (repoRoot: string, runId: string, agentId: string, baseRef = "HEAD") => {
    const worktreePath = path.join(repoRoot, ".agent", "worktrees", runId, agentId);
    const branchName = `agent/${runId}/${agentId}`;
    
    // Ensure .agent/worktrees is ignored or safe
    // Ideally this should be outside the main tree, but inside .agent is convenient if ignored.
    // We assume .agent is in .gitignore (it usually is for AI tools).
    
    if (existsSync(worktreePath)) {
      return worktreePath;
    }

    // Create worktree
    // git worktree add -b <branch> <path> <commit>
    const proc = spawn(["git", "worktree", "add", "-b", branchName, worktreePath, baseRef], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      // Fallback: maybe branch exists? try checkout
      if (stderr.includes("already exists")) {
         const proc2 = spawn(["git", "worktree", "add", worktreePath, branchName], {
            cwd: repoRoot,
         });
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
  cleanup: async (repoRoot: string, runId: string) => {
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
    if (!existsSync(worktreePath)) return;
    
    const proc = spawn(["git", "worktree", "remove", "--force", worktreePath], {
        cwd: repoRoot,
        stdout: "ignore",
        stderr: "pipe",
    });
    
    await proc.exited;
  }
};
