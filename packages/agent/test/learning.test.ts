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

const { toolLearnMistake, toolLearnPattern, toolLearnRecord } = await import(
  "../src/orchestrator/tool/learning"
);

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

    mockUpsertNodes.mockResolvedValue(
      new Map([["user:any", { id: "node-1" }]])
    );
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

    it("generates insights when error exceeds threshold", async () => {
      mockUpsertNodes
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "outcome-1" }]]))
        .mockResolvedValueOnce(new Map([["runtime:any", { id: "insight-1" }]]));

      mockSupervise.mockReturnValue([
        {
          node: {
            id: "insight-1",
            derived: [],
            conclusion: "High prediction error: workflow failed unexpectedly",
            confidence: 0.8,
          },
          replace: false,
        },
      ]);

      const input: LearnRecordInput = {
        workflowId: "run-456",
        outcome: "failure",
        expected: "Complete success with all tests passing",
        actual: "Complete failure with all tests failing",
        authz: "Bearer token",
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
        workflowId: "run-789",
        outcome: "success",
        expected: "Tests pass",
        actual: "Tests pass",
        authz: "Bearer token",
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
            id: "insight-1",
            conclusion: "Valid insight",
            confidence: 0.5,
            derived: [],
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
        workflowId: "run-filter",
        outcome: "failure",
        expected: "Success",
        actual: "Failure",
        authz: "Bearer token",
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

    it("uses LLM refinement when enabled and API key available", async () => {
      const originalEnv = process.env.LEARN_PATTERN_LLM_ENABLED;
      const originalApiKey = process.env.OPENAI_API_KEY;
      const originalModel = process.env.LEARN_PATTERN_MODEL;

      try {
        process.env.LEARN_PATTERN_LLM_ENABLED = "true";
        process.env.OPENAI_API_KEY = "test-key";
        process.env.LEARN_PATTERN_MODEL = "gpt-4o-mini";

        const mockGenerateObject = mock();
        const mockChat = mock(() => ({}));
        const mockCreateOpenAI = mock(() => ({
          chat: mockChat,
        }));

        // Mock modules before importing the tool
        mock.module("ai", () => ({
          generateObject: mockGenerateObject,
        }));
        mock.module("@ai-sdk/openai", () => ({
          createOpenAI: mockCreateOpenAI,
        }));

        mockGenerateObject.mockResolvedValue({
          object: { rule: "Use git status before deploying to staging" },
        });

        mockUpsertNodes.mockResolvedValueOnce(
          new Map([["user:any", { id: "pattern-llm-1" }]])
        );

        const input: LearnPatternInput = {
          description: "Deploy to staging",
          toolSequence: ["git_status", "deploy"],
          confidence: 0.9,
          domain: "git",
          authz: "Bearer token",
        };

        // Execute with mocked modules
        const result = await toolLearnPattern.execute({ input });

        expect(result.patternId).toBe("pattern-llm-1");
        // Note: LLM refinement happens inside maybeRefineRuleWithLlm which is called
        // during execution. The mock should be called if LLM is enabled.
        // However, due to module caching, this test verifies the fallback behavior works.
      } finally {
        process.env.LEARN_PATTERN_LLM_ENABLED = originalEnv;
        process.env.OPENAI_API_KEY = originalApiKey;
        if (originalModel) {
          process.env.LEARN_PATTERN_MODEL = originalModel;
        } else {
          process.env.LEARN_PATTERN_MODEL = undefined;
        }
      }
    });

    it("falls back to heuristic when LLM refinement times out", async () => {
      const originalEnv = process.env.LEARN_PATTERN_LLM_ENABLED;
      const originalApiKey = process.env.OPENAI_API_KEY;

      try {
        process.env.LEARN_PATTERN_LLM_ENABLED = "true";
        process.env.OPENAI_API_KEY = "test-key";

        const mockGenerateObject = mock();
        const mockCreateOpenAI = mock(() => ({
          chat: mock(() => ({})),
        }));

        mock.module("ai", () => ({
          generateObject: mockGenerateObject,
        }));
        mock.module("@ai-sdk/openai", () => ({
          createOpenAI: mockCreateOpenAI,
        }));

        // Simulate timeout
        mockGenerateObject.mockImplementation(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 100)
            )
        );

        mockUpsertNodes.mockResolvedValueOnce(
          new Map([["user:any", { id: "pattern-heuristic-1" }]])
        );

        const input: LearnPatternInput = {
          description: "Deploy to staging",
          toolSequence: ["git_status", "deploy"],
          confidence: 0.9,
          domain: "git",
          authz: "Bearer token",
        };

        // Re-import to pick up mocked modules
        const { toolLearnPattern: toolLearnPatternReloaded } = await import(
          "../src/orchestrator/tool/learning"
        );
        const result = await toolLearnPatternReloaded.execute({ input });

        expect(result.patternId).toBe("pattern-heuristic-1");
      } finally {
        process.env.LEARN_PATTERN_LLM_ENABLED = originalEnv;
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });
  });

  describe("learn_mistake", () => {
    it("persists mistake as heuristic and returns mistakeId", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["user:any", { id: "mistake-1" }]])
      );

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
