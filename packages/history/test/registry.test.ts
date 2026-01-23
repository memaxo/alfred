import { describe, expect, it } from "bun:test";
import {
  getModelSpec,
  listModels,
  listModelsByProvider,
  listModelIds,
  requireModelSpec,
  resolveModelId,
  MODEL_REGISTRY,
} from "../src/registry";

describe("Model Registry", () => {
  describe("resolveModelId", () => {
    it("returns canonical ID for known aliases", () => {
      expect(resolveModelId("gpt-4o")).toBe("openai/gpt-4o");
      expect(resolveModelId("claude-sonnet-4")).toBe("anthropic/claude-sonnet-4");
      expect(resolveModelId("gemini-2.5-pro")).toBe("google/gemini-2.5-pro");
      expect(resolveModelId("deepseek-v3")).toBe("deepseek/deepseek-v3");
    });

    it("returns input unchanged for canonical IDs", () => {
      expect(resolveModelId("openai/gpt-4o")).toBe("openai/gpt-4o");
      expect(resolveModelId("anthropic/claude-opus-4")).toBe("anthropic/claude-opus-4");
    });

    it("handles case insensitivity", () => {
      expect(resolveModelId("GPT-4O")).toBe("openai/gpt-4o");
      expect(resolveModelId("Claude-Sonnet-4")).toBe("anthropic/claude-sonnet-4");
    });

    it("returns normalized unknown models", () => {
      expect(resolveModelId("unknown-model")).toBe("unknown-model");
    });
  });

  describe("getModelSpec", () => {
    it("returns spec for canonical OpenAI models", () => {
      const spec = getModelSpec("openai/gpt-4o");
      expect(spec).toBeDefined();
      expect(spec?.id).toBe("openai/gpt-4o");
      expect(spec?.provider).toBe("openai");
      expect(spec?.capabilities.maxContextTokens).toBe(128_000);
    });

    it("returns spec for canonical Anthropic models", () => {
      const spec = getModelSpec("anthropic/claude-sonnet-4");
      expect(spec).toBeDefined();
      expect(spec?.id).toBe("anthropic/claude-sonnet-4");
      expect(spec?.provider).toBe("anthropic");
      expect(spec?.capabilities.maxContextTokens).toBe(200_000);
    });

    it("returns spec for canonical Google models", () => {
      const spec = getModelSpec("google/gemini-2.5-pro");
      expect(spec).toBeDefined();
      expect(spec?.id).toBe("google/gemini-2.5-pro");
      expect(spec?.provider).toBe("google");
      expect(spec?.capabilities.maxContextTokens).toBe(1_000_000);
    });

    it("returns spec via alias resolution", () => {
      const spec = getModelSpec("gpt-4o");
      expect(spec).toBeDefined();
      expect(spec?.id).toBe("openai/gpt-4o");
    });

    it("returns null for unknown models", () => {
      const spec = getModelSpec("unknown/fake-model");
      expect(spec).toBeNull();
    });

    it("handles extended context models", () => {
      const spec = getModelSpec("anthropic/claude-opus-4.5");
      expect(spec).toBeDefined();
      expect(spec?.capabilities.maxContextTokens).toBe(200_000);
      expect(spec?.capabilities.extendedContext).toBe(1_000_000);
    });
  });

  describe("requireModelSpec", () => {
    it("returns spec for known models", () => {
      const spec = requireModelSpec("gpt-4o");
      expect(spec.id).toBe("openai/gpt-4o");
    });

    it("throws for unknown models", () => {
      expect(() => requireModelSpec("unknown-model")).toThrow("Unknown model: unknown-model");
    });
  });

  describe("listModels", () => {
    it("returns all registered models", () => {
      const models = listModels();
      expect(models.length).toBeGreaterThan(30);
      expect(models.every((m) => typeof m.id === "string")).toBe(true);
    });

    it("includes models from all providers", () => {
      const models = listModels();
      const providers = new Set(models.map((m) => m.provider));
      expect(providers.has("openai")).toBe(true);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("google")).toBe(true);
      expect(providers.has("deepseek")).toBe(true);
    });
  });

  describe("listModelsByProvider", () => {
    it("filters OpenAI models", () => {
      const models = listModelsByProvider("openai");
      expect(models.length).toBeGreaterThan(5);
      expect(models.every((m) => m.provider === "openai")).toBe(true);
    });

    it("filters Anthropic models", () => {
      const models = listModelsByProvider("anthropic");
      expect(models.length).toBeGreaterThan(3);
      expect(models.every((m) => m.provider === "anthropic")).toBe(true);
    });

    it("returns empty array for unknown provider", () => {
      const models = listModelsByProvider("unknown" as never);
      expect(models).toHaveLength(0);
    });
  });

  describe("listModelIds", () => {
    it("returns both canonical IDs and aliases", () => {
      const ids = listModelIds();
      expect(ids).toContain("openai/gpt-4o");
      expect(ids).toContain("gpt-4o");
      expect(ids.length).toBeGreaterThan(60);
    });

    it("returns sorted list", () => {
      const ids = listModelIds();
      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    });
  });

  describe("Model Spec Validation", () => {
    it("all models have positive context windows", () => {
      const models = listModels();
      for (const model of models) {
        expect(model.capabilities.maxContextTokens).toBeGreaterThan(0);
      }
    });

    it("all models have positive max output tokens", () => {
      const models = listModels();
      for (const model of models) {
        expect(model.capabilities.maxOutputTokens).toBeGreaterThan(0);
      }
    });

    it("all models have non-negative pricing", () => {
      const models = listModels();
      for (const model of models) {
        expect(model.pricing.inputPer1M).toBeGreaterThanOrEqual(0);
        expect(model.pricing.outputPer1M).toBeGreaterThanOrEqual(0);
        if (model.pricing.cachedInputPer1M !== undefined) {
          expect(model.pricing.cachedInputPer1M).toBeGreaterThanOrEqual(0);
        }
        if (model.pricing.reasoningPer1M !== undefined) {
          expect(model.pricing.reasoningPer1M).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("all models have valid history ratios", () => {
      const models = listModels();
      for (const model of models) {
        expect(model.recommendedHistoryRatio).toBeGreaterThanOrEqual(0.15);
        expect(model.recommendedHistoryRatio).toBeLessThanOrEqual(0.75);
      }
    });

    it("cached pricing is cheaper than full pricing", () => {
      const models = listModels();
      for (const model of models) {
        if (model.pricing.cachedInputPer1M !== undefined) {
          expect(model.pricing.cachedInputPer1M).toBeLessThan(model.pricing.inputPer1M);
        }
      }
    });

    it("extended context is larger than base context", () => {
      const models = listModels();
      for (const model of models) {
        if (model.capabilities.extendedContext !== undefined) {
          expect(model.capabilities.extendedContext).toBeGreaterThan(
            model.capabilities.maxContextTokens
          );
        }
      }
    });
  });

  describe("Registry Integrity", () => {
    it("all registry entries have unique IDs", () => {
      const ids = Object.keys(MODEL_REGISTRY);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("all aliases point to valid registry entries", () => {
      const models = listModels();
      const validIds = new Set(models.map((m) => m.id));
      
      // Check a sample of aliases
      const aliasTests = [
        "gpt-4o",
        "claude-sonnet-4",
        "gemini-2.5-pro",
        "o3-mini",
      ];
      
      for (const alias of aliasTests) {
        const canonical = resolveModelId(alias);
        expect(validIds.has(canonical)).toBe(true);
      }
    });

    it("reasoning models have lower recommended ratios", () => {
      const o1 = getModelSpec("openai/o1");
      const r1 = getModelSpec("deepseek/deepseek-r1");
      const gpt4o = getModelSpec("openai/gpt-4o");
      
      expect(o1?.recommendedHistoryRatio).toBe(0.45);
      expect(r1?.recommendedHistoryRatio).toBe(0.45);
      expect(gpt4o?.recommendedHistoryRatio).toBe(0.55);
    });
  });
});
