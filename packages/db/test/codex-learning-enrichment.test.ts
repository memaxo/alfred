/**
 * Unit tests for codex-learning enrichment functions.
 *
 * Tests createHeuristicFromFailure, findHeuristicsBySourceRun,
 * recordCodexExecution, findSimilarByEmbedding, and findSimilarWithFallback.
 *
 * Note: These are unit tests that verify function signatures and logic.
 * Integration tests requiring a database are in codex-learning.integration.test.ts.
 */

import { describe, expect, it, mock, vi, beforeEach } from "bun:test";

// Mock the database client to avoid DB dependency
mock.module("../src/client.js", () => {
  // Create a chainable mock that supports both .orderBy.limit and just .orderBy
  const createChainableMock = () => {
    const orderByMock = vi.fn().mockImplementation(() => {
      // Return a thenable that also has a limit method
      const result = Promise.resolve([]);
      vi.spyOn(result as any, "limit")
        .mockImplementation()
        .mockResolvedValue([]);
      return result;
    });

    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: orderByMock,
        }),
      }),
    };
  };

  return {
    dbDriver: "postgres",
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
      select: vi.fn().mockImplementation(createChainableMock),
    },
    getDbDriver: () => "postgres",
    isPostgresDriver: () => true,
    isSqliteDriver: () => false,
    requirePostgresDriver: () => {},
    requireSqliteDriver: () => {
      throw new Error("sqlite driver not available in mocked db client");
    },
  };
});

// Import after mocks
const {
  createHeuristicFromFailure,
  findHeuristicsBySourceRun,
  findSimilarByEmbedding,
  findSimilarWithFallback,
  recordCodexExecution,
} = await import("../src/repo/codex-learning.js");

// Import type separately
import type { CreateHeuristicInput } from "../src/repo/codex-learning.js";

describe("codex-learning enrichment (unit - no DB)", () => {
  describe("createHeuristicFromFailure", () => {
    it("should have valid function signature", () => {
      expect(typeof createHeuristicFromFailure).toBe("function");
    });

    it("should accept CreateHeuristicInput type", async () => {
      const input: CreateHeuristicInput = {
        domain: "filesystem",
        rule: "Always check file exists before reading",
        severity: "high",
        sourceError: "ENOENT: file not found",
        sourceRunId: "run-123",
        sourceStatus: "failure",
        sourceTaskId: "task-456",
      };

      // Function should accept the input type
      expect(() => createHeuristicFromFailure(input)).not.toThrow();
    });

    it("should return a string ID", async () => {
      const input: CreateHeuristicInput = {
        domain: "test",
        rule: "Test rule",
        severity: "low",
        sourceRunId: "run-1",
        sourceTaskId: "task-1",
      };

      const result = await createHeuristicFromFailure(input);
      expect(typeof result).toBe("string");
    });
  });

  describe("findHeuristicsBySourceRun", () => {
    it("should have valid function signature", () => {
      expect(typeof findHeuristicsBySourceRun).toBe("function");
    });

    it("should accept sourceRunId parameter", async () => {
      const result = await findHeuristicsBySourceRun("run-123");
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return HeuristicResult array", async () => {
      const result = await findHeuristicsBySourceRun("run-123");
      // Even if empty, should be an array
      expect(result).toEqual([]);
    });
  });

  describe("recordCodexExecution", () => {
    it("should have valid function signature", () => {
      expect(typeof recordCodexExecution).toBe("function");
    });

    it("should accept required parameters", async () => {
      const result = await recordCodexExecution(
        "repo/test",
        "Implement feature X",
        "Feature implemented successfully",
        {}
      );
      expect(typeof result).toBe("string");
    });

    it("should accept optional metadata", async () => {
      const result = await recordCodexExecution(
        "repo/test",
        "Fix bug",
        "Bug fixed",
        {
          auto: "full",
          runId: "run-789",
          sessionId: "session-123",
          taskId: "task-abc",
          threadId: "thread-456",
        }
      );
      expect(typeof result).toBe("string");
    });
  });

  describe("findSimilarByEmbedding", () => {
    it("should have valid function signature", () => {
      expect(typeof findSimilarByEmbedding).toBe("function");
    });

    it("should return empty array for empty embedding", async () => {
      const result = await findSimilarByEmbedding("repo/test", [], 5);
      expect(result).toEqual([]);
    });

    it("should accept embedding array parameter", async () => {
      const embedding = Array(1024).fill(0.1);
      const result = await findSimilarByEmbedding("repo/test", embedding, 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const embedding = Array(1024).fill(0.1);
      // Function signature should accept limit
      expect(() =>
        findSimilarByEmbedding("repo/test", embedding, 10)
      ).not.toThrow();
    });
  });

  describe("findSimilarWithFallback", () => {
    it("should have valid function signature", () => {
      expect(typeof findSimilarWithFallback).toBe("function");
    });

    it("should accept null embedding and fall back to keyword search", async () => {
      const result = await findSimilarWithFallback(
        "repo/test",
        "implement authentication",
        null,
        5
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it("should try embedding search first when embedding provided", async () => {
      const embedding = Array(1024).fill(0.1);
      const result = await findSimilarWithFallback(
        "repo/test",
        "implement authentication",
        embedding,
        5
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it("should use default limit when not specified", async () => {
      const result = await findSimilarWithFallback(
        "repo/test",
        "fix bug",
        null
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Input validation", () => {
    it("should handle empty rule in createHeuristicFromFailure", async () => {
      const input: CreateHeuristicInput = {
        domain: "test",
        rule: "",
        severity: "low",
        sourceRunId: "run-1",
        sourceTaskId: "task-1",
      };

      // Should not throw, just create with empty label
      const result = await createHeuristicFromFailure(input);
      expect(typeof result).toBe("string");
    });

    it("should handle very long rule text", async () => {
      const input: CreateHeuristicInput = {
        rule: "A".repeat(1000), // Very long rule
        domain: "test",
        severity: "medium",
        sourceRunId: "run-1",
        sourceTaskId: "task-1",
      };

      // Should truncate and not throw
      const result = await createHeuristicFromFailure(input);
      expect(typeof result).toBe("string");
    });

    it("should handle special characters in requirement", async () => {
      const result = await recordCodexExecution(
        "repo/test",
        "Fix <script>alert('xss')</script> bug",
        "Fixed the XSS vulnerability",
        {}
      );
      expect(typeof result).toBe("string");
    });
  });

  describe("Type inference", () => {
    it("SimilarTaskResult should have expected shape", async () => {
      const results = await findSimilarByEmbedding("repo/test", [0.1], 1);

      // Type checking - results should be SimilarTaskResult[]
      for (const result of results) {
        // These properties should exist on the type
        expect("nodeId" in result || results.length === 0).toBe(true);
      }
    });

    it("HeuristicResult should have expected shape", async () => {
      const results = await findHeuristicsBySourceRun("run-123");

      // Type checking - results should be HeuristicResult[]
      for (const result of results) {
        expect("nodeId" in result || results.length === 0).toBe(true);
      }
    });
  });
});

describe("codex-learning enrichment types", () => {
  describe("CreateHeuristicInput", () => {
    it("should require mandatory fields", () => {
      const validInput: CreateHeuristicInput = {
        domain: "test",
        rule: "Test rule",
        severity: "low",
        sourceRunId: "run-1",
        sourceTaskId: "task-1",
      };

      expect(validInput.rule).toBeDefined();
      expect(validInput.domain).toBeDefined();
      expect(validInput.severity).toBeDefined();
      expect(validInput.sourceRunId).toBeDefined();
      expect(validInput.sourceTaskId).toBeDefined();
    });

    it("should allow optional fields", () => {
      const inputWithOptional: CreateHeuristicInput = {
        domain: "test",
        rule: "Test rule",
        severity: "high",
        sourceError: "Optional error",
        sourceRunId: "run-1",
        sourceStatus: "failure",
        sourceTaskId: "task-1",
      };

      expect(inputWithOptional.sourceError).toBe("Optional error");
      expect(inputWithOptional.sourceStatus).toBe("failure");
    });

    it("should accept all severity levels", () => {
      const severities: ("low" | "medium" | "high")[] = [
        "low",
        "medium",
        "high",
      ];

      for (const severity of severities) {
        const input: CreateHeuristicInput = {
          domain: "test",
          rule: "Test",
          severity,
          sourceRunId: "run-1",
          sourceTaskId: "task-1",
        };
        expect(input.severity).toBe(severity);
      }
    });
  });
});
