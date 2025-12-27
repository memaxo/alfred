import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createTestSandbox } from "@alfred/test-kit";
import { conflictArbiter } from "../src/orchestrator/conflict";
import { toolCodex } from "../src/orchestrator/tool/codex/index.js";

const execFileAsync = promisify(execFile);

async function execGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

describe("Conflict Arbiter (smoke)", () => {
  let sandbox: ReturnType<typeof createTestSandbox>;
  let repoRoot: string;

  const originalExecute = toolCodex.execute;

  beforeEach(async () => {
    sandbox = createTestSandbox("arbiter-smoke-");
    repoRoot = sandbox.dir;

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.email", "alfred@example.com"], repoRoot);
    await execGit(["config", "user.name", "Alfred"], repoRoot);

    await fs.writeFile(path.join(repoRoot, "file.txt"), "base\n", "utf8");
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "init"], repoRoot);
  });

  afterEach(() => {
    toolCodex.execute = originalExecute;
    sandbox.cleanup();
  });

  it("returns resolved for a clean merge without invoking Codex", async () => {
    await execGit(["checkout", "-b", "branch-clean"], repoRoot);
    await fs.writeFile(path.join(repoRoot, "file.txt"), "clean\n", "utf8");
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "clean"], repoRoot);
    await execGit(["checkout", "main"], repoRoot);

    const codexStub = mock(async () => ({ ok: true }));
    toolCodex.execute = codexStub as unknown as typeof toolCodex.execute;

    const result = await conflictArbiter.resolve(
      repoRoot,
      "run-smoke",
      "main",
      "branch-clean"
    );

    expect(result.status).toBe("resolved");
    expect(codexStub).toHaveBeenCalledTimes(0);
  });
});
