// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "../src/orchestrator/tool/learning/definition";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

const mockUpsertNodes = mock();
mock.module("@alfred/db/repo/graph", () => ({
  upsertNodes: mockUpsertNodes,
}));

const mockSupervise = mock();
mock.module("@alfred/learning/self_supervision", () => ({
  supervise: mockSupervise,
}));

const mockEmbedMany = mock();
const mockCosineSimilarity = mock();
mock.module("@alfred/embed", () => ({
  cosineSimilarity: mockCosineSimilarity,
  embedMany: mockEmbedMany,
}));

const { toolLearnMistake, toolLearnPattern, toolLearnRecord } =
  await import("../src/orchestrator/tool/learning");

describe("Learning Tools", () => {
  beforeEach(() => {
    resetAuthTokenMocks();
    mockUpsertNodes.mockReset();
    mockSupervise.mockReset();
    mockEmbedMany.mockReset();
    mockCosineSimilarity.mockReset();

    mockRequireToolScopesAndPolicy.mockResolvedValue({
      claims: {
        sub: "test-user",
        scopes: ["learning.write"],
        elevated: true,
        mfa: "passkey",
      },
      decision: { allow: true },
    });

    mockUpsertNodes.mockResolvedValue(
      new Map([["user:any", { id: "node-1" }]])
    );
    mockSupervise.mockReturnValue(null);

    mockEmbedMany.mockResolvedValue([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    mockCosineSimilarity.mockReturnValue(0);
  });

  describe("learn_record", () => {
    it("persists outcome and returns learningId", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["runtime:any", { id: "outcome-1" }]])
      );

      const input: LearnRecordInput = {
        actual: "Completed successfully",
        authz: "Bearer token",
        outcome: "success",
        workflowId: "run-123",
      };

      const result = await toolLearnRecord.execute({ input });
      expect(result.recorded).toBe(true);
      expect(result.learningId).toBe("outcome-1");
      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.record",
          resource: { id: "runtime:run-123", kind: "learning" },
        })
      );
    });

    it("calls supervise when expected differs and error is non-trivial", async () => {
      mockUpsertNodes
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "outcome-1" }]]))
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "insight-1" }]]));

      mockSupervise.mockReturnValue([
        {
          node: {
            conclusion: "Prediction error detected",
            confidence: 0.5,
            derived: [],
            id: "insight-1",
          },
          replace: false,
        },
      ]);

      const input: LearnRecordInput = {
        actual: "Failed due to error",
        authz: "Bearer token",
        expected: "Should have succeeded",
        outcome: "failure",
        workflowId: "run-123",
      };

      await toolLearnRecord.execute({ input });
      expect(mockSupervise).toHaveBeenCalled();
      expect(mockUpsertNodes).toHaveBeenCalledTimes(2);
    });

    it("generates insights when error exceeds threshold", async () => {
      mockUpsertNodes
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "outcome-1" }]]))
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "insight-1" }]]));

      mockSupervise.mockReturnValue([
        {
          node: {
            conclusion: "High prediction error: workflow failed unexpectedly",
            confidence: 0.8,
            derived: [],
            id: "insight-1",
          },
          replace: false,
        },
      ]);

      const input: LearnRecordInput = {
        actual: "Complete failure with all tests failing",
        authz: "Bearer token",
        expected: "Complete success with all tests passing",
        outcome: "failure",
        workflowId: "run-456",
      };

      const result = await toolLearnRecord.execute({ input });
      expect(result.error).toBeGreaterThan(0.15);
      expect(mockSupervise).toHaveBeenCalled();
      expect(mockUpsertNodes).toHaveBeenCalledTimes(2);
    });

    it("does not generate insights when error is below threshold", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["runtime:any", { id: "outcome-1" }]])
      );

      // Use identical strings to ensure zero error (below 0.15 threshold)
      const input: LearnRecordInput = {
        actual: "Tests pass",
        authz: "Bearer token",
        expected: "Tests pass",
        outcome: "success",
        workflowId: "run-789",
      };

      await toolLearnRecord.execute({ input });
      expect(mockSupervise).not.toHaveBeenCalled();
      expect(mockUpsertNodes).toHaveBeenCalledTimes(1);
    });

    it("filters out invalid insight nodes", async () => {
      mockUpsertNodes
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "outcome-1" }]]))
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "insight-1" }]]));

      mockSupervise.mockReturnValue([
        {
          node: {
            conclusion: "Valid insight",
            confidence: 0.5,
            derived: [],
            id: "insight-1",
          },
          replace: false,
        },
        {
          node: {
            id: "insight-2",
            // Missing conclusion
            confidence: 0.5,
            derived: [],
          },
          replace: false,
        },
        {
          node: {
            id: "insight-3",
            conclusion: "", // Empty conclusion
            confidence: 0.5,
            derived: [],
          },
          replace: false,
        },
      ]);

      const input: LearnRecordInput = {
        actual: "Failure",
        authz: "Bearer token",
        expected: "Success",
        outcome: "failure",
        workflowId: "run-filter",
      };

      await toolLearnRecord.execute({ input });
      // Should only persist the valid insight
      expect(mockUpsertNodes).toHaveBeenCalledTimes(2);
      const insightCall = mockUpsertNodes.mock.calls[1];
      expect(insightCall[0]).toHaveLength(1);
    });
  });

  describe("learn_pattern", () => {
    it("persists pattern and returns patternId (deterministic fallback)", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["user:any", { id: "pattern-1" }]])
      );

      const input: LearnPatternInput = {
        authz: "Bearer token",
        confidence: 0.9,
        context: { env: "staging" },
        description: "Deploy to staging with safe checks",
        domain: "git",
        toolSequence: ["git_status", "git_diff", "bun_test"],
      };

      const result = await toolLearnPattern.execute({ input });
      expect(result.patternId).toBe("pattern-1");
      expect(result.confidence).toBe(0.9);

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.pattern",
          resource: { id: "git", kind: "learning" },
        })
      );
    });
  });

  describe("learn_mistake", () => {
    it("persists mistake as heuristic and returns mistakeId", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["user:any", { id: "mistake-1" }]])
      );

      const input: LearnMistakeInput = {
        authz: "Bearer token",
        context: { repo: "alfred" },
        correction: "Reverted and used a new branch + PR",
        domain: "git",
        mistake: "Used force push on shared branch",
        severity: "high",
      };

      const result = await toolLearnMistake.execute({ input });
      expect(result.recorded).toBe(true);
      expect(result.mistakeId).toBe("mistake-1");

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.mistake",
          resource: { id: "git", kind: "learning" },
        })
      );
    });
  });
});

afterAll(() => {
  mock.restore();
});
