import { beforeEach, describe, expect, it, mock } from "bun:test";

const matchPatternsMock = mock(async () => [
  {
    id: "p1",
    trigger: "Use repo layer",
    similarity: 0.9,
    successRate: "0.8",
  },
  {
    id: "p2",
    trigger: "Add router tests",
    similarity: 0.7,
    successRate: "not-a-number",
  },
]);

mock.module("../pattern/match.js", () => ({
  matchPatterns: (...args: unknown[]) => (matchPatternsMock as any)(...args),
}));

const { lookupPatterns } = await import("../research/patterns.js");

describe("lookupPatterns", () => {
  beforeEach(() => {
    matchPatternsMock.mockClear();
  });

  it("maps matched patterns to LearnedPattern", async () => {
    const result = await lookupPatterns("Add a feature", "proj-123");

    expect(matchPatternsMock).toHaveBeenCalledWith(
      "Add a feature",
      "proj-123",
      expect.objectContaining({ maxResults: 5, minSimilarity: 0.65 })
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("p1");
    expect(result[0]?.name).toBe("Use repo layer");
    expect(result[0]?.confidence).toBeCloseTo(0.72, 6);
    expect(result[1]).toEqual({
      id: "p2",
      name: "Add router tests",
      confidence: 0,
    });
  });

  it("returns empty list for empty intent", async () => {
    const result = await lookupPatterns("   ");
    expect(result).toEqual([]);
    expect(matchPatternsMock).not.toHaveBeenCalled();
  });
});
