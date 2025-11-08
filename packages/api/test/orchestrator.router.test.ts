import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockGenerateText,
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const generateMocks = mockGenerateText();

const getOpenAIMock = vi.fn();
const getModelIdMock = vi.fn().mockReturnValue("gpt-4");
const buildToolsMock = vi.fn().mockReturnValue({});

mock.module("@alfred/agent", () => ({
  getOpenAI: () => ({
    chat: getOpenAIMock,
  }),
  getModelId: getModelIdMock,
  buildTools: buildToolsMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["orchestrator.generate"],
  });
});

afterEach(() => {
  resetAllMocks();
  getOpenAIMock.mockReset();
  getModelIdMock.mockReturnValue("gpt-4");
  buildToolsMock.mockReturnValue({});
});

describe("orchestrator router", () => {
  describe("generate", () => {
    it("generates orchestrator completions via generateText", async () => {
      const mockModel = { model: "gpt-4" };
      getOpenAIMock.mockReturnValue(mockModel);

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

      expect(getOpenAIMock).toHaveBeenCalled();
      expect(generateMocks.generateText).toHaveBeenCalledTimes(1);
      const callArgs = generateMocks.generateText.mock.calls[0]?.[0];
      expect(callArgs?.model).toBe(mockModel);
      expect(callArgs?.tools).toBeDefined();
      expect(callArgs?.stopWhen).toBeDefined();
      expect(result).toMatchObject({
        text: "orchestrator response",
        usage: { inputTokens: 20, outputTokens: 30 },
        finishReason: "stop",
        replayId: "replay-id-123",
      });
    });

    it("throws UNAUTHORIZED when session is missing", async () => {
      const unauthedCaller = await createTestCaller({
        userId: "",
        scopes: [],
      });

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
      ).rejects.toThrow();
    });

    it("validates message format", async () => {
      getOpenAIMock.mockReturnValue({ model: "gpt-4" });

      await expect(
        caller.orchestrator.generate({
          messages: [{ role: "user", content: "invalid format" }] as any,
        })
      ).rejects.toThrow();
    });

    it("handles generateText errors", async () => {
      getOpenAIMock.mockReturnValue({ model: "gpt-4" });
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
