import { logger } from "@alfred/logger";
import type { DirectoryHandle } from "../security/filesystem.js";
import { openDirectorySecure } from "../security/filesystem.js";
import { spawnWithSecureCwd } from "../security/secure-spawn.js";
import { toolCodex } from "./tool/codex/index.js";
import { worktreeManager } from "./tool/worktree.js";

export type ConflictResolution =
  | { status: "resolved"; resolvedBranch: string }
  | { status: "failed"; reason: string };

type ArbiterAuto = "medium" | "high";

async function runGit(cwdHandle: DirectoryHandle, args: string[]) {
  const proc = spawnWithSecureCwd({
    cwdHandle,
    cmd: "git",
    args,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout && typeof proc.stdout !== "number"
      ? new Response(proc.stdout).text()
      : Promise.resolve(""),
    proc.stderr && typeof proc.stderr !== "number"
      ? new Response(proc.stderr).text()
      : Promise.resolve(""),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

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
    userId?: string,
    auto?: ArbiterAuto
  ): Promise<ConflictResolution> => {
    const codexAuto: ArbiterAuto = auto ?? "high";
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
    const cwdHandle = openDirectorySecure(worktreePath, {
      allowedPrefixes: [repoRoot],
    });

    try {
      // 2. Attempt the merge to reproduce conflict in the worktree
      // This puts the worktree in a "conflict state" with markers.
      await runGit(cwdHandle, [
        "merge",
        "--no-commit",
        "--no-ff",
        sourceBranch,
      ]);

      // 3. Identify conflicting files
      const status = await runGit(cwdHandle, [
        "diff",
        "--name-only",
        "--diff-filter=U",
      ]);
      const conflictedFiles = status.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (conflictedFiles.length === 0) {
        // Weird, no conflicts found? Maybe it was a fast-forward or clean merge?
        // Commit and return.
        await commitResolution(cwdHandle, "Auto-resolved by Arbiter (Clean)");
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
          auto: codexAuto, // Arbiter needs to edit files
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
      const check = await runGit(cwdHandle, ["diff", "--check"]);

      if (check.exitCode !== 0) {
        return {
          status: "failed",
          reason: "Arbiter failed to remove all conflict markers",
        };
      }

      // 6. Commit
      await commitResolution(
        cwdHandle,
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
      cwdHandle.close();
      // Remove the worktree checkout, but keep the branch so merge execution can fast-forward
      // to the arbiter's resolution commit.
      await worktreeManager.remove(repoRoot, worktreePath, {
        keepBranch: true,
      });
    }
  },
};

async function commitResolution(cwdHandle: DirectoryHandle, message: string) {
  const res = await runGit(cwdHandle, [
    "commit",
    "--no-edit",
    "--allow-empty",
    "-m",
    message,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(res.stderr || res.stdout || "git_commit_failed");
  }
}
