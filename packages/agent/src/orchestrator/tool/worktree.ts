import { logger } from "@alfred/logger";
import * as fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { openDirectorySecure } from "../../security/filesystem.js";
import { spawnWithSecureCwd } from "../../security/secure-spawn.js";

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
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
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

async function runGit(
  repoRoot: string,
  cwd: string,
  args: string[]
): Promise<GitResult> {
  const cwdHandle = openDirectorySecure(cwd, { allowedPrefixes: [repoRoot] });
  try {
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
  } finally {
    cwdHandle.close();
  }
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

async function collectConflictFiles(repoRoot: string, cwd: string) {
  const res = await runGit(repoRoot, cwd, [
    "diff",
    "--name-only",
    "--diff-filter=U",
  ]);
  if (res.exitCode !== 0) {
    return [];
  }
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type PreviewCleanupTicket = {
  repoRoot: string;
  path: string;
  attempts: number;
  registeredAt: number;
};

const previewCleanupBacklog = new Map<string, PreviewCleanupTicket>();

function ticketKey(repoRoot: string, previewPath: string): string {
  return `${repoRoot}::${previewPath}`;
}

function registerPreviewCleanup(
  repoRoot: string,
  previewPath: string
): PreviewCleanupTicket {
  const ticket: PreviewCleanupTicket = {
    repoRoot,
    path: previewPath,
    attempts: 0,
    registeredAt: Date.now(),
  };
  previewCleanupBacklog.set(ticketKey(repoRoot, previewPath), ticket);
  return ticket;
}

async function settlePreviewCleanup(
  ticket: PreviewCleanupTicket,
  context: string
): Promise<void> {
  const success = await cleanupPreviewPath(ticket.repoRoot, ticket.path);
  if (success) {
    previewCleanupBacklog.delete(ticketKey(ticket.repoRoot, ticket.path));
    return;
  }
  ticket.attempts += 1;
  previewCleanupBacklog.set(ticketKey(ticket.repoRoot, ticket.path), ticket);
  logger?.warn?.("preview_worktree_cleanup_pending", {
    path: ticket.path,
    attempts: ticket.attempts,
    context,
  });
}

async function cleanupPreviewPath(
  repoRoot: string,
  previewPath: string
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await runGit(repoRoot, repoRoot, [
      "worktree",
      "remove",
      "--force",
      previewPath,
    ]).catch(() => {});
    await removeDirSafe(previewPath);
    if (!(await pathExists(previewPath))) {
      return true;
    }
    await sleep(100 * (attempt + 1));
  }
  return !(await pathExists(previewPath));
}

export async function flushPreviewCleanupBacklog(
  repoRoot?: string
): Promise<number> {
  let cleaned = 0;
  for (const ticket of previewCleanupBacklog.values()) {
    if (repoRoot && ticket.repoRoot !== repoRoot) {
      continue;
    }
    if (await cleanupPreviewPath(ticket.repoRoot, ticket.path)) {
      previewCleanupBacklog.delete(ticketKey(ticket.repoRoot, ticket.path));
      cleaned += 1;
    }
  }
  if (repoRoot) {
    cleaned += await cleanupFilesystemPreviews(repoRoot);
  }
  return cleaned;
}

async function cleanupFilesystemPreviews(repoRoot: string): Promise<number> {
  const root = path.join(repoRoot, WORKTREE_ROOT);
  if (!(await pathExists(root))) {
    return 0;
  }
  let cleaned = 0;
  const runDirs = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  for (const runDir of runDirs) {
    if (!runDir.isDirectory()) {
      continue;
    }
    const runPath = path.join(root, runDir.name);
    const previews = await fs
      .readdir(runPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of previews) {
      if (!(entry.isDirectory() && entry.name.startsWith("preview-"))) {
        continue;
      }
      const previewPath = path.join(runPath, entry.name);
      if (await cleanupPreviewPath(repoRoot, previewPath)) {
        cleaned += 1;
      }
    }
  }
  return cleaned;
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
      await runGit(repoRoot, repoRoot, [
        "worktree",
        "remove",
        "--force",
        wtPath,
      ]).catch(() => {});
      await removeDirSafe(wtPath);
    }

    await runGit(repoRoot, repoRoot, ["branch", "-D", branch]).catch(() => {});

    const addResult = await runGit(repoRoot, repoRoot, [
      "worktree",
      "add",
      "--relative",
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
  remove: async (
    repoRoot: string,
    worktreePath: string,
    options?: { keepBranch?: boolean }
  ) => {
    const meta = await readMetadata(worktreePath);
    await runGit(repoRoot, repoRoot, [
      "worktree",
      "remove",
      "--force",
      worktreePath,
    ]).catch(() => {});
    await removeDirSafe(worktreePath);

    if (!options?.keepBranch && meta?.branch) {
      await runGit(repoRoot, repoRoot, ["branch", "-D", meta.branch]).catch(
        () => {}
      );
    }
  },

  /**
   * Invoke git worktree prune to drop leftover references.
   */
  prune: async (repoRoot: string) => {
    await runGit(repoRoot, repoRoot, [
      "worktree",
      "prune",
      "--expire=now",
    ]).catch(() => {});
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
    await flushPreviewCleanupBacklog(repoRoot);
    const previewRoot = path.join(
      repoRoot,
      WORKTREE_ROOT,
      sanitizeSegment(options?.runId ?? "__preview")
    );
    const previewId = `preview-${sanitizeSegment(sourceBranch)}-${Date.now()}`;
    const previewPath = path.join(previewRoot, previewId);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });
    const cleanupTicket = registerPreviewCleanup(repoRoot, previewPath);

    try {
      await cleanupPreviewPath(repoRoot, previewPath);

      const resolvedTarget = await runGit(repoRoot, repoRoot, [
        "rev-parse",
        targetBranch,
      ]);
      if (resolvedTarget.exitCode !== 0 || !resolvedTarget.stdout) {
        throw new Error(
          `Unable to resolve target branch ${targetBranch}: ${resolvedTarget.stderr}`
        );
      }

      const addRes = await runGit(repoRoot, repoRoot, [
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

      const mergeRes = await runGit(repoRoot, previewPath, [
        "merge",
        "--no-commit",
        "--no-ff",
        sourceBranch,
      ]);

      if (mergeRes.exitCode === 0) {
        await runGit(repoRoot, previewPath, ["reset", "--hard", "HEAD"]);
        return { success: true, conflictFiles: [] };
      }

      const conflictFiles = await collectConflictFiles(repoRoot, previewPath);
      await runGit(repoRoot, previewPath, ["merge", "--abort"]).catch(() =>
        runGit(repoRoot, previewPath, ["reset", "--hard", "HEAD"])
      );
      return { success: false, conflictFiles };
    } finally {
      await settlePreviewCleanup(cleanupTicket, "safe_merge_finalize");
    }
  },
};
