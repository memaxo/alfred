import { logger } from "@alfred/logger";
import { sys } from "../utils/process.js";
import { toolCodex } from "./tool/codex/index.js";
import { worktreeManager } from "./tool/worktree.js";

export type ConflictResolution =
  | { status: "resolved"; resolvedBranch: string }
  | { status: "failed"; reason: string };

export const conflictArbiter = {
  /**
   * Attempt to resolve a merge conflict between two branches using an Arbiter agent.
   */
  resolve: async (
    repoRoot: string,
    runId: string,
    targetBranch: string,
    sourceBranch: string,
    authz?: string,
    userId?: string
  ): Promise<ConflictResolution> => {
    const arbiterId = `arbiter-${Date.now().toString(36)}`;
    logger.info("arbiter_spawned", {
      runId,
      arbiterId,
      targetBranch,
      sourceBranch,
    });

    // 1. Create a temporary worktree for resolution (based on target branch)
    // We use the existing targetBranch as base.
    const worktreeHandle = await worktreeManager.create(
      repoRoot,
      runId,
      arbiterId,
      targetBranch
    );
    const worktreePath = worktreeHandle.path;

    try {
      // 2. Attempt the merge to reproduce conflict in the worktree
      // This puts the worktree in a "conflict state" with markers.
      const mergeProc = sys.spawn(
        ["git", "merge", "--no-commit", "--no-ff", sourceBranch],
        {
          cwd: worktreePath,
        }
      );
      await mergeProc.exited;

      // 3. Identify conflicting files
      const statusProc = sys.spawn(
        ["git", "diff", "--name-only", "--diff-filter=U"],
        {
          cwd: worktreePath,
          stdout: "pipe",
        }
      );
      const conflictedFiles = (await new Response(statusProc.stdout).text())
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (conflictedFiles.length === 0) {
        // Weird, no conflicts found? Maybe it was a fast-forward or clean merge?
        // Commit and return.
        await commitResolution(
          worktreePath,
          "Auto-resolved by Arbiter (Clean)"
        );
        return {
          status: "resolved",
          resolvedBranch: worktreeHandle.branch,
        };
      }

      // 4. Spawn Codex as Arbiter
      const prompt = `You are the Arbiter Agent. Your job is to resolve git merge conflicts.
The current working directory is in a detached HEAD state with merge conflicts from merging '${sourceBranch}' into '${targetBranch}'.

Conflicting files:
${conflictedFiles.map((f) => `- ${f}`).join("\n")}

INSTRUCTIONS:
1. Read each conflicting file.
2. Look for conflict markers (<<<<<<<, =======, >>>>>>>).
3. Edit the files to resolve the conflicts logically. Preserve the intent of both branches if possible.
4. Remove the markers.
5. Run 'git add <file>' for each resolved file.
6. DO NOT COMMIT. Just stage the changes.

If you cannot resolve a conflict safely, create a file 'ESCALATION.md' explaining why.`;

      const writer = {
        write: (chunk: unknown) => {
          // Swallow output or log debug
          if (
            typeof chunk === "object" &&
            chunk !== null &&
            "type" in chunk &&
            chunk.type === "stdout" &&
            "text" in chunk &&
            typeof chunk.text === "string"
          ) {
            process.stdout.write(chunk.text);
          }
        },
      };

      await toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          cw: worktreePath,
          auto: "high", // Arbiter needs to edit files
          sessionId: `session-${arbiterId}`,
          authz,
          out: "text",
          userId,
        },
        writer,
      });

      // 5. Verify Resolution
      // Check if conflict markers remain
      // Check if ESCLATION.md exists
      // Check if files are staged

      // Simple check: are there still unmerged files?
      const checkProc = sys.spawn(["git", "diff", "--check"], {
        cwd: worktreePath,
        stdout: "pipe", // if markers exist, it outputs info and exits non-zero
      });
      const checkExit = await checkProc.exited;

      if (checkExit !== 0) {
        return {
          status: "failed",
          reason: "Arbiter failed to remove all conflict markers",
        };
      }

      // 6. Commit
      await commitResolution(
        worktreePath,
        `Arbiter resolved merge of ${sourceBranch}`
      );

      // 7. Return the new branch/commit
      // The worktree is on a branch `agent/${runId}/${arbiterId}` (created by worktreeManager)
      // We just return that branch name.

      return {
        status: "resolved",
        resolvedBranch: worktreeHandle.branch,
      };
    } catch (error) {
      logger.error("arbiter_failed", { error: String(error) });
      return { status: "failed", reason: String(error) };
    } finally {
      // Cleanup worktree handled by caller or separate cleanup routine
      // Ideally we remove it here, but if we return the branch, we might want to keep it?
      // Actually, the branch exists in the repo. The worktree folder is just a checkout.
      // We can remove the folder.
      await worktreeManager.remove(repoRoot, worktreePath);
    }
  },
};

async function commitResolution(cwd: string, message: string) {
  const proc = sys.spawn(
    ["git", "commit", "--no-edit", "--allow-empty", "-m", message],
    { cwd }
  );
  await proc.exited;
}
