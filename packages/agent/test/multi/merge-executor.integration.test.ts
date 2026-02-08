import { createTestSandbox } from "@alfred/test-kit";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import { promisify } from "node:util";

import {
  type ConflictArbiterLike,
  executeMergePlan,
} from "../../src/orchestrator/multi/merge-executor";
import { worktreeManager } from "../../src/orchestrator/tool/worktree";

const execFileAsync = promisify(execFile);

interface MergePlan {
  strategy: "branch";
  branches: string[];
  targetBranch: string;
}

function git(cwd: string, args: string[]) {
  return execFileAsync("git", args, { cwd });
}

function readText(path: string) {
  return fs.readFile(path, "utf8");
}

function makeGitTool() {
  return {
    execute: async ({ input }: { input: any }) => {
      if (input.action !== "merge") {
        throw new Error(`unsupported_git_action:${String(input.action)}`);
      }
      const ref = String(input.ref);
      if (ref === "branch1") {
        await fs.writeFile(
          `${String(input.cw)}/conflict.txt`,
          "line1\nline2-branch1\n",
          "utf8"
        );
      }
      return { ok: true };
    },
  };
}

const resolveImpl = async (
  repoRoot: string,
  runId: string,
  targetBranch: string,
  sourceBranch: string
) => {
  const resolvedBranch = `agent/${runId}/arbiter-test`;
  // Resolve by picking a deterministic combined line.
  const filePath = `${repoRoot}/conflict.txt`;
  await fs.writeFile(filePath, "line1\nline2-resolved\n", "utf8");

  return { status: "resolved", resolvedBranch } as const;
};

const conflictResolveMock = mock(resolveImpl);

const mockArbiter: ConflictArbiterLike = {
  resolve: (...args: Parameters<typeof conflictResolveMock>) =>
    conflictResolveMock(...args) as any,
};

describe("executeMergePlan conflict arbiter integration", () => {
  let sandbox: ReturnType<typeof createTestSandbox>;
  let safeMergeSpy: ReturnType<typeof vi.spyOn> | null = null;
  beforeEach(() => {
    sandbox = createTestSandbox("merge-exec-");
    conflictResolveMock.mockReset();
    conflictResolveMock.mockImplementation(resolveImpl);
    safeMergeSpy = vi
      .spyOn(worktreeManager, "safeMerge")
      .mockImplementation(async (_repoRoot, _targetBranch, sourceBranch) => {
        if (sourceBranch === "branch1") {
          return { success: true, conflictFiles: [] };
        }
        return { success: false, conflictFiles: ["conflict.txt"] };
      });
  });

  afterEach(() => {
    safeMergeSpy?.mockRestore();
    safeMergeSpy = null;
    sandbox.cleanup();
  });

  it("resolves a merge conflict via arbiter and completes the merge plan (auto=medium)", async () => {
    const repoRoot = sandbox.dir;
    await git(repoRoot, ["init", "-b", "main"]);
    await git(repoRoot, ["config", "user.email", "alfred@example.com"]);
    await git(repoRoot, ["config", "user.name", "Alfred"]);

    await fs.writeFile(`${repoRoot}/conflict.txt`, "line1\nline2\n", "utf8");
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "init"]);

    await git(repoRoot, ["checkout", "-b", "branch1"]);
    await fs.writeFile(
      `${repoRoot}/conflict.txt`,
      "line1\nline2-branch1\n",
      "utf8"
    );
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "branch1"]);

    await git(repoRoot, ["checkout", "main"]);
    await git(repoRoot, ["checkout", "-b", "branch2"]);
    await fs.writeFile(
      `${repoRoot}/conflict.txt`,
      "line1\nline2-branch2\n",
      "utf8"
    );
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "branch2"]);

    await git(repoRoot, ["checkout", "main"]);

    const plan: MergePlan = {
      strategy: "branch",
      targetBranch: "main",
      branches: ["branch1", "branch2"],
    };

    const result = await executeMergePlan(
      plan as any,
      repoRoot,
      makeGitTool() as any,
      undefined,
      {
        runId: "run-merge-1",
        auto: "medium",
        arbiter: mockArbiter,
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      }
    );

    expect(result.status).toBe("completed");
    expect(result.mergedBranches).toEqual(["branch1", "branch2"]);
    expect(conflictResolveMock).toHaveBeenCalledTimes(1);

    const content = await readText(`${repoRoot}/conflict.txt`);
    expect(content).toBe("line1\nline2-resolved\n");
  });

  it("surfaces an escalation-grade conflict when arbiter fails (auto=high)", async () => {
    conflictResolveMock.mockImplementationOnce(async () => ({
      status: "failed",
      reason: "arbiter_could_not_resolve",
    }));

    const repoRoot = sandbox.dir;
    await git(repoRoot, ["init", "-b", "main"]);
    await git(repoRoot, ["config", "user.email", "alfred@example.com"]);
    await git(repoRoot, ["config", "user.name", "Alfred"]);

    await fs.writeFile(`${repoRoot}/conflict.txt`, "line1\nline2\n", "utf8");
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "init"]);

    await git(repoRoot, ["checkout", "-b", "branch1"]);
    await fs.writeFile(
      `${repoRoot}/conflict.txt`,
      "line1\nline2-branch1\n",
      "utf8"
    );
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "branch1"]);

    await git(repoRoot, ["checkout", "main"]);
    await git(repoRoot, ["checkout", "-b", "branch2"]);
    await fs.writeFile(
      `${repoRoot}/conflict.txt`,
      "line1\nline2-branch2\n",
      "utf8"
    );
    await git(repoRoot, ["add", "."]);
    await git(repoRoot, ["commit", "-m", "branch2"]);

    await git(repoRoot, ["checkout", "main"]);

    const plan: MergePlan = {
      strategy: "branch",
      targetBranch: "main",
      branches: ["branch1", "branch2"],
    };

    const result = await executeMergePlan(
      plan as any,
      repoRoot,
      makeGitTool() as any,
      undefined,
      {
        runId: "run-merge-2",
        auto: "high",
        arbiter: mockArbiter,
        containerName: "alfred-agentfs-test",
        containerCw: "/workspace",
      }
    );

    expect(result.status).toBe("conflict");
    expect(result.conflictBranch).toBe("branch2");
    expect(result.error).toContain("arbiter_failed:");

    const content = await readText(`${repoRoot}/conflict.txt`);
    expect(content).toBe("line1\nline2-branch1\n");
  });
});
