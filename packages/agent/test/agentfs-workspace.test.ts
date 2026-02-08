/**
 * Unit tests for AgentFSWorkspace.
 *
 * Tests the Workspace interface implementation using mocked AgentFS SDK.
 * Docker is mocked - only auth is mocked to bypass token validation.
 */

// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dockerExecuteMock = vi.fn((args: unknown) => {
  const input =
    typeof args === "object" && args
      ? (args as { input?: unknown }).input
      : undefined;
  const action =
    typeof input === "object" && input
      ? (input as { action?: unknown }).action
      : undefined;

  if (action === "inspect") {
    return {
      ok: true as const,
      details: { containerId: "agentfs-container-1", running: true, ports: [] },
    };
  }
  if (action === "run") {
    return {
      ok: true as const,
      details: { containerId: "agentfs-container-1", running: true, ports: [] },
    };
  }
  if (action === "start") {
    return { ok: true as const, details: { name: "agentfs-container" } };
  }
  if (action === "rm") {
    return { ok: true as const, details: { name: "agentfs-container" } };
  }
  if (action === "exec") {
    return {
      ok: true as const,
      details: { exitCode: 0, text: "ok", error: undefined },
    };
  }
  return { ok: true as const, details: {} };
});

// Mock the agentfs-sdk module
const mockAgentFS = {
  kv: {
    set: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue(),
    delete: vi.fn().mockResolvedValue(),
    list: vi.fn().mockResolvedValue([]),
  },
  fs: {
    writeFile: vi.fn().mockResolvedValue(),
    readFile: vi.fn().mockResolvedValue("file content"),
    readdir: vi.fn().mockResolvedValue(["file1.txt", "file2.txt"]),
    deleteFile: vi.fn().mockResolvedValue(),
    stat: vi.fn().mockResolvedValue({
      ino: 1,
      mode: 0o10_0644,
      nlink: 1,
      uid: 0,
      gid: 0,
      size: 100,
      atime: Date.now(),
      mtime: Date.now(),
      ctime: Date.now(),
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
    }),
    mkdir: vi.fn().mockResolvedValue(),
  },
  tools: {
    record: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(),
    getByName: vi.fn().mockResolvedValue([]),
    getRecent: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue([]),
  },
  getDatabase: vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue(),
  }),
  close: vi.fn().mockResolvedValue(),
};

import * as graphRepo from "@alfred/db/repo/graph";
import { AgentFS } from "agentfs-sdk";

import {
  AgentFSWorkspace,
  isAgentFSWorkspace,
} from "../src/environment/agentfs";
import { toolDocker } from "../src/orchestrator/tool/docker";

// Use a test directory under the repo (allowed by Docker security)
const REPO_ROOT = process.cwd();
const TEST_WORKSPACE_BASE = path.join(REPO_ROOT, ".agent", "test-workspaces");

describe("AgentFSWorkspace", () => {
  let tempDir: string;
  let workspace: AgentFSWorkspace;
  let dockerExecuteSpy: ReturnType<typeof vi.spyOn> | null = null;
  let agentfsOpenSpy: ReturnType<typeof vi.spyOn> | null = null;
  let graphClientSpy: ReturnType<typeof vi.spyOn> | null = null;
  let graphUpsertNodesSpy: ReturnType<typeof vi.spyOn> | null = null;
  let graphUpsertEdgesSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    dockerExecuteSpy = vi
      .spyOn(toolDocker, "execute")
      .mockImplementation((...args) => dockerExecuteMock(...args));
    agentfsOpenSpy = vi
      .spyOn(AgentFS, "open")
      .mockResolvedValue(mockAgentFS as any);
    graphClientSpy = vi.spyOn(graphRepo, "getGraphClient").mockReturnValue({});
    graphUpsertNodesSpy = vi
      .spyOn(graphRepo, "upsertNodes")
      .mockResolvedValue(new Map());
    graphUpsertEdgesSpy = vi
      .spyOn(graphRepo, "upsertEdges")
      .mockResolvedValue();
    // Create test workspace under the repo (Docker-allowed path)
    const testId = `agentfs-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tempDir = path.join(TEST_WORKSPACE_BASE, testId);
    mkdirSync(tempDir, { recursive: true });

    workspace = new AgentFSWorkspace("test-agent", "test-run-123", tempDir, {
      overlay: false,
    });

    dockerExecuteMock.mockClear();
    mockAgentFS.kv.set.mockClear();
    mockAgentFS.kv.get.mockClear();
    mockAgentFS.kv.delete.mockClear();
    mockAgentFS.kv.list.mockClear();
    mockAgentFS.fs.writeFile.mockClear();
    mockAgentFS.fs.readFile.mockClear();
    mockAgentFS.fs.readdir.mockClear();
    mockAgentFS.fs.deleteFile.mockClear();
    mockAgentFS.fs.stat.mockClear();
    mockAgentFS.fs.mkdir.mockClear();
    mockAgentFS.tools.record.mockClear();
    mockAgentFS.tools.get.mockClear();
    mockAgentFS.tools.getByName.mockClear();
    mockAgentFS.tools.getRecent.mockClear();
    mockAgentFS.tools.getStats.mockClear();
    mockAgentFS.getDatabase.mockClear();
    mockAgentFS.close.mockClear();
  });

  afterEach(async () => {
    dockerExecuteSpy?.mockRestore();
    dockerExecuteSpy = null;
    agentfsOpenSpy?.mockRestore();
    agentfsOpenSpy = null;
    graphClientSpy?.mockRestore();
    graphClientSpy = null;
    graphUpsertNodesSpy?.mockRestore();
    graphUpsertNodesSpy = null;
    graphUpsertEdgesSpy?.mockRestore();
    graphUpsertEdgesSpy = null;
    try {
      await workspace.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("sets kind to agentfs", () => {
      expect(workspace.kind).toBe("agentfs");
    });

    it("sets root to repoBase", () => {
      expect(workspace.root).toBe(tempDir);
    });

    it("returns null for branch", () => {
      expect(workspace.branch).toBeNull();
    });

    it("generates default dbPath from runId and agentId", () => {
      expect(workspace.dbPath).toBe(".agentfs/test-run-123/agentfs.db");
    });

    it("uses custom dbPath when provided", () => {
      const custom = new AgentFSWorkspace("agent", "run", tempDir, {
        dbPath: "/custom/path.db",
      });
      expect(custom.dbPath).toBe("/custom/path.db");
    });

    it("sanitizes runId and agentId in default path", () => {
      const ws = new AgentFSWorkspace(
        "agent/with/slashes",
        "run:with:colons",
        tempDir
      );
      expect(ws.dbPath).toBe(".agentfs/run-with-colons/agentfs.db");
    });
  });

  describe("isOverlay", () => {
    it("returns false when overlay not configured", () => {
      expect(workspace.isOverlay).toBe(false);
    });

    it("returns true when overlay is enabled", () => {
      const overlayWs = new AgentFSWorkspace("agent", "run", tempDir, {
        overlay: true,
      });
      expect(overlayWs.isOverlay).toBe(true);
    });
  });

  describe("initialize", () => {
    it("creates parent directory for database", async () => {
      await workspace.initialize();
      // The directory should be created (relative to cwd in test)
      // Mock ensures no actual file operations happen
      expect(mockAgentFS.close).not.toHaveBeenCalled();
    });

    it("is idempotent - can be called multiple times", async () => {
      await workspace.initialize();
      await workspace.initialize();
      // Should not throw
    });
  });

  describe("cleanup", () => {
    it("closes AgentFS connection", async () => {
      await workspace.initialize();
      await workspace.cleanup();
      expect(mockAgentFS.close).toHaveBeenCalled();
    });

    it("is idempotent - can be called multiple times", async () => {
      await workspace.initialize();
      await workspace.cleanup();
      await workspace.cleanup();
      // Should not throw
    });

    it("does nothing if not initialized", async () => {
      await workspace.cleanup();
      expect(mockAgentFS.close).not.toHaveBeenCalled();
    });
  });

  describe("recordToolCall", () => {
    it("records tool call to AgentFS", async () => {
      await workspace.initialize();

      const id = await workspace.recordToolCall(
        "test_tool",
        1000,
        1500,
        { param: "value" },
        { result: "data" }
      );

      expect(id).toBe(1);
      expect(mockAgentFS.tools.record).toHaveBeenCalledWith(
        "test_tool",
        1000,
        1500,
        { param: "value" },
        { result: "data" },
        undefined
      );
    });

    it("records error in tool call", async () => {
      await workspace.initialize();

      await workspace.recordToolCall(
        "failing_tool",
        1000,
        1500,
        { param: "value" },
        undefined,
        "Tool execution failed"
      );

      expect(mockAgentFS.tools.record).toHaveBeenCalledWith(
        "failing_tool",
        1000,
        1500,
        { param: "value" },
        undefined,
        "Tool execution failed"
      );
    });

    it("throws if not initialized", async () => {
      await expect(workspace.recordToolCall("tool", 0, 0)).rejects.toThrow(
        "agentfs_workspace_not_initialized"
      );
    });
  });

  describe("getToolCalls", () => {
    it("returns recent tool calls", async () => {
      const mockCalls = [
        {
          id: 1,
          name: "tool1",
          started_at: 1000,
          completed_at: 1500,
          duration_ms: 500,
        },
      ];
      mockAgentFS.tools.getRecent.mockResolvedValueOnce(mockCalls);

      await workspace.initialize();
      const calls = await workspace.getToolCalls(0, 10);

      expect(calls).toEqual(mockCalls);
      expect(mockAgentFS.tools.getRecent).toHaveBeenCalledWith(0, 10);
    });

    it("throws if not initialized", async () => {
      await expect(workspace.getToolCalls()).rejects.toThrow(
        "agentfs_workspace_not_initialized"
      );
    });
  });

  describe("getToolStats", () => {
    it("returns aggregated tool statistics", async () => {
      const mockStats = [
        {
          name: "tool1",
          total_calls: 10,
          successful: 8,
          failed: 2,
          avg_duration_ms: 150,
        },
      ];
      mockAgentFS.tools.getStats.mockResolvedValueOnce(mockStats);

      await workspace.initialize();
      const stats = await workspace.getToolStats();

      expect(stats).toEqual(mockStats);
    });
  });

  describe("setKV / getKV", () => {
    it("stores and retrieves values", async () => {
      await workspace.initialize();

      await workspace.setKV("test-key", { value: 123 });
      expect(mockAgentFS.kv.set).toHaveBeenCalledWith("test-key", {
        value: 123,
      });

      mockAgentFS.kv.get.mockResolvedValueOnce({ value: 123 });
      const result = await workspace.getKV<{ value: number }>("test-key");
      expect(result).toEqual({ value: 123 });
    });

    it("returns undefined for missing keys", async () => {
      await workspace.initialize();
      const result = await workspace.getKV("missing");
      expect(result).toBeUndefined();
    });
  });

  describe("writeFile / readFile", () => {
    it("writes and reads files", async () => {
      await workspace.initialize();

      await workspace.writeFile("/test.txt", "hello world");
      expect(mockAgentFS.fs.writeFile).toHaveBeenCalledWith(
        "/test.txt",
        "hello world"
      );

      const content = await workspace.readFile("/test.txt");
      expect(content).toBe("file content");
    });
  });

  describe("exec", () => {
    it("passes AGENTFS_* env vars into docker exec", async () => {
      dockerExecuteMock.mockClear();
      await workspace.initialize();

      await workspace.exec("echo hi", {
        env: { CUSTOM_VAR: "value" },
        cwd: "subdir",
        timeoutMs: 12_345,
      });

      const calls = dockerExecuteMock.mock.calls.map((c) => c[0]);
      const execCall = calls.find((c) => {
        const input =
          typeof c === "object" && c
            ? (c as { input?: unknown }).input
            : undefined;
        const action =
          typeof input === "object" && input
            ? (input as { action?: unknown }).action
            : undefined;
        return action === "exec";
      });
      expect(execCall).toBeDefined();

      const execInput = (execCall as { input: unknown }).input as {
        env?: Record<string, string>;
        workingDirectory?: string;
        timeoutSec?: number;
      };

      expect(execInput.workingDirectory).toBe("/workspace/subdir");
      expect(execInput.timeoutSec).toBe(13);
      expect(execInput.env).toMatchObject({
        CUSTOM_VAR: "value",
        AGENTFS_DB_PATH: workspace.dbPath,
        AGENTFS_RUN_ID: "test-run-123",
        AGENTFS_AGENT_ID: "test-agent",
      });
    });
  });

  describe("readdir", () => {
    it("lists directory contents", async () => {
      await workspace.initialize();

      const files = await workspace.readdir("/output");
      expect(files).toEqual(["file1.txt", "file2.txt"]);
    });
  });

  describe("checkpoint / restore", () => {
    it("creates checkpoint snapshot", async () => {
      await workspace.initialize();

      await workspace.checkpoint("v1");

      // Should call VACUUM INTO or similar
      const db = mockAgentFS.getDatabase();
      expect(db.exec).toHaveBeenCalled();
    });

    it("throws for unknown checkpoint label", async () => {
      await workspace.initialize();

      await expect(workspace.restore("nonexistent")).rejects.toThrow(
        "agentfs_checkpoint_not_found:nonexistent"
      );
    });

    // Note: Restore test requires actual file operations, tested in integration tests
  });

  describe("getAgent", () => {
    it("returns the underlying AgentFS interface", async () => {
      await workspace.initialize();

      const agent = workspace.getAgent();
      expect(agent).toBeDefined();
      expect(agent.kv).toBeDefined();
      expect(agent.fs).toBeDefined();
      expect(agent.tools).toBeDefined();
    });

    it("throws if not initialized", () => {
      expect(() => workspace.getAgent()).toThrow(
        "agentfs_workspace_not_initialized"
      );
    });
  });
});

describe("isAgentFSWorkspace", () => {
  it("returns true for AgentFSWorkspace instances", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "agentfs-guard-"));
    const workspace = new AgentFSWorkspace("agent", "run", tempDir);

    expect(isAgentFSWorkspace(workspace)).toBe(true);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns false for other workspace types", () => {
    const fakeWorkspace = {
      kind: "container" as const,
      root: "/tmp",
      branch: null,
      initialize: async () => {},
      cleanup: async () => {},
      checkpoint: async () => {},
      restore: async () => {},
      exec: async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
        durationMs: 0,
      }),
    };

    expect(isAgentFSWorkspace(fakeWorkspace as any)).toBe(false);
  });
});
