import { describe, expect, it } from "bun:test";
import { aggregateResearch } from "../research/aggregate.js";
import type { ResearchResult, ResearchSource } from "../research/types.js";

describe("Research Aggregation", () => {
  const mockExternal: ResearchSource[] = [
    {
      id: "ext-1",
      source: "https://example.com/1",
      title: "External Source 1",
      summary: "Summary 1",
      reliability: 0.8,
      relevanceScore: 0.9,
    },
    {
      id: "ext-2",
      source: "https://example.com/2",
      title: "External Source 2",
      summary: "Summary 2",
      reliability: 0.7,
      relevanceScore: 0.8,
    },
    {
      id: "ext-1-dup",
      source: "https://example.com/1",
      title: "External Source 1 Duplicate",
      summary: "Summary 1 Duplicate",
      reliability: 0.6,
      relevanceScore: 0.9,
    },
  ];

  const mockInternal: ResearchResult["internal"] = {
    existingCode: ["src/app.ts", "src/utils.ts", "src/app.ts"],
    patterns: [
      { id: "p1", name: "Pattern 1", confidence: 0.9 },
    ],
    conventions: [
      { id: "c1", description: "Convention 1", confidence: 0.8 },
    ],
  };

  it("should deduplicate external sources by URL", async () => {
    const result = await aggregateResearch(mockExternal, mockInternal, {
      deduplicate: true,
    });

    expect(result.external).toHaveLength(2);
    expect(result.external.find(s => s.source === "https://example.com/1")?.reliability).toBe(0.8);
  });

  it("should deduplicate internal code paths", async () => {
    const result = await aggregateResearch(mockExternal, mockInternal, {
      deduplicate: true,
    });

    expect(result.internal.existingCode).toHaveLength(2);
    expect(result.internal.existingCode).toContain("src/app.ts");
    expect(result.internal.existingCode).toContain("src/utils.ts");
  });

  it("should respect token limits and priority mode", async () => {
    // Very small limit to force prioritization
    const result = await aggregateResearch(mockExternal, mockInternal, {
      maxTokens: 50, 
      prioritize: "balanced",
    });

    expect(result.metadata.tokenCount).toBeLessThanOrEqual(50);
  });

  it("should handle cross-source deduplication", async () => {
    const externalWithLocal: ResearchSource[] = [
      ...mockExternal,
      {
        id: "local-ref",
        source: "src/app.ts", // Already in internal
        title: "Local File Reference",
        summary: "Local summary",
        reliability: 1.0,
        relevanceScore: 1.0,
      }
    ];

    const result = await aggregateResearch(externalWithLocal, mockInternal, {
      deduplicate: true,
    });

    // src/app.ts should be removed from external
    expect(result.external.find(s => s.source === "src/app.ts")).toBeUndefined();
    expect(result.internal.existingCode).toContain("src/app.ts");
  });

  it("should validate result against schema", async () => {
    const result = await aggregateResearch(mockExternal, mockInternal);
    expect(result.metadata).toBeDefined();
    expect(result.external).toBeDefined();
    expect(result.internal).toBeDefined();
  });
});
