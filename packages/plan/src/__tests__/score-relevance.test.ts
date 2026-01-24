import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock AI SDK
let generateObjectCalls: { prompt: string }[] = [];

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
    error: () => {},
    info: () => {},
    warn: () => {},
  },
}));

// Import AFTER mocks
const { calculateRelevance, calculateRelevanceWithLLM, calculateReliability } =
  await import("../research/score.js");

describe("calculateReliability", () => {
  it("should score HTTPS higher than HTTP", () => {
    const https = calculateReliability({
      content: "Sample content",
      url: "https://example.com/article",
    });

    const http = calculateReliability({
      content: "Sample content",
      url: "http://example.com/article",
    });

    expect(https).toBeGreaterThan(http);
    expect(http).toBe(0); // HTTP gets 0 score
  });

  it("should apply domain authority scores", () => {
    const official = calculateReliability({
      content: "React documentation",
      url: "https://react.dev/learn",
    });

    const github = calculateReliability({
      content: "React repository",
      url: "https://github.com/facebook/react",
    });

    const blog = calculateReliability({
      content: "React tutorial",
      url: "https://myblog.com/react-tutorial",
    });

    expect(official).toBe(1); // Official docs
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
        { summary: "Learn dark mode", title: "Dark Mode Tutorial" },
        "dark mode implementation"
      );

      const scoreNoMatch = calculateRelevance(
        { summary: "Something else", title: "Unrelated Topic" },
        "dark mode implementation"
      );

      expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
    });

    it("should handle empty content gracefully", () => {
      const score = calculateRelevance(
        { summary: "Test summary", title: "Test" },
        "test query"
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should handle short queries", () => {
      const score = calculateRelevance(
        { summary: "Content", title: "Test Article" },
        "hi" // Too short to match
      );

      expect(score).toBe(0.5); // Default for no terms
    });
  });

  describe("async with LLM", () => {
    const mockModel = {
      doGenerate: async () => ({}),
      doStream: async () => ({}),
      modelId: "test-model",
      provider: "test",
      specificationVersion: "v1" as const,
    };

    it("should use LLM for semantic scoring", async () => {
      const score = await calculateRelevanceWithLLM(
        {
          summary: "How to implement dark mode",
          title: "Dark Mode with Themes",
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
          content: longContent,
          summary: "Summary",
          title: "Test",
        },
        "test query",
        {
          maxContentLength: 100,
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      const { prompt } = generateObjectCalls[0];
      expect(prompt).toContain("...");
    });

    it("should fall back to heuristic on error", async () => {
      // Override mock to throw error
      mock.module("ai", () => ({
        generateObject: () => Promise.reject(new Error("LLM failure")),
      }));

      const { calculateRelevanceWithLLM: calcFn } =
        await import("../research/score.js");

      const score = await calcFn(
        { summary: "Test summary", title: "Test" },
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
