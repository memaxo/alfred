import * as fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "bun";

export type WorktreeHandle = {
  path: string;
  branch: string;
  baseRef: string;
};

type GitResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const WORKTREE_ROOT = ".agent/worktrees";
const META_FILENAME = ".alfred-worktree.json";

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function resolveWorktreePath(repoRoot: string, runId: string, agentId: string) {
  return path.join(
    repoRoot,
    WORKTREE_ROOT,
    sanitizeSegment(runId),
    sanitizeSegment(agentId)
  );
}

function resolveBranchName(runId: string, agentId: string) {
  return `agent/${sanitizeSegment(runId)}/${sanitizeSegment(agentId)}`;
}

async function runGit(cwd: string, args: string[]): Promise<GitResult> {
  const proc = spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function pathExists(candidate: string) {
  try {
    await fs.stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function removeDirSafe(candidate: string) {
  await fs.rm(candidate, { recursive: true, force: true }).catch(() => {});
}

async function writeMetadata(dir: string, meta: Record<string, unknown>) {
  await fs.writeFile(
    path.join(dir, META_FILENAME),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
}

async function readMetadata(
  dir: string
): Promise<{ branch?: string; baseRef?: string } | null> {
  try {
    const raw = await fs.readFile(path.join(dir, META_FILENAME), "utf8");
    return JSON.parse(raw) as { branch?: string; baseRef?: string };
  } catch {
    return null;
  }
}

async function collectConflictFiles(cwd: string) {
  const res = await runGit(cwd, ["diff", "--name-only", "--diff-filter=U"]);
  if (res.exitCode !== 0) {
    return [];
  }
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const worktreeManager = {
  /**
   * Create a new isolated worktree/branch tuple for the given agent.
   */
  create: async (
    repoRoot: string,
    runId: string,
    agentId: string,
    baseRef = "HEAD"
  ): Promise<WorktreeHandle> => {
    const branch = resolveBranchName(runId, agentId);
    const wtPath = resolveWorktreePath(repoRoot, runId, agentId);
    await fs.mkdir(path.dirname(wtPath), { recursive: true });

    if (await pathExists(wtPath)) {
      await runGit(repoRoot, ["worktree", "remove", "--force", wtPath]).catch(
        () => {}
      );
      await removeDirSafe(wtPath);
    }

    await runGit(repoRoot, ["branch", "-D", branch]).catch(() => {});

    const addResult = await runGit(repoRoot, [
      "worktree",
      "add",
      "-b",
      branch,
      wtPath,
      baseRef,
    ]);

    if (addResult.exitCode !== 0) {
      throw new Error(
        `Failed to create worktree ${branch}: ${addResult.stderr || addResult.stdout}`
      );
    }

    await writeMetadata(wtPath, {
      runId,
      agentId,
      branch,
      baseRef,
      createdAt: new Date().toISOString(),
    });

    return { path: wtPath, branch, baseRef };
  },

  /**
   * Remove all worktrees for the specified run id.
   */
  cleanup: async (repoRoot: string, runId: string) => {
    const runDir = path.join(repoRoot, WORKTREE_ROOT, sanitizeSegment(runId));
    if (!(await pathExists(runDir))) {
      return;
    }

    const entries = await fs.readdir(runDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(runDir, entry.name);
      await worktreeManager.remove(repoRoot, fullPath).catch(() => {});
    }

    await worktreeManager.prune(repoRoot);
    const residual = await fs.readdir(runDir).catch(() => []);
    if (residual.length === 0) {
      await removeDirSafe(runDir);
    }
  },

  /**
   * Remove a single worktree path and delete the associated branch if present.
   */
  remove: async (repoRoot: string, worktreePath: string) => {
    const meta = await readMetadata(worktreePath);
    await runGit(repoRoot, ["worktree", "remove", "--force", worktreePath]).catch(
      () => {}
    );
    await removeDirSafe(worktreePath);

    if (meta?.branch) {
      await runGit(repoRoot, ["branch", "-D", meta.branch]).catch(() => {});
    }
  },

  /**
   * Invoke git worktree prune to drop leftover references.
   */
  prune: async (repoRoot: string) => {
    await runGit(repoRoot, ["worktree", "prune", "--expire=now"]).catch(
      () => {}
    );
  },

  /**
   * Dry-run merge using a detached preview worktree to surface conflicts safely.
   */
  safeMerge: async (
    repoRoot: string,
    targetBranch: string,
    sourceBranch: string,
    options?: { runId?: string }
  ): Promise<{ success: boolean; conflictFiles: string[] }> => {
    const previewRoot = path.join(
      repoRoot,
      WORKTREE_ROOT,
      sanitizeSegment(options?.runId ?? "__preview")
    );
    const previewId = `preview-${sanitizeSegment(sourceBranch)}-${Date.now()}`;
    const previewPath = path.join(previewRoot, previewId);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    const resolvedTarget = await runGit(repoRoot, ["rev-parse", targetBranch]);
    if (resolvedTarget.exitCode !== 0 || !resolvedTarget.stdout) {
      throw new Error(
        `Unable to resolve target branch ${targetBranch}: ${resolvedTarget.stderr}`
      );
    }

    const addRes = await runGit(repoRoot, [
      "worktree",
      "add",
      "--detach",
      previewPath,
      resolvedTarget.stdout,
    ]);
    if (addRes.exitCode !== 0) {
      throw new Error(
        `Failed to prepare merge preview: ${addRes.stderr || addRes.stdout}`
      );
    }

    try {
      const mergeRes = await runGit(previewPath, [
        "merge",
        "--no-commit",
        "--no-ff",
        sourceBranch,
      ]);

      if (mergeRes.exitCode === 0) {
        await runGit(previewPath, ["reset", "--hard", "HEAD"]);
        return { success: true, conflictFiles: [] };
      }

      const conflictFiles = await collectConflictFiles(previewPath);
      await runGit(previewPath, ["merge", "--abort"]).catch(() =>
        runGit(previewPath, ["reset", "--hard", "HEAD"])
      );
      return { success: false, conflictFiles };
    } finally {
      await runGit(repoRoot, [
        "worktree",
        "remove",
        "--force",
        previewPath,
      ]).catch(() => {});
      await removeDirSafe(previewPath);
    }
  },
};
