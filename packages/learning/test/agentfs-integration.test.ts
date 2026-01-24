import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import {
  type AgentFSMistakeEntry,
  analyzeMistakes,
  clearLedger,
  getLedger,
  type MistakeEntry,
  processAgentFSForLearning,
  recordAgentFSMistake,
  recordAgentFSMistakes,
  recordMistake,
} from "../src/mistake_ledger";

describe("Mistake Ledger", () => {
  beforeEach(() => {
    clearLedger();
  });

  describe("recordMistake", () => {
    it("records a mistake to the ledger", () => {
      const entry: MistakeEntry = {
        id: "mistake-1",
        cause: "file_read_failed",
        effect: "File not found error",
        category: "filesystem",
        ts: "2025-12-29T00:00:00Z",
      };

      recordMistake(entry);

      const ledger = getLedger();
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toEqual(entry);
    });

    it("records multiple mistakes", () => {
      recordMistake({
        id: "mistake-1",
        cause: "error1",
        effect: "effect1",
        category: "cat1",
        ts: "2025-12-29T00:00:00Z",
      });

      recordMistake({
        id: "mistake-2",
        cause: "error2",
        effect: "effect2",
        category: "cat2",
        ts: "2025-12-29T00:00:01Z",
      });

      expect(getLedger()).toHaveLength(2);
    });
  });

  describe("recordAgentFSMistake", () => {
    it("converts AgentFS mistake entry to ledger format", () => {
      const agentfsEntry: AgentFSMistakeEntry = {
        id: "agentfs-1",
        category: "tool:file_read",
        description: "File not found",
        context: {
          tool_name: "file_read",
          path: "/nonexistent.txt",
          duration_ms: 50,
        },
        severity: "medium",
        timestamp: "2025-12-29T00:00:00Z",
      };

      recordAgentFSMistake(agentfsEntry);

      const ledger = getLedger();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].id).toBe("agentfs-1");
      expect(ledger[0].cause).toBe("tool:file_read");
      expect(ledger[0].effect).toBe("File not found");
      expect(ledger[0].category).toBe("tool:file_read");
      expect(ledger[0].context).toEqual(agentfsEntry.context);
      expect(ledger[0].ts).toBe("2025-12-29T00:00:00Z");
    });
  });

  describe("recordAgentFSMistakes", () => {
    it("records multiple AgentFS entries", () => {
      const entries: AgentFSMistakeEntry[] = [
        {
          id: "agentfs-1",
          category: "tool:shell_exec",
          description: "Command failed",
          context: { command: "invalid", exitCode: 127 },
          severity: "high",
          timestamp: "2025-12-29T00:00:00Z",
        },
        {
          id: "agentfs-2",
          category: "tool:web_search",
          description: "Network error",
          context: { query: "test", error: "ECONNREFUSED" },
          severity: "medium",
          timestamp: "2025-12-29T00:00:01Z",
        },
      ];

      const recorded = recordAgentFSMistakes(entries);

      expect(recorded).toBe(2);
      expect(getLedger()).toHaveLength(2);
    });
  });

  describe("clearLedger", () => {
    it("clears all mistakes from the ledger", () => {
      recordMistake({
        id: "mistake-1",
        cause: "test",
        effect: "test",
        category: "test",
        ts: "2025-12-29T00:00:00Z",
      });

      expect(getLedger()).toHaveLength(1);

      clearLedger();
      expect(getLedger()).toHaveLength(0);
    });
  });

  describe("analyzeMistakes", () => {
    it("returns empty array for no mistakes", () => {
      const insights = analyzeMistakes();
      expect(insights).toHaveLength(0);
    });

    it("generates insights by category", () => {
      recordMistake({
        id: "m1",
        cause: "fs_error",
        effect: "File not found",
        category: "filesystem",
        ts: "2025-12-29T00:00:00Z",
      });

      recordMistake({
        id: "m2",
        cause: "fs_error",
        effect: "Permission denied",
        category: "filesystem",
        ts: "2025-12-29T00:00:01Z",
      });

      recordMistake({
        id: "m3",
        cause: "net_error",
        effect: "Connection failed",
        category: "network",
        ts: "2025-12-29T00:00:02Z",
      });

      const insights = analyzeMistakes();

      // Should have 2 insights: one for filesystem, one for network
      expect(insights.length).toBeGreaterThanOrEqual(1);

      const fsInsight = insights.find((i) =>
        i.conclusion.includes("filesystem")
      );
      expect(fsInsight).toBeDefined();
    });
  });
});

describe("AgentFS Learning Integration", () => {
  beforeEach(() => {
    clearLedger();
  });

  describe("processAgentFSForLearning", () => {
    let mockProcessForLearning: ReturnType<typeof mock>;

    beforeAll(() => {
      mockProcessForLearning = mock(() =>
        Promise.resolve({
          patterns: [],
          mistakes: [
            {
              id: "agentfs-mock-1",
              category: "tool:codex_edit",
              description: "Parse error in file",
              context: {
                tool_name: "codex_edit",
                file: "/src/test.ts",
                error: "SyntaxError",
              },
              severity: "high" as const,
              timestamp: "2025-12-29T00:00:00Z",
            },
          ],
          insights: [
            {
              id: "insight-1",
              derived: [],
              conclusion: "Tool has reliability issues",
              confidence: {
                value: 0.8,
                source: "statistical",
                basis: "analysis",
              },
              rationale: "Based on failure patterns",
            },
          ],
        })
      );
    });

    afterAll(() => {
      mock.restore();
    });

    it("processes AgentFS database and records mistakes", async () => {
      const result = await processAgentFSForLearning("/mock/path/to/db", {
        processForLearning: mockProcessForLearning,
      });

      expect(mockProcessForLearning).toHaveBeenCalledWith("/mock/path/to/db");
      expect(result.mistakesRecorded).toBe(1);
      expect(result.insights).toHaveLength(1);

      const ledger = getLedger();
      expect(ledger).toHaveLength(1);
      expect(ledger[0].cause).toBe("tool:codex_edit");
      expect(ledger[0].effect).toBe("Parse error in file");
    });

    it("converts AgentFS insights to KnowledgeInsight format", async () => {
      const result = await processAgentFSForLearning("/mock/path", {
        processForLearning: mockProcessForLearning,
      });

      const insight = result.insights[0];
      // Confidence is KnowledgeConfidence (branded number), extract for comparison
      const confidenceValue = insight.confidence as number;
      expect(insight).toMatchObject({
        id: "insight-1",
        conclusion: "Tool has reliability issues",
        rationale: "Based on failure patterns",
      });
      // Confidence should be converted from 0.8 to KnowledgeConfidence type
      expect(confidenceValue).toBeGreaterThanOrEqual(0);
      expect(confidenceValue).toBeLessThanOrEqual(1);
      expect(confidenceValue).toBe(0.8);
    });

    it("throws error when AgentFS processing fails", async () => {
      mockProcessForLearning.mockRejectedValueOnce(
        new Error("Database not found")
      );

      await expect(
        processAgentFSForLearning("/invalid/path", {
          processForLearning: mockProcessForLearning,
        })
      ).rejects.toThrow("agentfs_learning_integration_failed");
    });
  });
});
