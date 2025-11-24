import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { sys } from "../src/utils/process"; // Import sys to spy on it

// Mock dependencies
const mockWorktreeCreate = mock(async (_repo, runId: string, agentId: string) => ({
  path: `/tmp/mock-worktree/${runId}/${agentId}`,
  branch: `agent/${runId}/${agentId}`,
  baseRef: "HEAD",
}));
const mockWorktreeRemove = mock(async () => {});
const mockCodexExecute = mock(async () => ({ result: "done", artifacts: [] }));

// Spy on sys.spawn
const spawnSpy = spyOn(sys, "spawn");

// Mock Worktree Manager
mock.module("../src/orchestrator/tool/worktree.js", () => ({
  worktreeManager: {
    create: mockWorktreeCreate,
    remove: mockWorktreeRemove,
    safeMerge: mock(async () => ({ success: true, conflictFiles: [] })),
  },
}));

// Mock Codex Tool
mock.module("../src/orchestrator/tool/codex/index.js", () => ({
  toolCodex: {
    execute: mockCodexExecute,
  },
}));

// Dynamic import of the unit under test
const { conflictArbiter } = await import("../src/orchestrator/conflict");

describe("Conflict Arbiter", () => {
  beforeEach(() => {
    spawnSpy.mockClear();
    mockWorktreeCreate.mockClear();
    mockWorktreeRemove.mockClear();
    mockCodexExecute.mockClear();
  });

  it("resolves conflict when conflicts are found", async () => {
    // Setup mock spawn return values in order

    // 1. git merge
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(1),
      stdout: "",
      stderr: "",
    } as any);

    // 2. git diff --name-only
    // Pass string directly as stdout, Response(string) handles it
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "file1.ts\nfile2.ts",
      stderr: "",
    } as any);

    // 3. git diff --check (pass)
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "",
      stderr: "",
    } as any);

    // 4. git commit
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "",
      stderr: "",
    } as any);

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

    expect(mockWorktreeCreate).toHaveBeenCalled();
    expect(mockCodexExecute).toHaveBeenCalled(); // Agent was called
    expect(mockWorktreeRemove).toHaveBeenCalled();
  });

  it("handles clean merges (no actual conflict)", async () => {
    // 1. git merge (ok)
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "",
      stderr: "",
    } as any);
    // 2. git diff (empty)
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "",
      stderr: "",
    } as any);
    // 3. git commit
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "",
      stderr: "",
    } as any);

    const result = await conflictArbiter.resolve(
      "/repo",
      "run-1",
      "main",
      "feat/1"
    );

    expect(result.status).toBe("resolved");
    expect(mockCodexExecute).not.toHaveBeenCalled(); // Agent NOT called
  });

  it("fails if markers remain", async () => {
    // 1. git merge
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(1),
      stdout: "",
      stderr: "",
    } as any);
    // 2. git diff names
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(0),
      stdout: "file1.ts",
      stderr: "",
    } as any);

    // Agent runs...

    // 3. git diff --check FAILS
    spawnSpy.mockReturnValueOnce({
      exited: Promise.resolve(1),
      stdout: "Conflict markers found",
      stderr: "",
    } as any);

    const result = await conflictArbiter.resolve(
      "/repo",
      "run-1",
      "main",
      "feat/1"
    );

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("markers");
    }
  });
});
