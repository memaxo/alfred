import { describe, expect, it, mock } from "bun:test";

// Mock AI SDK generateObject
mock.module("ai", () => ({
  generateObject: async (args: any) => {
    const prompt = args.prompt;
    if (prompt.includes('User Input: "Fix the bug"')) {
      return {
        object: {
          description: "Fix the bug",
          ambiguity: {
            score: 0.9,
            questions: [{ question: "Which bug are you referring to?", options: ["UI bug", "Auth bug"] }],
          },
          multiIntent: { split: false, parts: [] },
        },
      };
    }
    if (prompt.includes('User Input: "Add dark mode and fix login bug"')) {
      return {
        object: {
          description: "Add dark mode and fix login bug",
          ambiguity: { score: 0, questions: [] },
          multiIntent: { split: true, parts: ["Add dark mode toggle", "Fix login bug"] },
        },
      };
    }
    return {
      object: {
        description: "Add dark mode toggle to settings page",
        ambiguity: { score: 0, questions: [] },
        multiIntent: { split: false, parts: [] },
      },
    };
  },
}));

// Mock @alfred/agent/v6
mock.module("@alfred/agent/v6", () => ({
  getOpenAI: () => () => ({}),
  getModelId: () => "gpt-4o",
}));

// Import AFTER mocks
const { parseIntent } = await import("../intent/parser.js");

describe("Intent Parser", () => {
  const context = { userId: "test-user", source: "chat" as const };

  it("should parse a clear single intent", async () => {
    const result = await parseIntent("Add dark mode toggle to settings page", context);
    expect(result.type).toBe("intent");
    if (result.type === "intent") {
      expect(result.intent.description).toBe("Add dark mode toggle to settings page");
      expect(result.intent.userId).toBe("test-user");
    }
  });

  it("should detect ambiguity and return clarification questions", async () => {
    const result = await parseIntent("Fix the bug", context);
    expect(result.type).toBe("clarification");
    if (result.type === "clarification") {
      expect(result.questions).toBeDefined();
      expect(result.questions!.length).toBeGreaterThan(0);
      expect(result.questions![0].question).toContain("Which bug");
    }
  });

  it("should split multi-intent requests", async () => {
    const result = await parseIntent("Add dark mode and fix login bug", context);
    expect(result.type).toBe("multiIntent");
    if (result.type === "multiIntent") {
      expect(result.intents).toBeDefined();
      expect(result.intents!.length).toBe(2);
      expect(result.intents![0].description).toBe("Add dark mode toggle");
      expect(result.intents![1].description).toBe("Fix login bug");
    }
  });
});
