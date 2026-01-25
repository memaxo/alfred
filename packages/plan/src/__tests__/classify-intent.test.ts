import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track generateObject calls
let generateObjectCalls: { prompt: string }[] = [];

// Mock AI SDK generateObject for classification
mock.module("ai", () => ({
  generateObject: async (args: { prompt: string; schema: unknown }) => {
    generateObjectCalls.push({ prompt: args.prompt });

    // Extract the task description from the prompt (between quotes after "Task:")
    const taskMatch = args.prompt.match(/Task:\s*"([^"]+)"/i);
    const task = taskMatch
      ? taskMatch[1].toLowerCase()
      : args.prompt.toLowerCase();

    // Simulate classification based on task content (not full prompt which includes category definitions)
    // Order matters - check more specific patterns first
    if (/\b(documentation|readme|docs)\b/.test(task)) {
      return { object: { category: "docs", confidence: 0.85 } };
    }
    if (/\b(test|spec|unit)\b/.test(task)) {
      return { object: { category: "test", confidence: 0.9 } };
    }
    if (/\b(fix|bug|issue|error|broken)\b/.test(task)) {
      return { object: { category: "fix", confidence: 0.9 } };
    }
    if (/\b(refactor|clean|improve|optimize)\b/.test(task)) {
      return { object: { category: "refactor", confidence: 0.8 } };
    }
    if (/\b(add|create|new|implement|feature)\b/.test(task)) {
      return { object: { category: "feat", confidence: 0.85 } };
    }

    return { object: { category: "misc", confidence: 0.6 } };
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
const { classifyIntent, classifyIntentWithMetadata, INTENT_CATEGORIES } =
  await import("../intent/classify.js");

describe("classifyIntent", () => {
  beforeEach(() => {
    generateObjectCalls = [];
  });

  // Create a mock model for testing
  const mockModel = {
    doGenerate: async () => ({}),
    doStream: async () => ({}),
    provider: "test",
    specificationVersion: "v1" as const,
    modelId: "test-model",
  };

  describe("with LLM model", () => {
    it("should classify fix intent", async () => {
      const intent = {
        id: "1",
        description: "Fix the login bug",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result).toBe("fix");
      expect(generateObjectCalls.length).toBe(1);
    });

    it("should classify feat intent", async () => {
      const intent = {
        id: "2",
        description: "Add dark mode toggle",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result).toBe("feat");
    });

    it("should classify refactor intent", async () => {
      const intent = {
        id: "3",
        description: "Refactor the auth module",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result).toBe("refactor");
    });

    it("should classify test intent", async () => {
      const intent = {
        id: "4",
        description: "Add unit tests for the API",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result).toBe("test");
    });

    it("should classify docs intent", async () => {
      const intent = {
        id: "5",
        description: "Write documentation for the API endpoints",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result).toBe("docs");
    });
  });

  describe("without model (fallback mode)", () => {
    it("should use heuristic fallback when no model provided", async () => {
      const intent = {
        id: "6",
        description: "Fix the login bug",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {});

      expect(result).toBe("fix");
      // No LLM calls should be made
      expect(generateObjectCalls.length).toBe(0);
    });

    it("should return misc for unmatched patterns", async () => {
      const intent = {
        id: "7",
        description: "Something vague",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntent(intent, {});

      expect(result).toBe("misc");
    });
  });

  describe("classifyIntentWithMetadata", () => {
    it("should return metadata with LLM classification", async () => {
      const intent = {
        id: "8",
        description: "Fix the authentication error",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntentWithMetadata(intent, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      expect(result.category).toBe("fix");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.source).toBe("llm");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return fallback metadata when no model", async () => {
      const intent = {
        id: "9",
        description: "Add a new feature",
        source: "chat" as const,
        userId: "user1",
        timestamp: new Date(),
        context: { existingPatterns: [], constraints: [] },
      };

      const result = await classifyIntentWithMetadata(intent, {});

      expect(result.category).toBe("feat");
      expect(result.confidence).toBe(0.5);
      expect(result.source).toBe("fallback");
      expect(result.latencyMs).toBe(0);
    });
  });

  describe("INTENT_CATEGORIES", () => {
    it("should export all expected categories", () => {
      expect(INTENT_CATEGORIES).toContain("fix");
      expect(INTENT_CATEGORIES).toContain("feat");
      expect(INTENT_CATEGORIES).toContain("refactor");
      expect(INTENT_CATEGORIES).toContain("test");
      expect(INTENT_CATEGORIES).toContain("docs");
      expect(INTENT_CATEGORIES).toContain("chore");
      expect(INTENT_CATEGORIES).toContain("misc");
      expect(INTENT_CATEGORIES.length).toBe(7);
    });
  });
});
