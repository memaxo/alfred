import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track generateObject calls
let generateObjectCalls: { prompt: string }[] = [];

// Mock AI SDK generateObject for domain classification
mock.module("ai", () => ({
  generateObject: async (args: { prompt: string; schema: unknown }) => {
    generateObjectCalls.push({ prompt: args.prompt });

    // Extract the actual text from the prompt (between 'Text: "' and '"')
    const textMatch = args.prompt.match(/Text:\s*"([^"]+)"/i);
    const text = textMatch ? textMatch[1].toLowerCase() : "";

    // Simulate LLM classification based on actual text content (not prompt template)
    if (
      text.includes("function") ||
      text.includes("javascript") ||
      text.includes("write a function")
    ) {
      return { object: { domain: "Coding", confidence: 0.9 } };
    }
    if (
      text.includes("research") ||
      text.includes("quantum") ||
      text.includes("physics")
    ) {
      return { object: { domain: "Science", confidence: 0.85 } };
    }
    if (
      text.includes("market") ||
      text.includes("finance") ||
      text.includes("stock")
    ) {
      return { object: { domain: "Business", confidence: 0.8 } };
    }
    if (
      text.includes("medical") ||
      text.includes("doctor") ||
      text.includes("symptoms")
    ) {
      return { object: { domain: "Health", confidence: 0.85 } };
    }

    return { object: { domain: "Reference", confidence: 0.6 } };
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
const {
  classifyDomainLLM,
  isAmbiguousClassification,
  enhanceDomainClassification,
  DOMAIN_CATEGORIES,
} = await import("../src/lexicon/classify-llm.js");

describe("classifyDomainLLM", () => {
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

  describe("classifyDomainLLM", () => {
    it("should classify coding content", async () => {
      const result = await classifyDomainLLM(
        "How to write a function in JavaScript",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      expect(result.domain).toBe("Coding");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.source).toBe("learned");
      expect(generateObjectCalls.length).toBe(1);
    });

    it("should classify science content", async () => {
      const result = await classifyDomainLLM(
        "Latest research on quantum physics",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      expect(result.domain).toBe("Science");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should classify business content", async () => {
      const result = await classifyDomainLLM(
        "Stock market analysis and finance trends",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      expect(result.domain).toBe("Business");
    });

    it("should classify health content", async () => {
      const result = await classifyDomainLLM(
        "Consult a doctor about medical symptoms",
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      expect(result.domain).toBe("Health");
    });

    it("should truncate long text", async () => {
      const longText = "a".repeat(1000);
      await classifyDomainLLM(longText, {
        model: mockModel as any,
        modelKey: "test/model",
        maxTextLength: 100,
      });

      // Check that prompt was truncated
      const { prompt } = generateObjectCalls[0];
      expect(prompt).toContain("...");
    });
  });

  describe("isAmbiguousClassification", () => {
    it("should return true for empty results", () => {
      expect(isAmbiguousClassification([])).toBe(true);
    });

    it("should return true for low confidence", () => {
      expect(
        isAmbiguousClassification([
          { domain: "Coding", confidence: 0.3, source: "static" as const },
        ])
      ).toBe(true);
    });

    it("should return true for close confidence scores", () => {
      expect(
        isAmbiguousClassification([
          { domain: "Coding", confidence: 0.6, source: "static" as const },
          { domain: "Science", confidence: 0.55, source: "static" as const },
        ])
      ).toBe(true);
    });

    it("should return false for clear winner", () => {
      expect(
        isAmbiguousClassification([
          { domain: "Coding", confidence: 0.9, source: "static" as const },
          { domain: "Science", confidence: 0.3, source: "static" as const },
        ])
      ).toBe(false);
    });
  });

  describe("enhanceDomainClassification", () => {
    it("should return static results if not ambiguous", async () => {
      const staticResults = [
        { domain: "Coding", confidence: 0.9, source: "static" as const },
      ];

      const result = await enhanceDomainClassification("test", staticResults, {
        model: mockModel as any,
        modelKey: "test/model",
      });

      // Should return static without LLM call
      expect(result).toEqual(staticResults);
      expect(generateObjectCalls.length).toBe(0);
    });

    it("should return static results if no model provided", async () => {
      const staticResults = [
        { domain: "Coding", confidence: 0.3, source: "static" as const },
      ];

      const result = await enhanceDomainClassification("test", staticResults);

      expect(result).toEqual(staticResults);
    });

    it("should use LLM for ambiguous cases", async () => {
      const staticResults = [
        { domain: "Reference", confidence: 0.3, source: "static" as const },
      ];

      const result = await enhanceDomainClassification(
        "How to write a function in code",
        staticResults,
        {
          model: mockModel as any,
          modelKey: "test/model",
        }
      );

      // LLM should have been called
      expect(generateObjectCalls.length).toBe(1);
      // Should use LLM result for coding content
      expect(result[0].domain).toBe("Coding");
    });
  });

  describe("DOMAIN_CATEGORIES", () => {
    it("should export all expected categories", () => {
      expect(DOMAIN_CATEGORIES).toContain("Coding");
      expect(DOMAIN_CATEGORIES).toContain("Science");
      expect(DOMAIN_CATEGORIES).toContain("Business");
      expect(DOMAIN_CATEGORIES).toContain("Health");
      expect(DOMAIN_CATEGORIES).toContain("Arts");
      expect(DOMAIN_CATEGORIES).toContain("Personal");
      expect(DOMAIN_CATEGORIES).toContain("News");
      expect(DOMAIN_CATEGORIES).toContain("Reference");
      expect(DOMAIN_CATEGORIES.length).toBe(8);
    });
  });
});
