import { describe, expect, it, mock } from "bun:test";
import { matchPatterns, categorizePatterns } from "../pattern/match.js";

// Mock AI and DB
mock.module("@alfred/rag", () => ({
  embed: async () => new Array(1024).fill(0.1),
}));

mock.module("@alfred/db", () => ({
  patternRepo: {
    searchPatterns: async () => [
      {
        id: "p1",
        trigger: "add-ui-feature",
        successRate: "0.9500",
        score: 0.9,
        planTemplate: { phases: [{}, {}] },
      },
      {
        id: "p2",
        trigger: "fix-bug",
        successRate: "0.8000",
        score: 0.75,
        planTemplate: { phases: [{}, {}, {}, {}] },
      },
    ],
  },
}));

describe("Pattern Matching", () => {
  it("should match relevant patterns for an intent", async () => {
    const matches = await matchPatterns("Add a dark mode toggle", "proj-123");

    expect(matches).toHaveLength(2);
    expect(matches[0].trigger).toBe("add-ui-feature");
    expect(matches[0].similarity).toBe(0.9);
  });

  it("should categorize matches by confidence", () => {
    const patterns = [
      { id: "p1", successRate: "0.9500", similarity: 0.9 } as any,
      { id: "p2", successRate: "0.8000", similarity: 0.75 } as any,
      { id: "p3", successRate: "0.5000", similarity: 0.6 } as any,
    ];

    const categorized = categorizePatterns(patterns);

    expect(categorized.autoSuggest).toHaveLength(1);
    expect(categorized.autoSuggest[0].id).toBe("p1");
    expect(categorized.requireConfirmation).toHaveLength(1);
    expect(categorized.requireConfirmation[0].id).toBe("p2");
    expect(categorized.lowConfidence).toHaveLength(1);
    expect(categorized.lowConfidence[0].id).toBe("p3");
  });
});
