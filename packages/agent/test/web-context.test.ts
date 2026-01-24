import { describe, expect, it } from "bun:test";

import { __internals } from "../src/orchestrator/tool/web";

describe("web context scoring helpers", () => {
  it("extracts query tokens", () => {
    const tokens = __internals.extractQueryTokens("Latest OpenAI releases");
    expect(tokens).toEqual(["latest", "openai", "releases"]);
  });

  it("scores results using highlight relevance", () => {
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
    const irrelevant = __internals.scoreExaResult({
      entry: {
        score: 0.2,
        highlightScores: [0.1],
        highlights: ["Completely unrelated topic."],
      },
      queryTokens: tokens,
      index: 1,
    });
    expect(relevant).toBeGreaterThan(irrelevant);
  });

  it("compresses snippets to configured limit", () => {
    const snippet = __internals.compressSnippet(
      "   Example snippet with repeated words. Example snippet provides context about integration.   ",
      60
    );
    expect(snippet).toBe(
      "Example snippet with repeated words. Example snippet prov..."
    );
  });
});
