import type { HookContext } from "@alfred/type";

import * as graphRepo from "@alfred/db/repo/graph";
import * as embed from "@alfred/embed";
import { createHookRegistry } from "@alfred/hooks";
import * as selfSupervision from "@alfred/learning/self_supervision";
// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";
import { afterAll, beforeEach, describe, expect, it, vi } from "bun:test";

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

const mockUpsertNodes = vi.fn();
const upsertNodesSpy = vi
  .spyOn(graphRepo, "upsertNodes")
  .mockImplementation((...args) => mockUpsertNodes(...args));

const mockSupervise = vi.fn();
const superviseSpy = vi
  .spyOn(selfSupervision, "supervise")
  .mockImplementation((...args) => mockSupervise(...args));

const mockEmbedMany = vi.fn();
const mockCosineSimilarity = vi.fn();
const cosineSimilaritySpy = vi
  .spyOn(embed, "cosineSimilarity")
  .mockImplementation((...args) => mockCosineSimilarity(...args));
const embedManySpy = vi
  .spyOn(embed, "embedMany")
  .mockImplementation((...args) => mockEmbedMany(...args));

const { toolLearnMistake, toolLearnPattern, toolLearnRecord } =
  await import("../src/orchestrator/tool/learning");

function makeHooks() {
  const registry = createHookRegistry();
  const ctx: HookContext = {
    sessionId: "test",
    workflowId: "wf",
    autonomy: 0.5,
    cognitive: {
      state: "idle",
      autonomy: 0.5,
      physiology: { energy: 1, boredom: 0, frustration: 0 },
    },
    alfredVersion: "test",
    projectDir: "/tmp",
    emit: async () => {},
    signal: new AbortController().signal,
    log: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
  return { registry, ctx };
}

function makeToolOptions(hooks: { registry: any; ctx: any }) {
  return { experimental_context: { hooks } } as any;
}

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

  describe("hooks integration", () => {
    it("applies learn:pattern:detected transforms before persisting", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["user:any", { id: "pattern-1" }]])
      );

      const hooks = makeHooks();
      hooks.registry.on("learn:pattern:detected", (event) => ({
        transformed: {
          ...event,
          pattern: {
            ...event.pattern,
            description: "Hooked",
            confidence: 0.9,
          },
        },
      }));

      const input: LearnPatternInput = {
        authz: "Bearer token",
        confidence: 0.1,
        description: "Original",
        toolSequence: ["tool_a", "tool_b"],
      };

      const result = await toolLearnPattern.execute(
        { input },
        makeToolOptions(hooks)
      );

      expect(result.description).toBe("Hooked");
      expect(result.confidence).toBe(0.9);
      expect(mockUpsertNodes).toHaveBeenCalledWith([
        expect.objectContaining({
          properties: expect.objectContaining({
            confidence: 0.9,
            description: "Hooked",
          }),
        }),
      ]);
    });

    it("applies learn:feedback transforms before persisting", async () => {
      mockUpsertNodes.mockResolvedValueOnce(
        new Map([["runtime:any", { id: "outcome-1" }]])
      );

      const hooks = makeHooks();
      hooks.registry.on("learn:feedback:positive", (event) => ({
        transformed: {
          ...event,
          action: "Redacted",
        },
      }));

      const input: LearnRecordInput = {
        actual: "secret",
        authz: "Bearer token",
        outcome: "success",
        workflowId: "run-123",
      };

      await toolLearnRecord.execute({ input }, makeToolOptions(hooks));

      const call = mockUpsertNodes.mock.calls[0]?.[0]?.[0] as
        | { properties?: unknown }
        | undefined;
      expect(call).toBeTruthy();
      expect((call?.properties as any)?.actual).toBe("Redacted");
    });

    it("blocks learn:heuristic:proposed when hook denies", async () => {
      const hooks = makeHooks();
      hooks.registry.on("learn:heuristic:proposed", () => ({
        decision: "deny",
        reason: "no",
      }));

      const input: LearnMistakeInput = {
        authz: "Bearer token",
        correction: "Do X",
        mistake: "Did Y",
        severity: "low",
      };

      await expect(
        toolLearnMistake.execute({ input }, makeToolOptions(hooks))
      ).rejects.toThrow("no");

      expect(mockUpsertNodes).not.toHaveBeenCalled();
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
  upsertNodesSpy.mockRestore();
  superviseSpy.mockRestore();
  cosineSimilaritySpy.mockRestore();
  embedManySpy.mockRestore();
});
