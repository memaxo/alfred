/**
 * Unit tests for AgentFS Live Error Streaming.
 *
 * Tests real-time error emission and aggregation for sibling agent awareness.
 */

import { type LiveError } from "@alfred/type";
import { beforeEach, describe, expect, it, vi } from "bun:test";

import {
  buildLiveErrorContext,
  clearOldLiveErrors,
  emitLiveError,
  getLiveErrors,
  getLiveErrorsForTool,
  getToolFailureSummary,
  isToolFailing,
} from "../../src/agentfs/stream";
import { type AgentFSInterface } from "../../src/agentfs/types";

// Mock AgentFS interface
function createMockAgent(): AgentFSInterface & {
  kvStore: Map<string, unknown>;
} {
  const kvStore = new Map<string, unknown>();

  return {
    close: vi.fn(),
    fs: {} as AgentFSInterface["fs"],
    kv: {
      set: vi.fn(async (key: string, value: unknown) => {
        kvStore.set(key, value);
      }),
      get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
        return kvStore.get(key) as T | undefined;
      }),
      delete: vi.fn(async (key: string) => {
        kvStore.delete(key);
      }),
      list: vi.fn(async (prefix: string) => {
        const entries: Array<{ key: string; value: unknown }> = [];
        for (const [key, value] of kvStore.entries()) {
          if (key.startsWith(prefix)) {
            entries.push({ key, value });
          }
        }
        return entries;
      }),
    },
    kvStore,
    tools: {
      record: vi.fn(),
      get: vi.fn(),
      getByName: vi.fn(),
      getRecent: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue([]),
    },
  };
}

function createLiveError(overrides: Partial<LiveError> = {}): LiveError {
  return {
    tool: "shell",
    error: "Command failed with exit code 1",
    agentId: "agent-1",
    taskId: "task-1",
    ts: Date.now(),
    ...overrides,
  };
}

describe("AgentFS Live Error Streaming", () => {
  let mockAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockAgent = createMockAgent();
  });

  describe("emitLiveError", () => {
    it("should emit a live error to KV store", async () => {
      const error = createLiveError({ ts: 1000 });

      await emitLiveError(mockAgent, error);

      expect(mockAgent.kv.set).toHaveBeenCalledWith("live-error:1000", error);
      expect(mockAgent.kvStore.get("live-error:1000")).toEqual(error);
    });

    it("should emit multiple errors with unique keys", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 2000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 3000 }));

      expect(mockAgent.kvStore.size).toBe(3);
    });
  });

  describe("getLiveErrors", () => {
    it("should get errors since a timestamp", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 2000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 3000 }));

      const errors = await getLiveErrors(mockAgent, 1500);

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.ts).toSorted()).toEqual([2000, 3000]);
    });

    it("should return errors sorted by timestamp descending", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 3000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 2000 }));

      const errors = await getLiveErrors(mockAgent, 0);

      expect(errors[0].ts).toBe(3000);
      expect(errors[1].ts).toBe(2000);
      expect(errors[2].ts).toBe(1000);
    });

    it("should filter out invalid entries", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      // Add invalid entry directly
      mockAgent.kvStore.set("live-error:invalid", { noTool: true });

      const errors = await getLiveErrors(mockAgent, 0);

      expect(errors).toHaveLength(1);
      expect(errors[0].ts).toBe(1000);
    });

    it("should return empty array when no errors since timestamp", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));

      const errors = await getLiveErrors(mockAgent, 2000);

      expect(errors).toHaveLength(0);
    });
  });

  describe("getLiveErrorsForTool", () => {
    it("should filter errors by tool name", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "write", ts: 2000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 3000 })
      );

      const shellErrors = await getLiveErrorsForTool(mockAgent, "shell", 0);

      expect(shellErrors).toHaveLength(2);
      expect(shellErrors.every((e) => e.tool === "shell")).toBe(true);
    });

    it("should return empty array for non-existent tool", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 1000 })
      );

      const errors = await getLiveErrorsForTool(mockAgent, "non-existent", 0);

      expect(errors).toHaveLength(0);
    });
  });

  describe("isToolFailing", () => {
    it("should return true when tool has enough recent failures", async () => {
      const now = Date.now();
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: now - 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: now - 2000 })
      );

      const failing = await isToolFailing(mockAgent, "shell", {
        minFailures: 2,
        sinceTs: now - 60000,
      });

      expect(failing).toBe(true);
    });

    it("should return false when tool has fewer failures than threshold", async () => {
      const now = Date.now();
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: now - 1000 })
      );

      const failing = await isToolFailing(mockAgent, "shell", {
        minFailures: 3,
        sinceTs: now - 60000,
      });

      expect(failing).toBe(false);
    });

    it("should use default 5-minute window and 2 failure threshold", async () => {
      const now = Date.now();
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: now - 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: now - 2000 })
      );

      const failing = await isToolFailing(mockAgent, "shell");

      expect(failing).toBe(true);
    });

    it("should not count old failures", async () => {
      const now = Date.now();
      const oldTs = now - 10 * 60 * 1000; // 10 minutes ago
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: oldTs })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: oldTs + 1000 })
      );

      const failing = await isToolFailing(mockAgent, "shell", {
        sinceTs: now - 5 * 60 * 1000, // Only last 5 minutes
        minFailures: 2,
      });

      expect(failing).toBe(false);
    });
  });

  describe("getToolFailureSummary", () => {
    it("should return map of tool failure counts", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 2000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "write", ts: 3000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 4000 })
      );

      const summary = await getToolFailureSummary(mockAgent, 0);

      expect(summary.get("shell")).toBe(3);
      expect(summary.get("write")).toBe(1);
    });

    it("should return empty map when no errors", async () => {
      const summary = await getToolFailureSummary(mockAgent, 0);

      expect(summary.size).toBe(0);
    });

    it("should respect since timestamp filter", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "shell", ts: 3000 })
      );

      const summary = await getToolFailureSummary(mockAgent, 2000);

      expect(summary.get("shell")).toBe(1);
    });
  });

  describe("clearOldLiveErrors", () => {
    it("should delete errors older than specified timestamp", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 2000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 3000 }));

      const deleted = await clearOldLiveErrors(mockAgent, 2500);

      expect(deleted).toBe(2);
      expect(mockAgent.kvStore.size).toBe(1);
    });

    it("should return 0 when no old errors", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 3000 }));

      const deleted = await clearOldLiveErrors(mockAgent, 2000);

      expect(deleted).toBe(0);
      expect(mockAgent.kvStore.size).toBe(1);
    });

    it("should delete all errors when timestamp is in future", async () => {
      await emitLiveError(mockAgent, createLiveError({ ts: 1000 }));
      await emitLiveError(mockAgent, createLiveError({ ts: 2000 }));

      const deleted = await clearOldLiveErrors(mockAgent, 5000);

      expect(deleted).toBe(2);
      expect(mockAgent.kvStore.size).toBe(0);
    });
  });

  describe("buildLiveErrorContext", () => {
    it("should build context string from recent errors", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({
          error: "Command failed",
          tool: "shell",
          ts: 1000,
        })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({
          error: "Permission denied",
          tool: "write",
          ts: 2000,
        })
      );

      const context = await buildLiveErrorContext(mockAgent, 0);

      expect(context).not.toBeNull();
      expect(context).toContain("Recent tool failures");
      expect(context).toContain("shell");
      expect(context).toContain("write");
    });

    it("should return null when no errors", async () => {
      const context = await buildLiveErrorContext(mockAgent, 0);

      expect(context).toBeNull();
    });

    it("should truncate long error messages", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({
          tool: "shell",
          error: "A".repeat(200), // Long error message
          ts: 1000,
        })
      );

      const context = await buildLiveErrorContext(mockAgent, 0);

      expect(context).not.toBeNull();
      expect(context).toContain("...");
    });

    it("should respect maxErrors parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await emitLiveError(
          mockAgent,
          createLiveError({
            error: `Error ${i}`,
            tool: `tool-${i}`,
            ts: i * 1000,
          })
        );
      }

      const context = await buildLiveErrorContext(mockAgent, 0, 3);

      expect(context).not.toBeNull();
      // Should only include most recent 3 errors
      const lines = context!.split("\n").filter((l) => l.startsWith("- "));
      expect(lines).toHaveLength(3);
    });

    it("should filter by since timestamp", async () => {
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "old", ts: 1000 })
      );
      await emitLiveError(
        mockAgent,
        createLiveError({ tool: "new", ts: 3000 })
      );

      const context = await buildLiveErrorContext(mockAgent, 2000);

      expect(context).not.toBeNull();
      expect(context).toContain("new");
      expect(context).not.toContain("old");
    });
  });
});
