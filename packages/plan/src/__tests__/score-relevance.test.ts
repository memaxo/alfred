import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock AI SDK
let generateObjectCalls: Array<{ prompt: string }> = [];

mock.module("ai", () => ({
  generateObject: (args: { prompt: string; schema: unknown }) => {
    generateObjectCalls.push({ prompt: args.prompt });

    const prompt = args.prompt.toLowerCase();

    // Simulate LLM relevance scoring based on content
    if (prompt.includes("intent") && prompt.includes("source")) {
      // Extract intent and check for overlap with title/summary
      if (prompt.includes("dark mode") && prompt.includes("theme")) {
        return Promise.resolve({ object: { relevance: 0.9 } });
      }
      if (prompt.includes("dark mode") && prompt.includes("unrelated")) {
        return Promise.resolve({ object: { relevance: 0.2 } });
      }
      return Promise.resolve({ object: { relevance: 0.5 } });
    }

    return Promise.resolve({ object: { relevance: 0.5 } });
  },
}));

// Mock logger
mock.module("@alfred/logger", () => ({
  logger: {
    debug: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
  },
}));

// Import AFTER mocks
const { calculateRelevance, calculateRelevanceWithLLM, calculateReliability } =
  await import("../research/score.js");

describe("calculateReliability", () => {
  it("should score HTTPS higher than HTTP", () => {
    const https = calculateReliability({
      url: "https://example.com/article",
      content: "Sample content",
    });

    const http = calculateReliability({
      url: "http://example.com/article",
      content: "Sample content",
    });

    expect(https).toBeGreaterThan(http);
    expect(http).toBe(0); // HTTP gets 0 score
  });

  it("should apply domain authority scores", () => {
    const official = calculateReliability({
      url: "https://react.dev/learn",
      content: "React documentation",
    });

    const github = calculateReliability({
      url: "https://github.com/facebook/react",
      content: "React repository",
    });

    const blog = calculateReliability({
      url: "https://myblog.com/react-tutorial",
      content: "React tutorial",
    });

    expect(official).toBe(1.0); // Official docs
    expect(github).toBe(0.9); // GitHub
    expect(blog).toBeLessThan(github); // Unknown blog
  });

  it("should decay old content", () => {
    const recent = calculateReliability({
      url: "https://react.dev/learn",
      publishedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
      content: "React 19",
    });

    const old = calculateReliability({
      url: "https://react.dev/learn",
      publishedDate: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years ago
      content: "React 15",
    });

    expect(recent).toBeGreaterThan(old);
  });
});

describe("calculateRelevance", () => {
  beforeEach(() => {
    generateObjectCalls = [];
  });

  describe("sync (heuristic)", () => {
    it("should score exact title matches highly", () => {
      const scoreMatch = calculateRelevance(
        { title: "Dark Mode Tutorial", summary: "Learn dark mode" },
        "dark mode implementation"
      );

      const scoreNoMatch = calculateRelevance(
        { title: "Unrelated Topic", summary: "Something else" },
        "dark mode implementation"
      );

      expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
    });

    it("should handle empty content gracefully", () => {
      const score = calculateRelevance(
        { title: "Test", summary: "Test summary" },
        "test query"
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should handle short queries", () => {
      const score = calculateRelevance(
        { title: "Test Article", summary: "Content" },
        "hi" // Too short to match
      );

      expect(score).toBe(0.5); // Default for no terms
    });
  });

  describe("async with LLM", () => {
    const mockModel = {
      doGenerate: async () => ({}),
      doStream: async () => ({}),
      provider: "test",
      specificationVersion: "v1" as const,
      modelId: "test-model",
    };

    it("should use LLM for semantic scoring", async () => {
      const score = await calculateRelevanceWithLLM(
        {
          title: "Dark Mode with Themes",
          summary: "How to implement dark mode",
        },
        "dark mode implementation",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      expect(generateObjectCalls.length).toBe(1);
      expect(score).toBeGreaterThan(0);
    });

    it("should truncate long content", async () => {
      const longContent = "a".repeat(1000);

      await calculateRelevanceWithLLM(
        {
          title: "Test",
          summary: "Summary",
          content: longContent,
        },
        "test query",
        {
          model: mockModel as any,
          modelKey: "test/model",
          maxContentLength: 100,
        }
      );

      const prompt = generateObjectCalls[0].prompt;
      expect(prompt).toContain("...");
    });

    it("should fall back to heuristic on error", async () => {
      // Override mock to throw error
      mock.module("ai", () => ({
        generateObject: () => Promise.reject(new Error("LLM failure")),
      }));

      const { calculateRelevanceWithLLM: calcFn } = await import(
        "../research/score.js"
      );

      const score = await calcFn(
        { title: "Test", summary: "Test summary" },
        "test query",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      // Should return heuristic fallback
      expect(score).toBeGreaterThan(0);
    });
  });
});
