import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockGenerateText,
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";
import {
  getOrchestratorAgentDefaultsMock,
  resetAgentMocks,
} from "./utils/agent-mock";

setupTestEnv();
mockPolicyAudit();

mock.module("node-pty", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    write: vi.fn(),
  })),
}));

const generateMocks = mockGenerateText();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["orchestrator.generate"],
  });
});

afterEach(() => {
  resetAllMocks();
  resetAgentMocks();
});

describe("orchestrator router", () => {
  describe("generate", () => {
    it("generates orchestrator completions via generateText", async () => {
      const mockDefaults = {
        model: { name: "orchestrator-model" },
        tools: { orchestrate: { description: "run" } },
        stopWhen: vi.fn(),
        prepareStep: vi.fn(),
      };
      getOrchestratorAgentDefaultsMock.mockReturnValue(mockDefaults);

      generateMocks.generateText.mockResolvedValue({
        text: "orchestrator response",
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 20, outputTokens: 30 },
        warnings: [],
        finishReason: "stop",
      });

      generateMocks.persistResult.mockResolvedValue("replay-id-123");

      const result = await caller.orchestrator.generate({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "plan a feature" }],
          },
        ],
        maxSteps: 5,
      });

      expect(generateMocks.generateText).toHaveBeenCalledTimes(1);
      const callArgs = generateMocks.generateText.mock.calls[0]?.[0];
      expect(callArgs?.model).toBe(mockDefaults.model);
      expect(callArgs?.tools).toBe(mockDefaults.tools);
      expect(callArgs?.stopWhen).toBeDefined();
      expect(callArgs?.prepareStep).toBe(mockDefaults.prepareStep);
      expect(result).toMatchObject({
        text: "orchestrator response",
        usage: { inputTokens: 20, outputTokens: 30 },
        finishReason: "stop",
        replayId: "replay-id-123",
      });
    });

    it("throws UNAUTHORIZED when session is missing", async () => {
      const unauthedCaller = await createUnauthedCaller();

      await expect(
        unauthedCaller.orchestrator.generate({
          messages: [
            {
              id: "msg-1",
              role: "user",
              parts: [{ type: "text", text: "test" }],
            },
          ],
        })
      ).rejects.toThrow(/Authentication required/);
    });

    it("validates message format", async () => {
      await expect(
        caller.orchestrator.generate({
          messages: [{ role: "user", content: "invalid format" }] as any,
        })
      ).rejects.toThrow();
    });

    it("handles generateText errors", async () => {
      generateMocks.generateText.mockRejectedValue(new Error("API error"));

      await expect(
        caller.orchestrator.generate({
          messages: [
            {
              id: "msg-1",
              role: "user",
              parts: [{ type: "text", text: "test" }],
            },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe("stream", () => {
    it("throws NOT_IMPLEMENTED", async () => {
      await expect(caller.orchestrator.stream({} as any)).rejects.toThrow(
        "orchestrator.stream has moved to the HTTP SSE endpoint"
      );
    });
  });
});
