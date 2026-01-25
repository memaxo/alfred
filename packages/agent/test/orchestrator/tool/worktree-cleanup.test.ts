import { describe, expect, it, vi } from "bun:test";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  flushPreviewCleanupBacklog,
  worktreeManager,
} from "../../../src/orchestrator/tool/worktree";

const execFileAsync = promisify(execFile);

const sanitize = (value: string) => value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");

async function initRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "alfred-worktree-test-")
  );
  await execGit(["init", "-b", "main"], repoRoot);
  await execGit(["config", "user.email", "alfred@example.com"], repoRoot);
  await execGit(["config", "user.name", "Alfred"], repoRoot);
  await fs.writeFile(path.join(repoRoot, "README.md"), "root\n");
  await execGit(["add", "."], repoRoot);
  await execGit(["commit", "-m", "init"], repoRoot);
  await execGit(["checkout", "-b", "feature"], repoRoot);
  await fs.writeFile(path.join(repoRoot, "feature.txt"), "feature branch\n");
  await execGit(["add", "."], repoRoot);
  await execGit(["commit", "-m", "feature"], repoRoot);
  await execGit(["checkout", "main"], repoRoot);
  return repoRoot;
}

async function execGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.stat(candidate);
    return true;
  } catch {
    return false;
  }
}

describe("worktree preview cleanup", () => {
  it("cleans preview directories when setup fails", async () => {
    const repoRoot = await initRepo();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1111);
    const previewPath = path.join(
      repoRoot,
      ".agent/worktrees/__preview",
      `preview-${sanitize("feature")}-1111`
    );
    await fs.mkdir(previewPath, { recursive: true });
    await fs.writeFile(path.join(previewPath, "lock"), "locked");

    await expect(
      worktreeManager.safeMerge(repoRoot, "missing", "feature")
    ).rejects.toThrow(/Unable to resolve target branch/);

    expect(await pathExists(previewPath)).toBe(false);
    nowSpy.mockRestore();
  });

  it("flushes filesystem orphans even without tracked tickets", async () => {
    const repoRoot = await initRepo();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(3333);
    const previewPath = path.join(
      repoRoot,
      ".agent/worktrees/__preview",
      `preview-${sanitize("feature")}-3333`
    );
    await fs.mkdir(previewPath, { recursive: true });
    await fs.writeFile(path.join(previewPath, "orphan.txt"), "orphan");
    const cleaned = await flushPreviewCleanupBacklog(repoRoot);
    expect(cleaned).toBeGreaterThan(0);
    expect(await pathExists(previewPath)).toBe(false);
    nowSpy.mockRestore();
  });
});
