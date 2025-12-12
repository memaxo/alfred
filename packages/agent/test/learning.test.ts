import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  LearnMistakeInput,
  LearnPatternInput,
  LearnRecordInput,
} from "../src/orchestrator/tool/learning/definition";

const mockRequireToolScopesAndPolicy = mock();
mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: mockRequireToolScopesAndPolicy,
}));

const mockUpsertNodes = mock();
mock.module("@alfred/db/repo/graph", () => ({
  upsertNodes: mockUpsertNodes,
}));

const mockSupervise = mock();
mock.module("@alfred/learning/self_supervision", () => ({
  supervise: mockSupervise,
}));

mock.module("@alfred/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

const {
  toolLearnMistake,
  toolLearnPattern,
  toolLearnRecord,
} = await import("../src/orchestrator/tool/learning");

describe("Learning Tools", () => {
  beforeEach(() => {
    mockRequireToolScopesAndPolicy.mockReset();
    mockUpsertNodes.mockReset();
    mockSupervise.mockReset();

    mockRequireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["learning.write"],
        elevated: true,
        mfa: "passkey",
      },
    });

    mockUpsertNodes.mockResolvedValue(new Map([["user:any", { id: "node-1" }]]));
    mockSupervise.mockReturnValue(null);
  });

  describe("learn_record", () => {
    it("persists outcome and returns learningId", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["runtime:any", { id: "outcome-1" }]])
      );

      const input: LearnRecordInput = {
        workflowId: "run-123",
        outcome: "success",
        actual: "Completed successfully",
        authz: "Bearer token",
      };

      const result = await toolLearnRecord.execute({ input });
      expect(result.recorded).toBe(true);
      expect(result.learningId).toBe("outcome-1");
      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.record",
          resource: { kind: "learning", id: "runtime:run-123" },
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
            id: "insight-1",
            derived: [],
            conclusion: "Prediction error detected",
            confidence: 0.5,
          },
          replace: false,
        },
      ]);

      const input: LearnRecordInput = {
        workflowId: "run-123",
        outcome: "failure",
        expected: "Should have succeeded",
        actual: "Failed due to error",
        authz: "Bearer token",
      };

      await toolLearnRecord.execute({ input });
      expect(mockSupervise).toHaveBeenCalled();
      expect(mockUpsertNodes).toHaveBeenCalledTimes(2);
    });
  });

  describe("learn_pattern", () => {
    it("persists pattern and returns patternId (deterministic fallback)", async () => {
      mockUpsertNodes.mockResolvedValueOnce(new Map([["user:any", { id: "pattern-1" }]]));

      const input: LearnPatternInput = {
        description: "Deploy to staging with safe checks",
        toolSequence: ["git_status", "git_diff", "bun_test"],
        context: { env: "staging" },
        confidence: 0.9,
        domain: "git",
        authz: "Bearer token",
      };

      const result = await toolLearnPattern.execute({ input });
      expect(result.patternId).toBe("pattern-1");
      expect(result.confidence).toBe(0.9);

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.pattern",
          resource: { kind: "learning", id: "git" },
        })
      );
    });
  });

  describe("learn_mistake", () => {
    it("persists mistake as heuristic and returns mistakeId", async () => {
      mockUpsertNodes.mockResolvedValueOnce(new Map([["user:any", { id: "mistake-1" }]]));

      const input: LearnMistakeInput = {
        mistake: "Used force push on shared branch",
        correction: "Reverted and used a new branch + PR",
        context: { repo: "alfred" },
        severity: "high",
        domain: "git",
        authz: "Bearer token",
      };

      const result = await toolLearnMistake.execute({ input });
      expect(result.recorded).toBe(true);
      expect(result.mistakeId).toBe("mistake-1");

      expect(mockRequireToolScopesAndPolicy).toHaveBeenCalledWith(
        "Bearer token",
        ["learning.write"],
        expect.objectContaining({
          action: "learning.mistake",
          resource: { kind: "learning", id: "git" },
        })
      );
    });
  });
});

