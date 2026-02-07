/**
 * Unit tests for AgentFS Enrichment persistence helpers.
 *
 * Tests KV-based storage for failure contexts, structured handoffs,
 * retry resolutions, decisions, and task learnings.
 */

import type {
  FailureContext,
  RetryResolution,
  StructuredHandoff,
} from "@alfred/type";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";

import type { AgentFSInterface } from "../../src/agentfs/types";

import {
  buildFailureContext,
  buildResolutionContext,
  createRetryResolution,
  findSimilarResolutions,
  getCommonErrorPatterns,
  getDecisions,
  getFailedToolsSummary,
  getFailureContext,
  getLatestRetryResolution,
  getRetryPatternSummary,
  getRetryResolutions,
  getStructuredHandoff,
  hasSuccessfulRetry,
  listAllRetryResolutions,
  listFailureContexts,
  persistDecision,
  persistFailureContext,
  persistRetryResolution,
  persistStructuredHandoff,
  type Decision,
  type RetryResolutionInput,
} from "../../src/agentfs/enrichment";
import { AGENTFS_KV_KEYS } from "../../src/agentfs/keys";

let prevEnrichmentEnv: string | undefined;

beforeAll(() => {
  prevEnrichmentEnv = process.env.ALFRED_ENRICHMENT;
  process.env.ALFRED_ENRICHMENT = "1";
});

afterAll(() => {
  if (prevEnrichmentEnv === undefined) {
    delete process.env.ALFRED_ENRICHMENT;
  } else {
    process.env.ALFRED_ENRICHMENT = prevEnrichmentEnv;
  }
});

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
        const entries: { key: string; value: unknown }[] = [];
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

// Test fixtures
function createFailureContext(
  overrides: Partial<FailureContext> = {}
): FailureContext {
  const ts = overrides.ts ?? Date.now();
  return {
    createdAt: overrides.createdAt ?? ts,
    schemaVersion: overrides.schemaVersion ?? 1,
    taskId: "task-1",
    runId: "run-123",
    status: "failure",
    toolErrors: [
      {
        count: 2,
        error: "Command failed",
        lastOccurrence: Date.now(),
        tool: "shell",
      },
    ],
    loopDetections: [],
    escalations: [],
    reviewFailures: [],
    durationMs: 5000,
    ts,
    ...overrides,
  };
}

function createStructuredHandoff(
  overrides: Partial<StructuredHandoff> = {}
): StructuredHandoff {
  const ts = overrides.ts ?? Date.now();
  return {
    createdAt: overrides.createdAt ?? ts,
    schemaVersion: overrides.schemaVersion ?? 1,
    summary: "Wave completed with partial success",
    fromWaveId: "wave-1",
    fromTaskIds: ["task-1", "task-2"],
    filesModified: ["src/index.ts"],
    filesCreated: ["src/new.ts"],
    filesDeleted: [],
    decisions: [{ decision: "Use TypeScript", rationale: "Type safety" }],
    toolsAvoided: [{ reason: "Destructive", tool: "rm" }],
    openQuestions: ["Should we add tests?"],
    blockers: [],
    ts,
    ...overrides,
  };
}

describe("AgentFS Enrichment", () => {
  let mockAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockAgent = createMockAgent();
  });

  describe("FailureContext", () => {
    it("should persist and retrieve failure context", async () => {
      const ctx = createFailureContext({ taskId: "task-abc" });

      await persistFailureContext(mockAgent, ctx);
      const retrieved = await getFailureContext(mockAgent, "task-abc");

      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe("task-abc");
      expect(retrieved?.status).toBe("failure");
      expect(retrieved?.toolErrors).toHaveLength(1);
    });

    it("should return undefined for non-existent failure context", async () => {
      const retrieved = await getFailureContext(mockAgent, "non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should list all failure contexts", async () => {
      await persistFailureContext(
        mockAgent,
        createFailureContext({ taskId: "task-1" })
      );
      await persistFailureContext(
        mockAgent,
        createFailureContext({ taskId: "task-2" })
      );
      await persistFailureContext(
        mockAgent,
        createFailureContext({ taskId: "task-3" })
      );

      const contexts = await listFailureContexts(mockAgent);

      expect(contexts).toHaveLength(3);
      expect(contexts.map((c) => c.taskId).toSorted()).toEqual([
        "task-1",
        "task-2",
        "task-3",
      ]);
    });

    it("should filter invalid entries when listing", async () => {
      // Add a valid context
      await persistFailureContext(
        mockAgent,
        createFailureContext({ taskId: "valid" })
      );
      // Add an invalid entry directly
      mockAgent.kvStore.set("failure:invalid", { noTaskId: true });

      const contexts = await listFailureContexts(mockAgent);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].taskId).toBe("valid");
    });
  });

  describe("StructuredHandoff", () => {
    it("should persist and retrieve structured handoff", async () => {
      const handoff = createStructuredHandoff({ fromWaveId: "wave-42" });

      await persistStructuredHandoff(mockAgent, "wave-42", handoff);
      const retrieved = await getStructuredHandoff(mockAgent, "wave-42");

      expect(retrieved).toBeDefined();
      expect(retrieved?.fromWaveId).toBe("wave-42");
      expect(retrieved?.decisions).toHaveLength(1);
      expect(retrieved?.toolsAvoided).toHaveLength(1);
    });

    it("should return undefined for non-existent handoff", async () => {
      const retrieved = await getStructuredHandoff(mockAgent, "non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("RetryResolution", () => {
    it("should persist and retrieve retry resolutions", async () => {
      const ts = Date.now();
      const resolution: RetryResolution = {
        attempt: 2,
        createdAt: ts,
        delta: "Fixed by adding missing import",
        failureContext: createFailureContext(),
        runId: "run-123",
        schemaVersion: 1,
        successContext: {
          toolsUsed: ["shell", "write"],
          filesChanged: ["src/fix.ts"],
          durationMs: 3000,
        },
        taskId: "task-1",
        ts,
      };

      await persistRetryResolution(mockAgent, resolution);
      const resolutions = await getRetryResolutions(mockAgent, "task-1");

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].attempt).toBe(2);
      expect(resolutions[0].delta).toBe("Fixed by adding missing import");
    });

    it("should sort retry resolutions by attempt", async () => {
      const ts = Date.now();
      const base = {
        createdAt: ts,
        delta: "Fixed",
        failureContext: createFailureContext(),
        runId: "run-123",
        schemaVersion: 1,
        successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
        taskId: "task-1",
        ts,
      };

      await persistRetryResolution(mockAgent, { ...base, attempt: 3 });
      await persistRetryResolution(mockAgent, { ...base, attempt: 1 });
      await persistRetryResolution(mockAgent, { ...base, attempt: 2 });

      const resolutions = await getRetryResolutions(mockAgent, "task-1");

      expect(resolutions.map((r) => r.attempt)).toEqual([1, 2, 3]);
    });

    it("should create retry resolution with helper", async () => {
      const input: RetryResolutionInput = {
        attempt: 1,
        delta: "Added error handling",
        failureContext: createFailureContext(),
        runId: "run-123",
        successContext: {
          toolsUsed: ["shell"],
          filesChanged: ["src/app.ts"],
          durationMs: 2000,
        },
        taskId: "task-1",
      };

      const resolution = await createRetryResolution(mockAgent, input);

      expect(resolution.taskId).toBe("task-1");
      expect(resolution.ts).toBeGreaterThan(0);
    });

    it("should check for successful retry", async () => {
      expect(await hasSuccessfulRetry(mockAgent, "task-1")).toBe(false);

      const ts = Date.now();
      await persistRetryResolution(mockAgent, {
        attempt: 1,
        createdAt: ts,
        delta: "Fixed",
        failureContext: createFailureContext(),
        runId: "run-123",
        schemaVersion: 1,
        successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
        taskId: "task-1",
        ts,
      });

      expect(await hasSuccessfulRetry(mockAgent, "task-1")).toBe(true);
    });

    it("should get latest retry resolution", async () => {
      const ts = Date.now();
      const base = {
        createdAt: ts,
        failureContext: createFailureContext(),
        runId: "run-123",
        schemaVersion: 1,
        successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
        taskId: "task-1",
        ts,
      };

      await persistRetryResolution(mockAgent, {
        ...base,
        attempt: 1,
        delta: "First fix",
      });
      await persistRetryResolution(mockAgent, {
        ...base,
        attempt: 2,
        delta: "Second fix",
      });

      const latest = await getLatestRetryResolution(mockAgent, "task-1");

      expect(latest?.attempt).toBe(2);
      expect(latest?.delta).toBe("Second fix");
    });

    it("should list all retry resolutions sorted by timestamp", async () => {
      const ts = Date.now();
      const base = {
        attempt: 1,
        createdAt: ts,
        delta: "Fixed",
        failureContext: createFailureContext(),
        runId: "run-123",
        schemaVersion: 1,
        successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
      };

      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-1",
        ts: 1000,
      });
      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-2",
        ts: 3000,
      });
      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-3",
        ts: 2000,
      });

      const all = await listAllRetryResolutions(mockAgent);

      expect(all).toHaveLength(3);
      expect(all[0].ts).toBe(3000); // Most recent first
    });
  });

  describe("Decisions", () => {
    it("should persist and retrieve decisions", async () => {
      const decision: Decision = {
        confidence: "high",
        decision: "Use React",
        rationale: "Better ecosystem",
        ts: Date.now(),
      };

      await persistDecision(mockAgent, "task-1", decision);
      const decisions = await getDecisions(mockAgent, "task-1");

      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe("Use React");
    });

    it("should accumulate multiple decisions", async () => {
      await persistDecision(mockAgent, "task-1", {
        decision: "First",
        rationale: "Reason 1",
        ts: 1000,
      });
      await persistDecision(mockAgent, "task-1", {
        decision: "Second",
        rationale: "Reason 2",
        ts: 2000,
      });

      const decisions = await getDecisions(mockAgent, "task-1");

      expect(decisions).toHaveLength(2);
    });

    it("should return empty array for non-existent task", async () => {
      const decisions = await getDecisions(mockAgent, "non-existent");
      expect(decisions).toEqual([]);
    });
  });

  // Task Learnings tests removed — persistTaskLearning/getTaskLearnings deleted.
  // Orchestrator ephemeral learnings now use Postgres memory_nodes via ReflectionObserver.

  describe("buildFailureContext", () => {
    it("should build failure context from agent stats", async () => {
      vi.spyOn(mockAgent.tools, "getStats")
        .mockImplementation()
        .mockResolvedValue([
          { failed: 3, name: "shell", total: 10 },
          { failed: 0, name: "read", total: 5 },
          { failed: 2, name: "write", total: 8 },
        ]);
      vi.spyOn(mockAgent.tools, "getRecent")
        .mockImplementation()
        .mockResolvedValue([
          {
            completed_at: Date.now() / 1000,
            error: "Permission denied",
            name: "shell",
          },
          {
            completed_at: Date.now() / 1000,
            error: "File not found",
            name: "write",
          },
        ]);

      const ctx = await buildFailureContext(
        mockAgent,
        "task-1",
        "run-123",
        "failure"
      );

      expect(ctx.taskId).toBe("task-1");
      expect(ctx.runId).toBe("run-123");
      expect(ctx.status).toBe("failure");
      expect(ctx.toolErrors).toHaveLength(2); // Only failed tools
      expect(ctx.toolErrors.find((e) => e.tool === "shell")?.count).toBe(3);
    });

    it("should include loop detections when provided", async () => {
      vi.spyOn(mockAgent.tools, "getStats")
        .mockImplementation()
        .mockResolvedValue([]);

      const ctx = await buildFailureContext(
        mockAgent,
        "task-1",
        "run-123",
        "stuck",
        {
          loopDetections: [
            { detectedAt: Date.now(), layer: 1, reason: "Repeated pattern" },
          ],
          stuckReason: "Agent stuck in loop",
        }
      );

      expect(ctx.loopDetections).toHaveLength(1);
      expect(ctx.stuckReason).toBe("Agent stuck in loop");
    });
  });

  describe("Aggregation Helpers", () => {
    it("should get failed tools summary", async () => {
      await persistFailureContext(
        mockAgent,
        createFailureContext({
          taskId: "task-1",
          toolErrors: [
            {
              count: 3,
              error: "Error",
              lastOccurrence: Date.now(),
              tool: "shell",
            },
            {
              count: 1,
              error: "Error",
              lastOccurrence: Date.now(),
              tool: "write",
            },
          ],
        })
      );
      await persistFailureContext(
        mockAgent,
        createFailureContext({
          taskId: "task-2",
          toolErrors: [
            {
              count: 2,
              error: "Error",
              lastOccurrence: Date.now(),
              tool: "shell",
            },
          ],
        })
      );

      const summary = await getFailedToolsSummary(mockAgent);

      expect(summary.get("shell")).toBe(5);
      expect(summary.get("write")).toBe(1);
    });

    it("should get common error patterns", async () => {
      await persistFailureContext(
        mockAgent,
        createFailureContext({
          taskId: "task-1",
          toolErrors: [
            {
              count: 2,
              error: "Permission denied",
              lastOccurrence: Date.now(),
              tool: "shell",
            },
          ],
        })
      );
      await persistFailureContext(
        mockAgent,
        createFailureContext({
          taskId: "task-2",
          toolErrors: [
            {
              count: 3,
              error: "Permission denied",
              lastOccurrence: Date.now(),
              tool: "shell",
            },
          ],
        })
      );

      const patterns = await getCommonErrorPatterns(mockAgent);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].tool).toBe("shell");
      expect(patterns[0].count).toBe(5);
    });

    it("should get retry pattern summary", async () => {
      const base = {
        failureContext: createFailureContext(),
        runId: "run-123",
        successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
        ts: Date.now(),
      };

      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-1",
        attempt: 2,
        delta: "Fixed imports",
      });
      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-2",
        attempt: 3,
        delta: "Fixed imports",
      });
      await persistRetryResolution(mockAgent, {
        ...base,
        taskId: "task-3",
        attempt: 1,
        delta: "Added null check",
      });

      const summary = await getRetryPatternSummary(mockAgent);

      expect(summary.totalRetries).toBe(3);
      expect(summary.avgAttemptsToSuccess).toBe(2); // (2 + 3 + 1) / 3 = 2
      expect(summary.commonFixes.length).toBeGreaterThan(0);
    });
  });

  describe("findSimilarResolutions", () => {
    it("should find resolutions with matching tool errors", async () => {
      const failure = createFailureContext({
        toolErrors: [
          {
            count: 1,
            error: "Permission denied",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      // Add resolution with matching tool
      await persistRetryResolution(mockAgent, {
        attempt: 1,
        delta: "Fixed shell command",
        failureContext: createFailureContext({
          toolErrors: [
            {
              tool: "shell",
              error: "Command failed",
              count: 2,
              lastOccurrence: Date.now(),
            },
          ],
        }),
        runId: "run-123",
        successContext: {
          toolsUsed: ["shell"],
          filesChanged: [],
          durationMs: 1000,
        },
        taskId: "task-1",
        ts: Date.now(),
      });

      // Add resolution without matching tool
      await persistRetryResolution(mockAgent, {
        attempt: 1,
        delta: "Fixed write",
        failureContext: createFailureContext({
          toolErrors: [
            {
              tool: "write",
              error: "File error",
              count: 1,
              lastOccurrence: Date.now(),
            },
          ],
        }),
        runId: "run-123",
        successContext: {
          toolsUsed: ["write"],
          filesChanged: [],
          durationMs: 1000,
        },
        taskId: "task-2",
        ts: Date.now(),
      });

      const similar = await findSimilarResolutions(mockAgent, failure);

      expect(similar).toHaveLength(1);
      expect(similar[0].taskId).toBe("task-1");
    });

    it("should respect limit parameter", async () => {
      const failure = createFailureContext({
        toolErrors: [
          {
            count: 1,
            error: "Error",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      // Add multiple matching resolutions
      for (let i = 0; i < 5; i++) {
        await persistRetryResolution(mockAgent, {
          attempt: 1,
          delta: "Fixed",
          failureContext: createFailureContext({
            toolErrors: [
              {
                tool: "shell",
                error: "Error",
                count: 1,
                lastOccurrence: Date.now(),
              },
            ],
          }),
          runId: "run-123",
          successContext: { toolsUsed: [], filesChanged: [], durationMs: 1000 },
          taskId: `task-${i}`,
          ts: Date.now(),
        });
      }

      const similar = await findSimilarResolutions(mockAgent, failure, 2);

      expect(similar).toHaveLength(2);
    });
  });

  describe("buildResolutionContext", () => {
    it("should build context string from similar resolutions", async () => {
      const failure = createFailureContext({
        toolErrors: [
          {
            count: 1,
            error: "Error",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      await persistRetryResolution(mockAgent, {
        attempt: 2,
        delta: "Added error handling to shell command",
        failureContext: createFailureContext({
          toolErrors: [
            {
              tool: "shell",
              error: "Error",
              count: 1,
              lastOccurrence: Date.now(),
            },
          ],
        }),
        runId: "run-123",
        successContext: {
          toolsUsed: ["shell"],
          filesChanged: ["src/fix.ts", "src/util.ts"],
          durationMs: 1000,
        },
        taskId: "task-1",
        ts: Date.now(),
      });

      const context = await buildResolutionContext(mockAgent, failure);

      expect(context).not.toBeNull();
      expect(context).toContain("Similar issues were resolved");
      expect(context).toContain("Attempt 2");
      expect(context).toContain("src/fix.ts");
    });

    it("should return null when no similar resolutions", async () => {
      const failure = createFailureContext({
        toolErrors: [
          {
            count: 1,
            error: "Error",
            lastOccurrence: Date.now(),
            tool: "unique-tool",
          },
        ],
      });

      const context = await buildResolutionContext(mockAgent, failure);

      expect(context).toBeNull();
    });

    it("should respect token limit", async () => {
      const failure = createFailureContext({
        toolErrors: [
          {
            count: 1,
            error: "Error",
            lastOccurrence: Date.now(),
            tool: "shell",
          },
        ],
      });

      // Add resolution with long delta
      await persistRetryResolution(mockAgent, {
        taskId: "task-1",
        runId: "run-123",
        attempt: 1,
        failureContext: createFailureContext({
          toolErrors: [
            {
              count: 1,
              error: "Error",
              lastOccurrence: Date.now(),
              tool: "shell",
            },
          ],
        }),
        successContext: { durationMs: 1000, filesChanged: [], toolsUsed: [] },
        delta: "A".repeat(500), // Long delta
        ts: Date.now(),
      });

      const context = await buildResolutionContext(mockAgent, failure, 50);

      expect(context).not.toBeNull();
      // Should be truncated
      expect(context!.length).toBeLessThan(600);
    });
  });

  describe("Key Generation", () => {
    it("should generate consistent keys", () => {
      expect(AGENTFS_KV_KEYS.failureContext("task-1")).toBe("failure:task-1");
      expect(AGENTFS_KV_KEYS.handoff("wave-1")).toBe("handoff:wave-1");
      expect(AGENTFS_KV_KEYS.retryResolution("task-1", 2)).toBe(
        "retry:task-1:2"
      );
      expect(AGENTFS_KV_KEYS.decisions("task-1")).toBe("decisions:task-1");
      expect(AGENTFS_KV_KEYS.liveError(12_345)).toBe("live-error:12345");
    });
  });
});
