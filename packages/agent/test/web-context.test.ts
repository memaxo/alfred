import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { gatherWebContext } from "../src/orchestrator/flow/context";
import { toolWeb, __internals } from "../src/orchestrator/tool/web";

const originalExecute = toolWeb.execute;
const originalEnv = {
  EXA_API_KEY: process.env.EXA_API_KEY,
  ORCH_WEB_PROVIDER: process.env.ORCH_WEB_PROVIDER,
};

describe("gatherWebContext", () => {
  beforeEach(() => {
    process.env.EXA_API_KEY = originalEnv.EXA_API_KEY;
    process.env.ORCH_WEB_PROVIDER = originalEnv.ORCH_WEB_PROVIDER;
  });

  afterEach(() => {
    process.env.EXA_API_KEY = originalEnv.EXA_API_KEY;
    process.env.ORCH_WEB_PROVIDER = originalEnv.ORCH_WEB_PROVIDER;
    toolWeb.execute = originalExecute;
  });

  it("prefers Exa when the API key is available and compresses the summary", async () => {
    process.env.EXA_API_KEY = "test-exa";
    delete process.env.ORCH_WEB_PROVIDER;

    let receivedProvider: string | undefined;
    let receivedTopK: number | undefined;
    let receivedExaConfig: unknown;

    toolWeb.execute = (async ({ input }) => {
      receivedProvider = input.provider;
      receivedTopK = input.topK;
      receivedExaConfig = input.exa;
      return {
        ok: true,
        action: "search" as const,
        provider: "exa" as const,
        results: [
          {
            url: "https://example.com/doc",
            title: "Example Doc",
            snippet: "   Example snippet with repeated words. Example snippet provides context about Exa integration.   ",
            score: 0.87,
          },
        ],
      };
    }) as typeof toolWeb.execute;

    const receipt = await gatherWebContext({
      requirement: "Integrate Exa web search",
      topK: 5,
      authz: undefined,
    });

    expect(receivedProvider).toBe("exa");
    expect(receivedTopK).toBe(5);
    expect(receivedExaConfig).toMatchObject({
      livecrawl: "fallback",
      text: false,
    });
    expect(receipt.web?.length).toBe(1);
    expect(receipt.web?.[0].score).toBeGreaterThan(0);
    expect(receipt.web?.[0].reason).toBe("Example snippet with repeated words. Example snippet provides context about Exa integration.");
    expect(receipt.summary?.startsWith("Exa → Example Doc — Example snippet with repeated words.")).toBe(true);
    expect((receipt.summary ?? "").length).toBeLessThanOrEqual(200);
  });

  it("falls back to DuckDuckGo when Exa is unavailable", async () => {
    delete process.env.EXA_API_KEY;
    delete process.env.ORCH_WEB_PROVIDER;

    let receivedProvider: string | undefined;

    toolWeb.execute = (async ({ input }) => {
      receivedProvider = input.provider;
      return {
        ok: true,
        action: "search" as const,
        provider: "ddg" as const,
        results: [
          {
            url: "https://duck.example.com/a",
            title: "Duck Example",
          },
        ],
      };
    }) as typeof toolWeb.execute;

    const receipt = await gatherWebContext({
      requirement: "Duck info",
      authz: undefined,
    });

    expect(receivedProvider).toBe("ddg");
    expect(receipt.summary).toBe("DuckDuckGo → Duck Example");
    expect(receipt.web?.[0].score).toBeCloseTo(1);
  });

  it("produces higher scores for matching highlights", () => {
    const tokens = __internals.extractQueryTokens("Latest OpenAI releases");
    const relevant = __internals.scoreExaResult({
      entry: {
        score: 0.2,
        highlightScores: [0.9],
        highlights: ["Latest OpenAI releases improve capabilities."],
      },
      queryTokens: tokens,
      index: 0,
    });
    const unrelated = __internals.scoreExaResult({
      entry: {
        score: 0.2,
        highlightScores: [0.1],
        highlights: ["Completely unrelated topic."],
      },
      queryTokens: tokens,
      index: 0,
    });
    expect(relevant).toBeGreaterThan(unrelated);
    expect(relevant).toBeLessThanOrEqual(1);
  });
});
