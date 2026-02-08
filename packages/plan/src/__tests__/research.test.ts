import { describe, expect, it, mock } from "bun:test";

// Mock @alfred/agent with enhanced Exa fields
mock.module("@alfred/agent/orchestrator/flow/context", () => ({
  buildContextBundle: async () => ({
    maxTokens: 24_000,
    estimatedTokens: 0,
    files: [],
  }),
  gatherCodeContext: async () => ({
    code: [],
    summary: "No files found",
  }),
  gatherWebContext: async ({ requirement }: { requirement: string }) => {
    await Promise.resolve(); // satisfy lint
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);
    const dateStr = lastYear.toISOString().split("T")[0];

    if (requirement.includes("React 18")) {
      return {
        web: [
          {
            url: "https://react.dev/blog/2022/03/29/react-v18",
            title: "React v18.0",
            snippet: "React 18 is now available on npm!",
            publishedDate: dateStr,
            score: 1,
            kind: "web",
            id: "web:0",
            // Exa-specific fields
            author: "React Team",
            highlights: [
              "Concurrent rendering is now available",
              "New Suspense features",
            ],
            highlightScores: [0.95, 0.87],
            summary: "React 18 introduces concurrent rendering features.",
            links: ["https://github.com/facebook/react"],
            subpages: [
              {
                url: "https://react.dev/blog/2022/03/29/react-v18/upgrade-guide",
                title: "React 18 Upgrade Guide",
                summary: "Step-by-step guide to upgrade to React 18",
                author: "React Team",
                publishedDate: dateStr,
              },
            ],
          },
          {
            url: "http://example-blog.com/react18",
            title: "React 18 Tutorial",
            snippet: "Learn how to use React 18 in your app.",
            publishedDate: dateStr,
            score: 0.6,
            kind: "web",
            id: "web:1",
          },
        ],
        // Receipt metadata
        searchType: "neural" as const,
        context:
          "React 18 is now available with concurrent rendering and new Suspense features...",
      };
    }

    if (requirement.includes("with subpages")) {
      return {
        web: [
          {
            url: "https://tanstack.com/router",
            title: "TanStack Router",
            snippet: "@tanstack/react-router documentation",
            publishedDate: dateStr,
            score: 0.9,
            kind: "web",
            id: "web:0",
            subpages: [
              {
                url: "https://tanstack.com/router/getting-started",
                title: "Getting Started",
                summary: "Quick start guide for TanStack Router",
                highlights: ["Type-safe routing"],
                highlightScores: [0.92],
                publishedDate: dateStr,
              },
              {
                url: "https://tanstack.com/router/api",
                title: "API Reference",
                summary: "Complete API documentation",
                publishedDate: dateStr,
              },
            ],
          },
        ],
      };
    }

    return { web: [] };
  },
}));

mock.module("@alfred/agent/orchestrator/tool/web", () => ({
  toolWeb: {
    execute: async ({ input }: { input: any }) => {
      await Promise.resolve(); // satisfy lint
      if (input.action === "research") {
        return {
          action: "research",
          ok: true,
          researchId: "test-research-id",
          results: [
            {
              url: "https://exa.ai/research/result",
              title: "Deep Research Result",
              summary: "High quality research summary from Exa v2",
              score: 0.99,
              publishedDate: new Date().toISOString(),
              author: "Exa Researcher",
            },
          ],
        };
      }
      return { ok: false };
    },
  },
}));

// Mock internal research to avoid dynamic imports of @alfred/codeprint and decompose-semantic
mock.module("../research/internal.js", () => ({
  gatherInternalResearch: async () => ({
    conventions: [],
    existingCode: ["packages/plan/src/research/internal.ts"],
    patterns: [],
  }),
}));

// Import AFTER mocks
const { gatherExternalResearch, gatherFullResearch } =
  await import("../research/external.js");
const { calculateReliability, calculateRelevance } =
  await import("../research/score.js");
const { detectFrameworkVersion, applyDateFilter } =
  await import("../research/filter.js");
const { researchSourceSchema, researchResultSchema, researchOptionsSchema } =
  await import("../research/schema.js");
const { exaSearchResultSchema, exaSearchResponseSchema, exaCostSchema } =
  await import("@alfred/type");

describe("Research Aggregator", () => {
  const mockIntent = {
    context: {
      existingPatterns: [],
      constraints: [],
    },
    description: "Upgrade to React 18",
    id: "test-id",
    source: "chat" as const,
    timestamp: new Date(),
    userId: "user-123",
  };

  describe("Reliability Scoring", () => {
    it("should score official docs as 1.0", () => {
      const score = calculateReliability({
        content: "React documentation",
        url: "https://react.dev/docs",
      });
      expect(score).toBe(1);
    });

    it("should score non-https sources as 0.0", () => {
      const score = calculateReliability({
        content: "React documentation",
        url: "http://react.dev/docs",
      });
      expect(score).toBe(0);
    });

    it("should score blogs lower than official docs", () => {
      const score = calculateReliability({
        content: "React article",
        url: "https://medium.com/react-article",
      });
      expect(score).toBe(0.5);
    });

    it("should decay score for old content", () => {
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

      const score = calculateReliability({
        content: "Old React docs",
        publishedDate: fourYearsAgo,
        url: "https://react.dev/docs",
      });
      expect(score).toBeLessThan(1);
      expect(score).toBeCloseTo(0.6, 1);
    });
  });

  describe("Relevance Scoring", () => {
    it("should score higher when title matches query", () => {
      const scoreMatch = calculateRelevance(
        { summary: "Learn React 18", title: "React 18 Guide" },
        "React 18"
      );
      const scoreNoMatch = calculateRelevance(
        { summary: "Learn Vue 3", title: "Vue 3 Guide" },
        "React 18"
      );
      expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
    });
  });

  describe("Framework Detection", () => {
    it("should detect React version from package.json style strings", () => {
      const version = detectFrameworkVersion('"react": "^18.2.0"');
      expect(version).toBe("React 18.2");
    });

    it("should detect Next.js version", () => {
      const version = detectFrameworkVersion('"next": "14.0.1"');
      expect(version).toBe("Next.js 14.0");
    });

    it("should return undefined when no framework is found", () => {
      const version = detectFrameworkVersion("Some random text");
      expect(version).toBeUndefined();
    });

    it("should detect TanStack Router version", () => {
      const version = detectFrameworkVersion(
        '"@tanstack/react-router": "^1.45.0"'
      );
      expect(version).toBe("TanStack Router 1.45");
    });
  });

  describe("Date Filtering", () => {
    it("should filter out old results when recent is requested", () => {
      const today = new Date();
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(today.getFullYear() - 3);

      const results = [
        { date: today, title: "New" },
        { date: threeYearsAgo, title: "Old" },
      ];

      const filtered = applyDateFilter(results, "recent");
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe("New");
    });

    it("should keep results without dates when filtering for recent", () => {
      const today = new Date();
      const results = [
        { date: today, title: "New" },
        { title: "Undated" }, // No date field
      ];

      const filtered = applyDateFilter(results, "recent");
      expect(filtered.length).toBe(2);
    });
  });

  describe("gatherExternalResearch", () => {
    it("should aggregate results with reliability and relevance", async () => {
      const results = await gatherExternalResearch(mockIntent);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].reliability).toBeDefined();
      expect(results[0].relevanceScore).toBeDefined();
    });

    it("should filter out low reliability results if minReliability is set", async () => {
      const results = await gatherExternalResearch(mockIntent, {
        minReliability: 0.9,
      });
      expect(results.every((r) => r.reliability >= 0.9)).toBe(true);
    });

    it("should preserve Exa-specific fields like author and highlights", async () => {
      const results = await gatherExternalResearch(mockIntent);
      const reactDoc = results.find((r) => r.source.includes("react.dev"));
      expect(reactDoc).toBeDefined();
      expect(reactDoc?.author).toBe("React Team");
      expect(reactDoc?.highlights).toBeDefined();
      expect(reactDoc?.highlights?.length).toBeGreaterThan(0);
      expect(reactDoc?.highlightScores).toBeDefined();
    });

    it("should preserve extracted links from Exa", async () => {
      const results = await gatherExternalResearch(mockIntent);
      const reactDoc = results.find((r) => r.source.includes("react.dev"));
      expect(reactDoc?.links).toBeDefined();
      expect(reactDoc?.links).toContain("https://github.com/facebook/react");
    });

    it("should transform subpages into nested ResearchSource", async () => {
      const results = await gatherExternalResearch(mockIntent);
      const reactDoc = results.find((r) => r.source.includes("react.dev"));
      expect(reactDoc?.subpages).toBeDefined();
      expect(reactDoc?.subpages?.length).toBeGreaterThan(0);
      expect(reactDoc?.subpages?.[0].title).toBe("React 18 Upgrade Guide");
      expect(reactDoc?.subpages?.[0].reliability).toBeDefined();
    });

    it("should use deep research when searchType is 'deep'", async () => {
      // Temporarily set EXA_API_KEY for the test
      const originalKey = process.env.EXA_API_KEY;
      process.env.EXA_API_KEY = "test-key";

      try {
        const results = await gatherExternalResearch(mockIntent, {
          searchType: "deep",
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].title).toBe("Deep Research Result");
        expect(results[0].author).toBe("Exa Researcher");
      } finally {
        process.env.EXA_API_KEY = originalKey;
      }
    });
  });

  describe("gatherFullResearch", () => {
    it("should return complete ResearchResult with metadata", async () => {
      const result = await gatherFullResearch(mockIntent);
      expect(result.external.length).toBeGreaterThan(0);
      expect(result.metadata.totalSources).toBeGreaterThan(0);
      expect(result.metadata.tokenCount).toBeGreaterThan(0);
      expect(result.metadata.researchDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should include internal placeholders", async () => {
      const result = await gatherFullResearch(mockIntent);
      expect(result.internal).toBeDefined();
      expect(Array.isArray(result.internal.existingCode)).toBe(true);
      expect(Array.isArray(result.internal.patterns)).toBe(true);
      expect(Array.isArray(result.internal.conventions)).toBe(true);
    });
  });

  describe("Exa Schema Validation", () => {
    it("should validate ExaSearchResult schema", () => {
      const validResult = {
        author: "John Doe",
        extras: {
          links: ["https://link1.com"],
          imageLinks: ["https://image1.png"],
        },
        highlightScores: [0.9],
        highlights: ["Important part"],
        id: "result-123",
        publishedDate: "2024-01-15",
        score: 0.95,
        subpages: [
          {
            url: "https://example.com/sub",
            title: "Subpage",
          },
        ],
        summary: "AI summary",
        text: "Full text content",
        title: "Example",
        url: "https://example.com",
      };

      const parsed = exaSearchResultSchema.safeParse(validResult);
      expect(parsed.success).toBe(true);
    });

    it("should validate ExaSearchResponse schema", () => {
      const validResponse = {
        context: "Combined context for LLM",
        costDollars: {
          total: 0.005,
          search: 0.003,
          contents: 0.002,
        },
        requestId: "req-123",
        results: [
          {
            url: "https://example.com",
            title: "Example",
          },
        ],
        searchType: "neural",
      };

      const parsed = exaSearchResponseSchema.safeParse(validResponse);
      expect(parsed.success).toBe(true);
    });

    it("should validate ExaCost schema", () => {
      const validCost = {
        breakdown: {
          neuralSearch: 0.003,
          deepSearch: 0.002,
          contentText: 0.003,
          contentHighlight: 0.001,
          contentSummary: 0.001,
        },
        contents: 0.005,
        search: 0.005,
        total: 0.01,
      };

      const parsed = exaCostSchema.safeParse(validCost);
      expect(parsed.success).toBe(true);
    });
  });

  describe("Research Schema Validation", () => {
    it("should validate ResearchSource schema with all fields", () => {
      const validSource = {
        author: "John Doe",
        category: "github",
        date: new Date(),
        frameworkVersion: "React 18.2",
        fullText: "Full text content...",
        highlightScores: [0.92],
        highlights: ["Important highlight"],
        id: "source-123",
        links: ["https://github.com/example"],
        relevanceScore: 0.9,
        reliability: 0.85,
        source: "https://example.com",
        subpages: [
          {
            id: "sub-1",
            source: "https://example.com/sub",
            title: "Subpage",
            summary: "Subpage summary",
            reliability: 0.8,
            relevanceScore: 0.85,
          },
        ],
        summary: "This is a summary",
        title: "Example Title",
      };

      const parsed = researchSourceSchema.safeParse(validSource);
      expect(parsed.success).toBe(true);
    });

    it("should validate ResearchResult schema", () => {
      const validResult = {
        external: [
          {
            id: "source-1",
            relevanceScore: 0.85,
            reliability: 0.9,
            source: "https://example.com",
            summary: "Summary",
            title: "Example",
          },
        ],
        internal: {
          conventions: [
            { id: "conv-1", description: "Use TypeScript", confidence: 0.9 },
          ],
          existingCode: ["/src/components/Button.tsx"],
          patterns: [
            { id: "pattern-1", name: "Component Pattern", confidence: 0.95 },
          ],
        },
        metadata: {
          context: "Combined LLM context",
          cost: {
            total: 0.01,
            perSource: 0.01,
          },
          researchDurationMs: 1234,
          searchType: "neural",
          tokenCount: 500,
          totalSources: 1,
        },
      };

      const parsed = researchResultSchema.safeParse(validResult);
      expect(parsed.success).toBe(true);
    });

    it("should validate ResearchOptions schema with Exa fields", () => {
      const validOptions = {
        category: "github",
        dateFilter: "recent",
        frameworkMatch: true,
        includeContext: true,
        maxResults: 10,
        minReliability: 0.7,
        searchType: "deep",
      };

      const parsed = researchOptionsSchema.safeParse(validOptions);
      expect(parsed.success).toBe(true);
    });

    it("should reject invalid Exa category", () => {
      const invalidOptions = {
        category: "invalid_category",
      };

      const parsed = researchOptionsSchema.safeParse(invalidOptions);
      expect(parsed.success).toBe(false);
    });
  });

  describe("Subpage Extraction", () => {
    it("should extract and transform nested subpages", async () => {
      const intentWithSubpages = {
        ...mockIntent,
        description: "Learn TanStack Router with subpages",
      };

      const results = await gatherExternalResearch(intentWithSubpages);
      const tanstackDoc = results.find((r) =>
        r.source.includes("tanstack.com")
      );

      expect(tanstackDoc).toBeDefined();
      expect(tanstackDoc?.subpages).toBeDefined();
      expect(tanstackDoc?.subpages?.length).toBe(2);

      // Check first subpage
      const gettingStarted = tanstackDoc?.subpages?.find((s) =>
        s.source.includes("getting-started")
      );
      expect(gettingStarted).toBeDefined();
      expect(gettingStarted?.title).toBe("Getting Started");
      expect(gettingStarted?.highlights).toContain("Type-safe routing");

      // Subpages should also have calculated scores
      expect(gettingStarted?.reliability).toBeDefined();
      expect(gettingStarted?.relevanceScore).toBeDefined();
    });
  });
});
