/**
 * Conflict Arbiter Test Suite
 *
 * Tests for the conflictArbiter module that handles multi-agent merge conflicts
 * by spawning an arbiter agent (Codex) to resolve git merge conflicts.
 *
 * Run: bun test conflict.arbiter.test.ts
 */
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { sys } from "../src/utils/process";

// Track mock calls for cleanup verification
let worktreeCreateCalls: unknown[] = [];
let worktreeRemoveCalls: unknown[] = [];
let codexExecuteCalls: unknown[] = [];

// Mock dependencies
const mockWorktreeCreate = mock(
  (_repo: string, runId: string, agentId: string, baseRef?: string) => {
    const handle = {
      path: `/tmp/mock-worktree/${runId}/${agentId}`,
      branch: `agent/${runId}/${agentId}`,
      baseRef: baseRef || "HEAD",
    };
    worktreeCreateCalls.push(handle);
    return Promise.resolve(handle);
  }
);

const mockWorktreeRemove = mock((_repo: string, path: string) => {
  worktreeRemoveCalls.push({ repoRoot: _repo, path });
  return Promise.resolve(undefined);
});

const mockCodexExecute = mock((_opts: unknown) => {
  codexExecuteCalls.push(_opts);
  return Promise.resolve({ result: "done", artifacts: [] });
});

// Spy on sys.spawn before mocking modules
const spawnSpy = spyOn(sys, "spawn");

// Mock Worktree Manager
mock.module("../src/orchestrator/tool/worktree.js", () => ({
  worktreeManager: {
    create: mockWorktreeCreate,
    remove: mockWorktreeRemove,
    safeMerge: mock(() =>
      Promise.resolve({ success: true, conflictFiles: [] })
    ),
    cleanup: mock(() => Promise.resolve(undefined)),
    prune: mock(() => Promise.resolve(undefined)),
  },
}));

// Mock Codex Tool
mock.module("../src/orchestrator/tool/codex/index.js", () => ({
  toolCodex: {
    execute: mockCodexExecute,
  },
}));

// Dynamic import of the unit under test (after mocks are set up)
const { conflictArbiter } = await import("../src/orchestrator/conflict");

describe("conflictArbiter", () => {
  beforeEach(() => {
    // Reset all mocks and tracking arrays - use mockReset to clear all state
    spawnSpy.mockReset();
    mockWorktreeCreate.mockReset();
    mockWorktreeRemove.mockReset();
    mockCodexExecute.mockReset();

    // Restore default implementations
    mockWorktreeCreate.mockImplementation(
      (_repo: string, runId: string, agentId: string, baseRef?: string) => {
        const handle = {
          path: `/tmp/mock-worktree/${runId}/${agentId}`,
          branch: `agent/${runId}/${agentId}`,
          baseRef: baseRef || "HEAD",
        };
        worktreeCreateCalls.push(handle);
        return Promise.resolve(handle);
      }
    );
    mockWorktreeRemove.mockImplementation((_repo: string, path: string) => {
      worktreeRemoveCalls.push({ repoRoot: _repo, path });
      return Promise.resolve(undefined);
    });
    mockCodexExecute.mockImplementation((_opts: unknown) => {
      codexExecuteCalls.push(_opts);
      return Promise.resolve({ result: "done", artifacts: [] });
    });

    worktreeCreateCalls = [];
    worktreeRemoveCalls = [];
    codexExecuteCalls = [];
  });

  describe("simple conflict resolution", () => {
    it("resolves simple conflicts by editing markers", async () => {
      // Setup: Arbiter finds conflicting files and Codex resolves them
      setupGitMocks({
        mergeExit: 1, // Merge has conflicts
        conflictFiles: ["file1.ts", "file2.ts"],
        diffCheckExit: 0, // Markers successfully removed
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-1",
        "main",
        "feat/1"
      );

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.resolvedBranch).toContain("arbiter");
      }

      // Verify worktree was created
      expect(mockWorktreeCreate).toHaveBeenCalledTimes(1);

      // Verify Codex was called with correct prompt
      expect(mockCodexExecute).toHaveBeenCalledTimes(1);
      const codexCall = codexExecuteCalls.at(0) as {
        input?: { prompt?: string };
      };
      expect(codexCall?.input?.prompt).toContain("file1.ts");
      expect(codexCall?.input?.prompt).toContain("file2.ts");

      // Verify cleanup was called
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("handles single file conflict", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["README.md"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-2",
        "main",
        "feat/2"
      );

      expect(result.status).toBe("resolved");
      expect(mockCodexExecute).toHaveBeenCalledTimes(1);
    });

    it("commits with appropriate message after resolution", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["src/index.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      await conflictArbiter.resolve("/repo", "run-3", "main", "feature/auth");

      // Find the commit spawn call (should be the last one)
      const commitCall = spawnSpy.mock.calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0][0] === "git" &&
          call[0][1] === "commit"
      );

      expect(commitCall).toBeDefined();
      const args = commitCall?.[0] as string[];
      expect(args).toContain("-m");
      const messageIdx = args.indexOf("-m");
      expect(args[messageIdx + 1]).toContain(
        "Arbiter resolved merge of feature/auth"
      );
    });
  });

  describe("clean merge handling", () => {
    it("handles clean merges (no actual conflict)", async () => {
      setupGitMocks({
        mergeExit: 0, // Merge succeeds
        conflictFiles: [], // No conflicts
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-4",
        "main",
        "feat/3"
      );

      expect(result.status).toBe("resolved");
      expect(mockCodexExecute).not.toHaveBeenCalled(); // Codex NOT called for clean merge
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("auto-commits with clean merge message", async () => {
      setupGitMocks({
        mergeExit: 0,
        conflictFiles: [],
        commitExit: 0,
      });

      await conflictArbiter.resolve("/repo", "run-5", "main", "feat/4");

      const commitCall = spawnSpy.mock.calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0][0] === "git" &&
          call[0][1] === "commit"
      );

      expect(commitCall).toBeDefined();
      const args = commitCall?.[0] as string[];
      const messageIdx = args.indexOf("-m");
      expect(args[messageIdx + 1]).toContain("Clean");
    });
  });

  describe("unresolvable conflict escalation", () => {
    it("fails if markers remain after Codex runs", async () => {
      setupGitMocks({
        mergeExit: 1, // Conflicts exist
        conflictFiles: ["complex.ts"],
        diffCheckExit: 1, // Markers still present after Codex
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-6",
        "main",
        "feat/5"
      );

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.reason).toContain("markers");
      }

      // Verify Codex was still called
      expect(mockCodexExecute).toHaveBeenCalledTimes(1);
      // Verify cleanup still happens
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("returns descriptive reason when arbiter cannot resolve", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["src/auth.ts", "src/api.ts"],
        diffCheckExit: 1,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-7",
        "main",
        "feat/6"
      );

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.reason).toBeTruthy();
        expect(typeof result.reason).toBe("string");
      }
    });

    it("instructs Codex to create ESCALATION.md in prompt", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["config.json"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      await conflictArbiter.resolve("/repo", "run-8", "main", "feat/7");

      const codexCall = codexExecuteCalls.at(0) as {
        input?: { prompt?: string };
      };
      expect(codexCall?.input?.prompt).toContain("ESCALATION.md");
    });
  });

  describe("worktree cleanup after resolution", () => {
    it("cleans up worktree after successful resolution", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["file.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      await conflictArbiter.resolve("/repo", "run-9", "main", "feat/8");

      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
      expect(worktreeRemoveCalls.length).toBe(1);
      expect(worktreeRemoveCalls[0]).toMatchObject({
        repoRoot: "/repo",
      });
    });

    it("cleans up worktree after clean merge", async () => {
      setupGitMocks({
        mergeExit: 0,
        conflictFiles: [],
        commitExit: 0,
      });

      await conflictArbiter.resolve("/repo", "run-10", "main", "feat/9");

      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("cleans up correct worktree path", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["a.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      await conflictArbiter.resolve("/my/repo", "run-11", "main", "feat/10");

      const removeCall = worktreeRemoveCalls[0] as { path?: string };
      expect(removeCall?.path).toContain("run-11");
      expect(removeCall?.path).toContain("arbiter");
    });
  });

  describe("worktree cleanup on error", () => {
    it("cleans up worktree when Codex throws", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["file.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      // Make Codex throw
      mockCodexExecute.mockImplementationOnce(async () => {
        throw new Error("Codex crashed");
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-12",
        "main",
        "feat/11"
      );

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.reason).toContain("Codex crashed");
      }

      // Cleanup must still happen despite error
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("cleans up worktree when git diff --check throws", async () => {
      // Setup merge and conflict detection
      // 1. git merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(1));
      // 2. git diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "file.ts"));
      // 3. git diff --check - throws error
      spawnSpy.mockReturnValueOnce({
        exited: Promise.reject(new Error("git diff --check failed")),
        stdout: "",
        stderr: "",
      } as ReturnType<typeof sys.spawn>);

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-13",
        "main",
        "feat/12"
      );

      expect(result.status).toBe("failed");
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("cleans up worktree when commit throws", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["file.ts"],
        diffCheckExit: 0,
        commitExit: 1, // Commit fails
      });

      // Even with commit failure, cleanup should happen
      await conflictArbiter.resolve("/repo", "run-14", "main", "feat/13");

      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });

    it("returns error details when arbiter crashes", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["file.ts"],
      });

      const errorMessage = "Network timeout during Codex execution";
      mockCodexExecute.mockImplementationOnce(async () => {
        throw new Error(errorMessage);
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-15",
        "main",
        "feat/14"
      );

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.reason).toContain(errorMessage);
      }
    });
  });

  describe("git merge error handling", () => {
    it("proceeds with conflict resolution when merge has conflicts (non-zero exit)", async () => {
      // Git merge returning non-zero is expected when there are conflicts
      // The arbiter should still proceed to identify and resolve conflicts
      setupGitMocks({
        mergeExit: 1, // Standard conflict exit code
        conflictFiles: ["conflicted-file.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-16",
        "main",
        "feat/15"
      );

      // Should proceed with conflict resolution since conflicts were found
      expect(mockCodexExecute).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("resolved");
    });

    it("handles merge with higher exit codes gracefully", async () => {
      // Setup with higher exit code but conflicts present
      spawnSpy.mockReturnValueOnce(createSpawnResult(128)); // merge with high exit code
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "error-file.ts")); // diff shows conflicts
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check passes
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit succeeds

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-16b",
        "main",
        "feat/15b"
      );

      expect(result.status).toBe("resolved");
    });

    it("fails gracefully when spawn throws synchronously", async () => {
      // This tests the try-catch in the resolve function
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "file.ts")); // diff --name-only
      // After Codex runs, git diff --check will throw
      spawnSpy.mockReturnValueOnce({
        exited: Promise.reject(new Error("spawn ENOENT")),
        stdout: "",
        stderr: "",
      } as ReturnType<typeof sys.spawn>);

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-17",
        "main",
        "feat/16"
      );

      expect(result.status).toBe("failed");
      expect(mockWorktreeRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("Codex agent configuration", () => {
    it("passes correct working directory to Codex", async () => {
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "cwd-test.ts")); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      await conflictArbiter.resolve("/repo", "run-18", "main", "feat/17");

      expect(codexExecuteCalls.length).toBe(1);
      const codexCall = codexExecuteCalls.at(0) as { input?: { cw?: string } };
      expect(codexCall?.input?.cw).toContain("run-18");
    });

    it("sets high autonomy level for arbiter", async () => {
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "auto-test.ts")); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      await conflictArbiter.resolve("/repo", "run-19", "main", "feat/18");

      expect(codexExecuteCalls.length).toBe(1);
      const codexCall = codexExecuteCalls.at(0) as {
        input?: { auto?: string };
      };
      expect(codexCall?.input?.auto).toBe("high");
    });

    it("passes authz token to Codex when provided", async () => {
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "authz-test.ts")); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      await conflictArbiter.resolve(
        "/repo",
        "run-20",
        "main",
        "feat/19",
        "auth-token-123"
      );

      expect(codexExecuteCalls.length).toBe(1);
      const codexCall = codexExecuteCalls.at(0) as {
        input?: { authz?: string };
      };
      expect(codexCall?.input?.authz).toBe("auth-token-123");
    });

    it("passes userId to Codex when provided", async () => {
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "userid-test.ts")); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      await conflictArbiter.resolve(
        "/repo",
        "run-21",
        "main",
        "feat/20",
        "authz",
        "user-456"
      );

      expect(codexExecuteCalls.length).toBe(1);
      const codexCall = codexExecuteCalls.at(0) as {
        input?: { userId?: string };
      };
      expect(codexCall?.input?.userId).toBe("user-456");
    });
  });

  describe("conflict marker detection", () => {
    it("handles multiple files with conflicts", async () => {
      const files = ["src/a.ts", "src/b.ts", "src/c.ts", "config.json"];
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, files.join("\n"))); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      await conflictArbiter.resolve("/repo", "run-22", "main", "feat/21");

      expect(codexExecuteCalls.length).toBe(1);
      const codexCall = codexExecuteCalls.at(0) as {
        input?: { prompt?: string };
      };
      for (const file of files) {
        expect(codexCall?.input?.prompt).toContain(file);
      }
    });

    it("handles files with special characters in names", async () => {
      const files = ["file with spaces.ts", "file-with-dashes.ts"];
      // Fresh mock setup for this test
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, files.join("\n"))); // diff --name-only
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // diff --check
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-23",
        "main",
        "feat/22"
      );

      expect(result.status).toBe("resolved");
    });

    it("handles empty diff output gracefully", async () => {
      // Fresh mock setup: merge returns 1 (conflict) but diff shows no files
      // This is an edge case - the arbiter should take the "clean" path
      spawnSpy.mockReturnValueOnce(createSpawnResult(1)); // merge with exit 1
      spawnSpy.mockReturnValueOnce(createSpawnResult(0, "")); // diff --name-only returns empty
      spawnSpy.mockReturnValueOnce(createSpawnResult(0)); // commit

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-24",
        "main",
        "feat/23"
      );

      // Should still resolve (clean merge path)
      expect(result.status).toBe("resolved");
      // Codex should NOT be called since conflictFiles.length === 0
      expect(codexExecuteCalls.length).toBe(0);
    });
  });

  describe("branch naming", () => {
    it("returns resolved branch with arbiter prefix", async () => {
      setupGitMocks({
        mergeExit: 1,
        conflictFiles: ["file.ts"],
        diffCheckExit: 0,
        commitExit: 0,
      });

      const result = await conflictArbiter.resolve(
        "/repo",
        "run-25",
        "main",
        "feat/24"
      );

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.resolvedBranch).toMatch(/agent\/run-25\/arbiter-/);
      }
    });
  });
});

// Helper functions

type SpawnResult = {
  exited: Promise<number>;
  stdout: string | ReadableStream<Uint8Array>;
  stderr: string;
};

function createSpawnResult(
  exitCode: number,
  stdout = "",
  stderr = ""
): SpawnResult {
  return {
    exited: Promise.resolve(exitCode),
    stdout,
    stderr,
  };
}

type GitMockConfig = {
  mergeExit: number;
  conflictFiles: string[];
  diffCheckExit?: number;
  commitExit?: number;
};

function setupGitMocks(config: GitMockConfig): void {
  const {
    mergeExit,
    conflictFiles,
    diffCheckExit = 0,
    commitExit = 0,
  } = config;

  // 1. git merge --no-commit --no-ff
  spawnSpy.mockReturnValueOnce(createSpawnResult(mergeExit));

  // 2. git diff --name-only --diff-filter=U
  spawnSpy.mockReturnValueOnce(createSpawnResult(0, conflictFiles.join("\n")));

  // If there are no conflicts, we skip to commit
  if (conflictFiles.length === 0) {
    // 3. git commit (for clean merge)
    spawnSpy.mockReturnValueOnce(createSpawnResult(commitExit));
    return;
  }

  // 3. git diff --check (after Codex runs)
  spawnSpy.mockReturnValueOnce(
    createSpawnResult(
      diffCheckExit,
      diffCheckExit === 0 ? "" : "Conflict markers found"
    )
  );

  // 4. git commit (only if diff --check passes)
  if (diffCheckExit === 0) {
    spawnSpy.mockReturnValueOnce(createSpawnResult(commitExit));
  }
}
