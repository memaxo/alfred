/**
 * Integration tests for AgentFS.
 *
 * These tests exercise the actual AgentFS SDK against real SQLite databases.
 * Docker runs for real - only auth is mocked to bypass token validation.
 * They are marked as integration tests and may be skipped in CI if the SDK
 * is not installed.
 */

// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import * as graphRepo from "@alfred/db/repo/graph";
import {
  afterEach,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const getGraphClientSpy = vi
  .spyOn(graphRepo, "getGraphClient")
  .mockImplementation(() => ({}) as any);
const upsertNodesSpy = vi
  .spyOn(graphRepo, "upsertNodes")
  .mockImplementation(async () => new Map());
const upsertEdgesSpy = vi
  .spyOn(graphRepo, "upsertEdges")
  .mockImplementation(async () => {});

import {
  extractMistakes,
  extractToolCallPatterns,
  generateInsights,
} from "../src/agentfs/learning-bridge";
import {
  AgentFSError,
  createEphemeralAgentFS,
  createRunAgentFS,
  isAgentFSAvailable,
} from "../src/agentfs/wrapper";
import { AgentFSWorkspace } from "../src/environment/agentfs";
import { WorkspaceFactory } from "../src/environment/factory";

// Use a test directory under the repo (allowed by Docker security)
const REPO_ROOT = process.cwd();
const TEST_WORKSPACE_BASE = path.join(REPO_ROOT, ".agent", "test-workspaces");

// Check if SDK is available before running tests
let sdkAvailable = false;

beforeAll(async () => {
  sdkAvailable = await isAgentFSAvailable();
  if (!sdkAvailable) {
    console.log(
      "⚠️  agentfs-sdk not available, skipping integration tests. Run: bun add agentfs-sdk"
    );
  }
});

describe("AgentFS Integration", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create test workspace under the repo (Docker-allowed path)
    const testId = `agentfs-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tempDir = path.join(TEST_WORKSPACE_BASE, testId);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("isAgentFSAvailable", () => {
    it("returns boolean indicating SDK availability", async () => {
      const result = await isAgentFSAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("createEphemeralAgentFS", () => {
    it.skipIf(!sdkAvailable)(
      "creates an in-memory AgentFS instance",
      async () => {
        const agent = await createEphemeralAgentFS();
        expect(agent).toBeDefined();

        // Should be able to use KV store
        await agent.kv.set("test", { value: 42 });
        const result = await agent.kv.get<{ value: number }>("test");
        expect(result?.value).toBe(42);

        await agent.close();
      }
    );
  });

  describe("createRunAgentFS", () => {
    it.skipIf(!sdkAvailable)(
      "creates a persistent AgentFS instance",
      async () => {
        const agent = await createRunAgentFS(
          "test-run-123",
          "test-agent",
          tempDir
        );
        expect(agent).toBeDefined();

        // Write some data
        await agent.kv.set("config", { model: "gpt-4" });

        await agent.close();

        // Verify file was created
        const dbPath = path.join(
          tempDir,
          ".agentfs",
          "test-run-123",
          "agentfs.db"
        );
        expect(existsSync(dbPath)).toBe(true);

        // Reopen and verify data persisted
        const reopened = await createRunAgentFS(
          "test-run-123",
          "test-agent",
          tempDir
        );
        const config = await reopened.kv.get<{ model: string }>("config");
        expect(config?.model).toBe("gpt-4");

        await reopened.close();
      }
    );
  });

  describe("AlfredAgentFS", () => {
    it.skipIf(!sdkAvailable)("records and retrieves tool calls", async () => {
      const agent = await createEphemeralAgentFS();

      // Record some tool calls
      const startTime = Date.now() / 1000;
      const endTime = startTime + 1.5;

      const id1 = await agent.tools.record(
        "web_search",
        startTime,
        endTime,
        { query: "AI agents" },
        { results: ["result1", "result2"] }
      );

      const id2 = await agent.tools.record(
        "file_read",
        startTime + 2,
        startTime + 2.1,
        { path: "/test.txt" },
        { content: "hello" }
      );

      const id3 = await agent.tools.record(
        "web_search",
        startTime + 3,
        startTime + 3.5,
        { query: "failed search" },
        undefined,
        "Network error"
      );

      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(id1);
      expect(id3).toBeGreaterThan(id2);

      // Get stats
      const stats = await agent.tools.getStats();
      expect(stats.length).toBeGreaterThan(0);

      const webSearchStats = stats.find((s) => s.name === "web_search");
      expect(webSearchStats?.total_calls).toBe(2);

      await agent.close();
    });

    it.skipIf(!sdkAvailable)("performs filesystem operations", async () => {
      const agent = await createEphemeralAgentFS();

      // Write a file
      await agent.fs.writeFile("/output/report.txt", "Test report content");

      // Read it back
      const content = await agent.fs.readFile("/output/report.txt");
      expect(content).toBe("Test report content");

      // List directory
      const files = await agent.fs.readdir("/output");
      expect(files).toContain("report.txt");

      await agent.close();
    });

    it.skipIf(!sdkAvailable)("handles KV store operations", async () => {
      const agent = await createEphemeralAgentFS();

      // Set various types
      await agent.kv.set("string", "value");
      await agent.kv.set("number", 42);
      await agent.kv.set("object", { nested: { deep: true } });
      await agent.kv.set("array", [1, 2, 3]);

      // Get them back
      expect(await agent.kv.get("string")).toBe("value");
      expect(await agent.kv.get("number")).toBe(42);
      expect(await agent.kv.get("object")).toEqual({ nested: { deep: true } });
      expect(await agent.kv.get("array")).toEqual([1, 2, 3]);

      // Delete
      await agent.kv.delete("string");
      expect(await agent.kv.get("string")).toBeUndefined();

      // List remaining
      const entries = await agent.kv.list();
      expect(entries.length).toBe(3);

      await agent.close();
    });
  });

  describe("AgentFSWorkspace via WorkspaceFactory", () => {
    it.skipIf(!sdkAvailable)(
      "creates agentfs workspace through factory",
      async () => {
        const workspace = await WorkspaceFactory.create(
          "agentfs",
          "test-agent",
          "test-run",
          tempDir,
          { agentfsDbPath: path.join(tempDir, "test.db") }
        );

        expect(workspace.kind).toBe("agentfs");
        expect(workspace).toBeInstanceOf(AgentFSWorkspace);

        await workspace.initialize();

        // Use workspace-specific methods
        const agentfsWorkspace = workspace as AgentFSWorkspace;
        await agentfsWorkspace.setKV("test", "value");
        const value = await agentfsWorkspace.getKV("test");
        expect(value).toBe("value");

        await workspace.cleanup();
      }
    );
  });

  describe("Learning Bridge Integration", () => {
    it.skipIf(!sdkAvailable)("extracts patterns from tool calls", async () => {
      const agent = await createEphemeralAgentFS();

      // Create realistic tool call history
      const baseTime = Date.now() / 1000;
      for (let i = 0; i < 10; i++) {
        await agent.tools.record(
          "code_edit",
          baseTime + i,
          baseTime + i + 0.5,
          { file: `/src/file${i}.ts`, action: "modify" },
          { linesChanged: i * 10 }
        );
      }

      // Add some failures
      for (let i = 0; i < 3; i++) {
        await agent.tools.record(
          "code_edit",
          baseTime + 20 + i,
          baseTime + 20 + i + 0.1,
          { file: "/src/readonly.ts" },
          undefined,
          "Permission denied"
        );
      }

      // Extract patterns
      const patterns = await extractToolCallPatterns(agent as any);
      expect(patterns.length).toBeGreaterThan(0);

      const codeEditPattern = patterns.find((p) => p.toolName === "code_edit");
      expect(codeEditPattern).toBeDefined();
      expect(codeEditPattern!.totalCalls).toBe(13);
      expect(codeEditPattern!.successRate).toBeCloseTo(10 / 13, 1);

      await agent.close();
    });

    it.skipIf(!sdkAvailable)(
      "extracts mistakes from failed tool calls",
      async () => {
        const agent = await createEphemeralAgentFS();

        const baseTime = Date.now() / 1000;

        // Successful calls
        await agent.tools.record(
          "shell_exec",
          baseTime,
          baseTime + 1,
          { command: "npm test" },
          { exitCode: 0 }
        );

        // Failed calls
        await agent.tools.record(
          "shell_exec",
          baseTime + 2,
          baseTime + 3,
          { command: "npm run nonexistent" },
          undefined,
          "Script not found"
        );

        await agent.tools.record(
          "file_write",
          baseTime + 4,
          baseTime + 4.1,
          { path: "/root/forbidden.txt" },
          undefined,
          "EACCES: permission denied"
        );

        // Extract mistakes
        const mistakes = await extractMistakes(agent as any);
        expect(mistakes.length).toBe(2);

        const shellMistake = mistakes.find(
          (m) => m.category === "tool:shell_exec"
        );
        expect(shellMistake?.description).toBe("Script not found");

        await agent.close();
      }
    );

    it("generates insights from patterns", () => {
      const patterns = [
        {
          toolName: "slow_tool",
          totalCalls: 50,
          successRate: 0.95,
          avgDurationMs: 15_000,
          commonParameters: { timeout: 30 },
          commonErrors: [],
          timeRange: { earliest: 0, latest: 100 },
        },
        {
          toolName: "unreliable_tool",
          totalCalls: 20,
          successRate: 0.5,
          avgDurationMs: 500,
          commonParameters: {},
          commonErrors: ["Network error", "Timeout", "Parse error"],
          timeRange: { earliest: 0, latest: 100 },
        },
      ];

      const insights = generateInsights(patterns);

      // Should generate insights for both tools
      expect(insights.length).toBeGreaterThan(0);

      // Check for performance insight
      const perfInsight = insights.find((i) => i.conclusion.includes("slow"));
      expect(perfInsight).toBeDefined();

      // Check for reliability insight
      const reliabilityInsight = insights.find((i) =>
        i.conclusion.includes("reliability")
      );
      expect(reliabilityInsight).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it.skipIf(!sdkAvailable)(
      "throws AgentFSError with proper codes",
      async () => {
        const agent = await createEphemeralAgentFS();

        // Try to read non-existent file
        try {
          await agent.fs.readFile("/nonexistent/path.txt");
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(AgentFSError);
          expect((error as AgentFSError).code).toBe("FS_READ_FAILED");
        }

        await agent.close();
      }
    );
  });

  describe("Checkpoint and Restore", () => {
    it.skipIf(!sdkAvailable)("creates and restores checkpoints", async () => {
      const dbPath = path.join(tempDir, "checkpoint-test.db");
      const workspace = new AgentFSWorkspace(
        "test-agent",
        "test-run",
        tempDir,
        { dbPath }
      );

      await workspace.initialize();

      // Set initial state
      await workspace.setKV("version", 1);
      await workspace.setKV("data", "initial");

      // Create checkpoint
      await workspace.checkpoint("v1");

      // Modify state
      await workspace.setKV("version", 2);
      await workspace.setKV("data", "modified");

      // Verify modification
      expect(await workspace.getKV("version")).toBe(2);

      // Restore checkpoint
      await workspace.restore("v1");

      // Verify restored state
      expect(await workspace.getKV("version")).toBe(1);
      expect(await workspace.getKV("data")).toBe("initial");

      await workspace.cleanup();
    });
  });
});

afterAll(() => {
  getGraphClientSpy.mockRestore();
  upsertNodesSpy.mockRestore();
  upsertEdgesSpy.mockRestore();
});
