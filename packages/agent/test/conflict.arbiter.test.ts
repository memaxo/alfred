import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createTestSandbox } from "@alfred/test-kit";
import { conflictArbiter } from "../src/orchestrator/conflict";
import { toolCodex } from "../src/orchestrator/tool/codex/index.js";

const execFileAsync = promisify(execFile);

async function execGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.stat(candidate);
    return true;
  } catch {
    return false;
  }
}

describe("conflictArbiter (integration)", () => {
  let sandbox: ReturnType<typeof createTestSandbox>;
  let repoRoot: string;

  const originalExecute = toolCodex.execute;

  beforeEach(async () => {
    sandbox = createTestSandbox("arbiter-");
    repoRoot = sandbox.dir;

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.email", "alfred@example.com"], repoRoot);
    await execGit(["config", "user.name", "Alfred"], repoRoot);

    await fs.writeFile(path.join(repoRoot, "conflict.txt"), "line1\nline2\n", "utf8");
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "init"], repoRoot);

    // Default Codex stub: do nothing (tests override as needed)
    toolCodex.execute = mock(async () => ({ ok: true })) as unknown as typeof toolCodex.execute;
  });

  afterEach(async () => {
    toolCodex.execute = originalExecute;
    sandbox.cleanup();
  });

  it("resolves a real merge conflict (auto=medium) and returns a branch that fast-forwards main", async () => {
    await execGit(["checkout", "-b", "branch1"], repoRoot);
    await fs.writeFile(
      path.join(repoRoot, "conflict.txt"),
      "line1\nline2-branch1\n",
      "utf8"
    );
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "branch1"], repoRoot);

    await execGit(["checkout", "main"], repoRoot);
    await fs.writeFile(
      path.join(repoRoot, "conflict.txt"),
      "line1\nline2-main\n",
      "utf8"
    );
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "main-change"], repoRoot);

    const codexCalls: unknown[] = [];
    const codexStub = mock(async ({ input }: { input: any }) => {
      codexCalls.push(input);
      const cw = String(input.cw);
      await fs.writeFile(path.join(cw, "conflict.txt"), "line1\nline2-resolved\n", "utf8");
      await execGit(["add", "conflict.txt"], cw);
      return { ok: true };
    });
    toolCodex.execute = codexStub as unknown as typeof toolCodex.execute;

    const result = await conflictArbiter.resolve(
      repoRoot,
      "run-1",
      "main",
      "branch1",
      undefined,
      undefined,
      "medium"
    );

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      throw new Error("expected resolved status");
    }

    expect(codexStub).toHaveBeenCalledTimes(1);
    const call = codexCalls.at(0) as { auto?: string } | undefined;
    expect(call?.auto).toBe("medium");

    // Fast-forward main to the arbiter merge commit
    await execGit(["checkout", "main"], repoRoot);
    await execGit(["merge", "--ff-only", result.resolvedBranch], repoRoot);

    const content = await readText(path.join(repoRoot, "conflict.txt"));
    expect(content).toBe("line1\nline2-resolved\n");

    // Worktree checkout should be removed (branch should remain)
    const arbiterId = result.resolvedBranch.split("/").at(2);
    const worktreePath = arbiterId
      ? path.join(repoRoot, ".agent", "worktrees", "run-1", arbiterId)
      : null;
    if (worktreePath) {
      expect(await pathExists(worktreePath)).toBe(false);
    }
  });

  it("does not invoke Codex when the merge is clean", async () => {
    await execGit(["checkout", "-b", "branch-clean"], repoRoot);
    await fs.writeFile(
      path.join(repoRoot, "conflict.txt"),
      "line1\nline2-clean\n",
      "utf8"
    );
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "clean"], repoRoot);

    await execGit(["checkout", "main"], repoRoot);

    const codexStub = mock(async () => ({ ok: true }));
    toolCodex.execute = codexStub as unknown as typeof toolCodex.execute;

    const result = await conflictArbiter.resolve(repoRoot, "run-2", "main", "branch-clean");

    expect(result.status).toBe("resolved");
    expect(codexStub).toHaveBeenCalledTimes(0);
  });

  it("returns failed when Codex throws and cleans up the worktree", async () => {
    await execGit(["checkout", "-b", "branch1"], repoRoot);
    await fs.writeFile(
      path.join(repoRoot, "conflict.txt"),
      "line1\nline2-branch1\n",
      "utf8"
    );
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "branch1"], repoRoot);

    await execGit(["checkout", "main"], repoRoot);
    await fs.writeFile(
      path.join(repoRoot, "conflict.txt"),
      "line1\nline2-main\n",
      "utf8"
    );
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "main-change"], repoRoot);

    const codexStub = mock(async () => {
      throw new Error("Codex crashed");
    });
    toolCodex.execute = codexStub as unknown as typeof toolCodex.execute;

    const result = await conflictArbiter.resolve(repoRoot, "run-3", "main", "branch1");

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("Codex crashed");
    }

    // Best-effort: confirm no worktree checkout remains under run-3
    const runPath = path.join(repoRoot, ".agent", "worktrees", "run-3");
    if (!(await pathExists(runPath))) {
      return;
    }
    const entries = await fs.readdir(runPath).catch(() => []);
    expect(entries.length).toBe(0);
  });
});
